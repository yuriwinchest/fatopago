const CHUNK_RECOVERY_KEY = 'fatopago.chunk_recovery';
const CHUNK_RECOVERY_QUERY = '__fatopago_reload';
const CHUNK_RECOVERY_WINDOW_MS = 45_000;
const CHUNK_RECOVERY_MAX_ATTEMPTS = 3;

type ChunkRecoveryState = {
    count: number;
    lastAt: number;
};

function readChunkRecoveryState(): ChunkRecoveryState {
    if (typeof window === 'undefined') {
        return { count: 0, lastAt: 0 };
    }

    const raw = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY);
    if (!raw) return { count: 0, lastAt: 0 };

    try {
        const parsed = JSON.parse(raw) as Partial<ChunkRecoveryState>;
        return {
            count: Number(parsed.count || 0),
            lastAt: Number(parsed.lastAt || 0)
        };
    } catch {
        return { count: 0, lastAt: 0 };
    }
}

function writeChunkRecoveryState(state: ChunkRecoveryState) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, JSON.stringify(state));
}

export function isChunkLoadError(error: unknown): boolean {
    if (!error) return false;

    const maybeError = error as { message?: string; name?: string };
    const message = String(maybeError.message || '');
    const name = String(maybeError.name || '');

    return (
        name === 'ChunkLoadError' ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module') ||
        message.includes('Loading chunk') ||
        message.includes('Unable to preload CSS')
    );
}

export function buildChunkRecoveryHref(currentHref: string, timestamp = Date.now()): string {
    const url = new URL(currentHref);
    url.searchParams.set(CHUNK_RECOVERY_QUERY, String(timestamp));
    return url.toString();
}

export function attemptChunkRecovery(): boolean {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    const state = readChunkRecoveryState();
    const isWindowExpired = now - state.lastAt > CHUNK_RECOVERY_WINDOW_MS;
    const nextState: ChunkRecoveryState = isWindowExpired
        ? { count: 1, lastAt: now }
        : { count: state.count + 1, lastAt: now };

    if (nextState.count > CHUNK_RECOVERY_MAX_ATTEMPTS) {
        return false;
    }

    writeChunkRecoveryState(nextState);
    window.location.replace(buildChunkRecoveryHref(window.location.href, now));
    return true;
}

export function finalizeChunkRecoveryBoot() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHUNK_RECOVERY_QUERY)) {
        window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
        return;
    }

    url.searchParams.delete(CHUNK_RECOVERY_QUERY);
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
}

export function installChunkRecoveryListeners() {
    if (typeof window === 'undefined') return;

    const handleChunkFailure = (error: unknown) => {
        if (!isChunkLoadError(error)) return;
        attemptChunkRecovery();
    };

    window.addEventListener('error', (event) => {
        handleChunkFailure(event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
        handleChunkFailure(event.reason);
    });
}
