/**
 * Detecta que uma nova versão do app foi deployada no servidor.
 *
 * Estratégia: busca periódica do `/index.html` e compara o hash do
 * bundle JS principal referenciado. Se mudou, expõe para a UI mostrar
 * um banner "Nova versão disponível — atualizar".
 *
 * Também fornece `forceReloadOnGatewayError` para usar em catch de
 * requisições que retornaram 502/504 (sinal forte de que o cliente
 * está em bundle obsoleto rodando contra infra corrigida).
 *
 * Evita loop infinito reutilizando a contagem do chunkRecovery.
 */
import { attemptChunkRecovery } from './chunkRecovery';

const POLL_INTERVAL_MS = 60_000; // 60s
const CURRENT_BUNDLE_HASH_ATTR = 'data-fatopago-current-bundle';

type VersionCheckListener = (state: { hasNewVersion: boolean; latestBundle: string | null }) => void;

const listeners = new Set<VersionCheckListener>();
let pollTimer: number | null = null;
let currentBundle: string | null = null;
let hasNewVersion = false;

/** Extrai o caminho do primeiro bundle `/assets/*.js` do HTML. */
function extractBundleHash(html: string): string | null {
    const match = html.match(/\/assets\/index-[^"'\s]+\.js/);
    return match ? match[0] : null;
}

/** Define o bundle atual a partir do HTML carregado na página. */
function captureCurrentBundle(): string | null {
    if (typeof document === 'undefined') return null;

    // Tenta via atributo cacheado para evitar reparse.
    const cached = document.documentElement.getAttribute(CURRENT_BUNDLE_HASH_ATTR);
    if (cached) return cached;

    // Busca entre os script tags carregados.
    const scripts = Array.from(document.querySelectorAll('script[src*="/assets/index-"]'));
    const src = scripts.map((s) => (s as HTMLScriptElement).src).find(Boolean);
    if (!src) return null;

    try {
        const url = new URL(src);
        const path = url.pathname;
        document.documentElement.setAttribute(CURRENT_BUNDLE_HASH_ATTR, path);
        return path;
    } catch {
        return null;
    }
}

async function checkForNewVersion(): Promise<void> {
    if (typeof fetch === 'undefined' || typeof document === 'undefined') return;
    if (!currentBundle) {
        currentBundle = captureCurrentBundle();
        if (!currentBundle) return;
    }

    try {
        // cache: no-store garante que o navegador busque o HTML fresco
        // mesmo se o middle-layer tiver cache agressivo.
        const res = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) return;
        const html = await res.text();
        const latestBundle = extractBundleHash(html);
        if (!latestBundle) return;

        if (latestBundle !== currentBundle) {
            hasNewVersion = true;
            emit({ hasNewVersion: true, latestBundle });
        }
    } catch {
        // Silencioso — rede pode estar instável, tenta de novo no próximo ciclo.
    }
}

function emit(state: { hasNewVersion: boolean; latestBundle: string | null }) {
    for (const listener of listeners) {
        try {
            listener(state);
        } catch {
            // Um listener quebrar não para os outros.
        }
    }
}

/** Registra um callback que é chamado quando detecta nova versão. */
export function subscribeVersionCheck(listener: VersionCheckListener): () => void {
    listeners.add(listener);
    if (hasNewVersion) {
        // Notifica imediatamente se já detectou antes do subscribe.
        listener({ hasNewVersion: true, latestBundle: null });
    }
    return () => {
        listeners.delete(listener);
    };
}

/** Inicia o polling. Chamar uma vez no bootstrap do app. */
export function startVersionCheck(): void {
    if (typeof window === 'undefined') return;
    if (pollTimer != null) return;

    // Captura o bundle atual no primeiro load.
    currentBundle = captureCurrentBundle();

    // Primeiro check diferido (não bloqueia o TTI).
    window.setTimeout(() => {
        void checkForNewVersion();
    }, 5_000);

    pollTimer = window.setInterval(() => {
        void checkForNewVersion();
    }, POLL_INTERVAL_MS);
}

/**
 * Usado em catch de requisições: se o erro parece 502/504 (bundle obsoleto
 * chamando endpoint que não suporta mais o formato antigo), força reload
 * — desde que não tenha estourado o limite de recovery (evita loop).
 */
export function forceReloadOnGatewayError(error: unknown): boolean {
    if (!isGatewayError(error)) return false;
    // attemptChunkRecovery ja tem proteção anti-loop (3 tentativas / 45s)
    // e adiciona query param para bustear cache dos chunks.
    return attemptChunkRecovery();
}

function isGatewayError(error: unknown): boolean {
    if (!error) return false;
    const maybe = error as { status?: number; code?: string | number; message?: string };
    const status = Number(maybe.status || 0);
    if (status === 502 || status === 503 || status === 504) return true;
    const message = String(maybe.message || '').toLowerCase();
    return (
        message.includes('bad gateway') ||
        message.includes('gateway timeout') ||
        message.includes('service unavailable')
    );
}
