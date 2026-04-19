import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { NewsTask } from '../types';
import { getRewardByCategory } from '../lib/planRules';
import { VALIDATION_CATEGORIES } from '../lib/newsCategories';

type ValidationHubPersistedState = {
    selectedCategory: string;
    scrollLeft: number;
};

const STORAGE_KEY = 'fatopago.validationHub.state.v1';

function readPersistedState(): ValidationHubPersistedState | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ValidationHubPersistedState>;
        if (typeof parsed.selectedCategory !== 'string') return null;
        const scrollLeft = typeof parsed.scrollLeft === 'number' && Number.isFinite(parsed.scrollLeft) ? parsed.scrollLeft : 0;
        return { selectedCategory: parsed.selectedCategory, scrollLeft };
    } catch {
        return null;
    }
}

function writePersistedState(next: ValidationHubPersistedState) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // ignore (private mode / storage full)
    }
}

export function useValidationHub() {
    const PAGE_SIZE = 60;
    const POLL_MS = 60_000;
    const NEWS_TASK_LITE_SELECT =
        'id, created_at, cycle_start_at,' +
        'title:content->>title,' +
        'description:content->>description,' +
        'reward:content->>reward,' +
        'category:content->>category,' +
        'source:content->>source,' +
        'difficulty:content->>difficulty,' +
        'image_url:content->>image_url,' +
        'link:content->>link';

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [tasks, setTasks] = useState<NewsTask[]>([]);
    const [activeCycleStartAt, setActiveCycleStartAt] = useState<string | null>(null);
    const activePlanPurchaseIdRef = useRef<string | null>(null);
    const validatedTaskIdsRef = useRef<Set<string>>(new Set());
    const initialPersisted = useRef<ValidationHubPersistedState | null>(null);
    if (initialPersisted.current === null && typeof window !== 'undefined') {
        initialPersisted.current = readPersistedState();
    }

    const [selectedCategory, setSelectedCategory] = useState(
        initialPersisted.current?.selectedCategory || 'Todas'
    );
    const [error, setError] = useState<string | null>(null);

    // Filter helpers
    const CATEGORIES = [...VALIDATION_CATEGORIES];

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const restoreDoneRef = useRef(false);
    const scrollRafRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);

    const fetchActiveCycleStartAt = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 });
            if (error) throw error;

            const row = (Array.isArray(data) ? data[0] : data) as { cycle_start_at?: string | null } | null;
            const current = row?.cycle_start_at ? String(row.cycle_start_at) : null;
            setActiveCycleStartAt(current);
            return current;
        } catch (e) {
            console.warn('Falha ao buscar ciclo ativo (best effort):', e);
            return null;
        }
    }, []);

    // [2026-04-15] Filtro de tarefas já validadas passa a ser por plan_purchase_id
    // em vez de por ciclo. Motivo: a regra de negócio agora permite revalidar,
    // em um NOVO pacote, notícias já validadas em pacotes anteriores. Sem isso,
    // o deck do hub ficaria com menos itens do que o pacote comprado oferece.
    // Fallback (sem plano ativo): continua usando o recorte de ciclo para não
    // regredir o comportamento de quem usa apenas crédito compensatório.
    const fetchActivePlanPurchaseId = useCallback(async (): Promise<string | null> => {
        try {
            const { data, error } = await supabase.rpc('get_active_plan_purchase_id');
            if (error) throw error;
            const planId = data ? String(data) : null;
            activePlanPurchaseIdRef.current = planId;
            return planId;
        } catch (e) {
            console.warn('Falha ao buscar plano ativo (best effort):', e);
            activePlanPurchaseIdRef.current = null;
            return null;
        }
    }, []);

    const fetchValidatedTaskIds = useCallback(async (cycleStartAt?: string | null): Promise<Set<string>> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return new Set();

            const planId = await fetchActivePlanPurchaseId();

            let query = supabase
                .from('validations')
                .select('task_id')
                .eq('user_id', user.id);

            if (planId) {
                // COM plano ativo: esconde apenas as validações DESTE pacote.
                // Permite revalidar notícias de pacotes anteriores.
                query = query.eq('plan_purchase_id', planId);
            } else {
                // SEM plano ativo (só crédito compensatório): fallback por ciclo.
                const effectiveCycleStartAt = cycleStartAt || await fetchActiveCycleStartAt();
                if (!effectiveCycleStartAt) return new Set();
                query = query.gte('created_at', effectiveCycleStartAt);
            }

            const { data: validations } = await query;

            const ids = new Set<string>((validations || []).map((v: any) => String(v.task_id)));
            validatedTaskIdsRef.current = ids;
            return ids;
        } catch (e) {
            console.warn('Falha ao buscar validações do pacote atual (best effort):', e);
            return new Set();
        }
    }, [fetchActiveCycleStartAt, fetchActivePlanPurchaseId]);

    // [2026-04-15] Exclusão server-side dos já-validados no pacote ativo.
    //
    // Motivo: antes, o hook carregava as 60 mais recentes e filtrava no client.
    // Usuário com muitas validações recentes (pacotes anteriores) via só 5-10
    // cards "frescos" — mesmo que o pool global tivesse 1.600+. Agora, o
    // Postgrest exclui os task_ids já validados via NOT IN, então os 60
    // retornados são sempre utilizáveis.
    //
    // Limite prático: a URL comporta ~180 UUIDs (~7KB). Se ultrapassar, o
    // fallback é cair no filtro client-side (mantido como defesa em camadas).
    const MAX_EXCLUDED_IDS_IN_URL = 200;

    const buildBaseQuery = useCallback(
        (category: string, _cycleStartAt?: string | null, excludedIds?: Set<string>) => {
            // [2026-04-15] Hub passa a servir SOMENTE noticias cadastradas no painel admin.
            // Scrapers (RSS/Meio News) ficam desativados no worker do VPS, mas alem disso
            // filtramos is_admin_post=true aqui pra que qualquer linha scraped legada que
            // ainda esteja no banco nao apareca pro usuario. Lógica de ciclo/validação
            // continua inalterada — muda apenas a FONTE do dado. Reversível: basta remover
            // a linha .eq('is_admin_post', true) abaixo.
            let q = supabase
                .from('news_tasks')
                .select(NEWS_TASK_LITE_SELECT)
                .eq('is_admin_post', true)
                .eq('consensus_reached', false)
                .eq('consensus_status', 'open')
                .order('admin_priority', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });

            if (category !== 'Todas') {
                // PostgREST supports JSON path in filters
                q = q.eq('content->>category', category);
            }

            if (excludedIds && excludedIds.size > 0 && excludedIds.size <= MAX_EXCLUDED_IDS_IN_URL) {
                // PostgREST: "not.in.(uuid1,uuid2,...)" — sem aspas para UUID.
                const list = Array.from(excludedIds).join(',');
                q = q.not('id', 'in', `(${list})`);
            }
            return q;
        },
        [NEWS_TASK_LITE_SELECT]
    );

    const mapLiteRowsToTasks = (rows: any[]): NewsTask[] => {
        return (rows || []).map((r: any) => {
            const category = String(r.category || 'Brasil');
            return {
                id: String(r.id),
                created_at: String(r.created_at),
                content: {
                    title: String(r.title || 'Notícia'),
                    description: String(r.description || ''),
                    reward: getRewardByCategory(category),
                    category,
                    source: String(r.source || ''),
                    difficulty: String(r.difficulty || 'easy'),
                    image_url: r.image_url ? String(r.image_url) : undefined,
                    link: r.link ? String(r.link) : undefined,
                },
            };
        });
    };

    // RPC server-side que substitui o padrão "id=not.in.(uuid1,uuid2,...)" —
    // motivo: a URL crescia conforme o usuário validava mais, estourando o
    // buffer de response header do nginx (502 Bad Gateway). A RPC faz o
    // anti-join server-side, eliminando a causa-raiz.
    // Ver: supabase/migrations/20260419130000_get_pending_news_tasks_rpc.sql
    const fetchPendingViaRpc = useCallback(
        async (category: string, offset: number): Promise<{ data: any[] | null; error: any }> => {
            const cycleStartAt = await fetchActiveCycleStartAt();
            const planId = await fetchActivePlanPurchaseId();
            const { data, error } = await supabase.rpc('get_pending_news_tasks', {
                p_category: category,
                p_plan_purchase_id: planId,
                p_cycle_start_at: cycleStartAt,
                p_limit: PAGE_SIZE,
                p_offset: offset,
            });
            return { data, error };
        },
        [PAGE_SIZE, fetchActiveCycleStartAt, fetchActivePlanPurchaseId]
    );

    const loadFirstPage = useCallback(
        async (category: string) => {
            setLoading(true);
            setError(null);
            setHasMore(true);

            try {
                // Caminho novo: RPC server-side.
                const rpcResult = await fetchPendingViaRpc(category, 0);
                if (!rpcResult.error) {
                    const rows = mapLiteRowsToTasks((rpcResult.data || []) as any[]);
                    setTasks(rows);
                    setHasMore(rows.length === PAGE_SIZE);
                    return;
                }
                // Fallback: se a RPC falhar (rede, ou pre-deploy), cai no
                // método antigo para não quebrar o app.
                console.warn('[useValidationHub] RPC get_pending_news_tasks falhou, usando fallback legado:', rpcResult.error?.message);
                const cycleStartAt = await fetchActiveCycleStartAt();
                const validatedIds = await fetchValidatedTaskIds(cycleStartAt);
                const { data, error } = await buildBaseQuery(category, cycleStartAt, validatedIds)
                    .range(0, PAGE_SIZE - 1);
                if (error) throw error;
                const rows = mapLiteRowsToTasks((data || []) as any[]);
                setTasks(rows);
                setHasMore(rows.length === PAGE_SIZE);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Falha ao carregar notícias.');
            } finally {
                setLoading(false);
            }
        },
        [PAGE_SIZE, buildBaseQuery, fetchActiveCycleStartAt, fetchPendingViaRpc, fetchValidatedTaskIds]
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || loading) return;
        if (!hasMore) return;
        if (tasks.length === 0) return;

        setLoadingMore(true);
        try {
            // Caminho novo: RPC com offset = tamanho atual do deck.
            // A dedup abaixo lida com eventuais duplicatas caso notícias
            // sejam validadas/criadas entre páginas.
            const rpcResult = await fetchPendingViaRpc(selectedCategory, tasks.length);
            if (!rpcResult.error) {
                const rows = mapLiteRowsToTasks((rpcResult.data || []) as any[]);
                if (rows.length === 0) {
                    setHasMore(false);
                    return;
                }
                setTasks((prev) => {
                    const seen = new Set(prev.map((t) => t.id));
                    const merged = [...prev];
                    for (const r of rows) {
                        if (!seen.has(r.id)) merged.push(r);
                    }
                    return merged;
                });
                setHasMore(rows.length === PAGE_SIZE);
                return;
            }
            // Fallback: keyset pagination antiga (requisição legada).
            console.warn('[useValidationHub] RPC falhou em loadMore, usando fallback:', rpcResult.error?.message);
            const last = tasks[tasks.length - 1];
            const lastCreatedAt = last?.created_at;
            if (!lastCreatedAt) {
                setHasMore(false);
                return;
            }
            const { data, error } = await buildBaseQuery(
                selectedCategory,
                activeCycleStartAt,
                validatedTaskIdsRef.current
            )
                .lt('created_at', lastCreatedAt)
                .range(0, PAGE_SIZE - 1);

            if (error) throw error;
            const rows = mapLiteRowsToTasks((data || []) as any[]);
            if (rows.length === 0) {
                setHasMore(false);
                return;
            }

            setTasks((prev) => {
                const seen = new Set(prev.map((t) => t.id));
                const merged = [...prev];
                for (const r of rows) {
                    if (!seen.has(r.id)) merged.push(r);
                }
                return merged;
            });

            setHasMore(rows.length === PAGE_SIZE);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoadingMore(false);
        }
    }, [PAGE_SIZE, activeCycleStartAt, buildBaseQuery, fetchPendingViaRpc, hasMore, loading, loadingMore, selectedCategory, tasks]);

    useEffect(() => {
        loadFirstPage(selectedCategory);
    }, []); // first mount only (selectedCategory already restored from persisted state)

    // Restore carousel position once after mount/data load (mobile "voltar" keeps same card)
    useEffect(() => {
        if (loading) return;
        if (restoreDoneRef.current) return;
        const el = scrollContainerRef.current;
        if (!el) return;

        const scrollLeft = initialPersisted.current?.scrollLeft ?? 0;
        if (scrollLeft > 0) {
            // wait for layout before applying (prevents iOS snapping back)
            requestAnimationFrame(() => {
                el.scrollLeft = scrollLeft;
            });
        }
        restoreDoneRef.current = true;
    }, [loading]);

    // Filter out tasks already validated in the current cycle
    const filteredTasks = tasks.filter((t) => !validatedTaskIdsRef.current.has(t.id));

    // [2026-04-15] Gatilho de auto-load-more: antes só disparava quando o
    // deck chegava a ZERO cards. Usuário via 5-10 e achava que acabou. Agora
    // dispara quando cai abaixo de 1/3 do PAGE_SIZE, mantendo o deck sempre
    // cheio o bastante pra o usuário não "sentir" o fim do pacote.
    useEffect(() => {
        if (loading || loadingMore) return;
        if (!hasMore) return;
        if (tasks.length === 0) return;
        if (filteredTasks.length >= Math.ceil(PAGE_SIZE / 3)) return;

        void loadMore();
    }, [PAGE_SIZE, filteredTasks.length, hasMore, loadMore, loading, loadingMore, tasks.length]);

    const persistNow = (next: ValidationHubPersistedState) => {
        writePersistedState(next);
    };

    const selectCategory = (cat: string) => {
        setSelectedCategory(cat);
        // Reset position for new filter, and persist immediately
        const el = scrollContainerRef.current;
        if (el) el.scrollLeft = 0;
        restoreDoneRef.current = true; // don't auto-restore after category change
        persistNow({ selectedCategory: cat, scrollLeft: 0 });

        // Reload first page for this category
        setTasks([]);
        setHasMore(true);
        loadFirstPage(cat);
    };

    const handleUserScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const left = el.scrollLeft;

        if (scrollRafRef.current != null) return;
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null;
            persistNow({ selectedCategory, scrollLeft: left });
        });

        // Infinite "no limit": fetch more when near the end
        const thresholdPx = 240;
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - thresholdPx) {
            void loadMore();
        }
    };

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300;
            scrollContainerRef.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Poll Supabase every 1 minute for new items (real sources are ingested server-side)
    useEffect(() => {
        if (pollTimerRef.current != null) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }

        const startPoll = () => {
            pollTimerRef.current = window.setInterval(async () => {
                if (loading || tasks.length === 0) return;
                const newestCreatedAt = tasks[0]?.created_at;
                if (!newestCreatedAt) return;

                // Refresh validated task IDs on each poll
                await fetchValidatedTaskIds(activeCycleStartAt);

                try {
                    const { data, error } = await buildBaseQuery(
                        selectedCategory,
                        activeCycleStartAt,
                        validatedTaskIdsRef.current
                    )
                        .gt('created_at', newestCreatedAt)
                        .range(0, PAGE_SIZE - 1);

                    if (error) throw error;
                    const rows = mapLiteRowsToTasks((data || []) as any[]);
                    if (rows.length === 0) return;

                    const el = scrollContainerRef.current;
                    const beforeLeft = el?.scrollLeft ?? 0;
                    const shouldPreserve = (el?.scrollLeft ?? 0) > 10;

                    setTasks((prev) => {
                        const seen = new Set(prev.map((t) => t.id));
                        const next = [...rows.filter((r) => !seen.has(r.id)), ...prev];
                        return next;
                    });

                    if (el && shouldPreserve) {
                        // Keep current card stable when we prepend new items
                        requestAnimationFrame(() => {
                            const firstCard = el.querySelector(':scope > *') as HTMLElement | null;
                            const cardW = firstCard?.getBoundingClientRect().width ?? 0;
                            const gap = 16; // tailwind gap-4
                            const delta = rows.length * (cardW + gap);
                            el.scrollLeft = beforeLeft + delta;
                        });
                    }
                } catch (err) {
                    console.error(err);
                }
            }, POLL_MS);
        };

        startPoll();
        return () => {
            if (pollTimerRef.current != null) window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        };
    }, [POLL_MS, PAGE_SIZE, activeCycleStartAt, buildBaseQuery, loading, selectedCategory, tasks]);

    return {
        tasks,
        filteredTasks,
        loading,
        error,
        selectedCategory,
        setSelectedCategory,
        selectCategory,
        CATEGORIES,
        scrollContainerRef,
        handleScroll,
        handleUserScroll,
        loadingMore,
        hasMore,
        loadMore,
        retry: () => loadFirstPage(selectedCategory)
    };
}
