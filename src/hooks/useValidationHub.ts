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
    const PAGE_SIZE = 20;
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

    const fetchValidatedTaskIds = useCallback(async (): Promise<Set<string>> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return new Set();

            // Get active plan purchase
            const { data: planData } = await supabase
                .from('plan_purchases')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!planData?.id) return new Set();

            // Get task IDs validated under this plan
            const { data: validations } = await supabase
                .from('validations')
                .select('task_id')
                .eq('user_id', user.id)
                .eq('plan_purchase_id', planData.id);

            const ids = new Set<string>((validations || []).map((v: any) => String(v.task_id)));
            validatedTaskIdsRef.current = ids;
            return ids;
        } catch (e) {
            console.warn('Falha ao buscar validações do pacote (best effort):', e);
            return new Set();
        }
    }, []);

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

    const buildBaseQuery = useCallback(
        (category: string, _cycleStartAt?: string | null) => {
            let q = supabase
                .from('news_tasks')
                .select(NEWS_TASK_LITE_SELECT)
                .eq('consensus_reached', false)
                .eq('consensus_status', 'open')
                .order('is_admin_post', { ascending: false })
                .order('admin_priority', { ascending: true, nullsFirst: false })
                .order('cycle_start_at', { ascending: false })
                .order('created_at', { ascending: false });

            if (category !== 'Todas') {
                // PostgREST supports JSON path in filters
                q = q.eq('content->>category', category);
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

    const loadFirstPage = useCallback(
        async (category: string) => {
            setLoading(true);
            setError(null);
            setHasMore(true);

            try {
                const [cycleStartAt] = await Promise.all([
                    fetchActiveCycleStartAt(),
                    fetchValidatedTaskIds()
                ]);
                const { data, error } = await buildBaseQuery(category, cycleStartAt).range(0, PAGE_SIZE - 1);
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
        [PAGE_SIZE, buildBaseQuery, fetchActiveCycleStartAt, fetchValidatedTaskIds]
    );

    const loadMore = useCallback(async () => {
        if (loadingMore || loading) return;
        if (!hasMore) return;
        if (tasks.length === 0) return;

        setLoadingMore(true);
        try {
            const last = tasks[tasks.length - 1];
            const lastCreatedAt = last?.created_at;
            if (!lastCreatedAt) {
                setHasMore(false);
                return;
            }

            const { data, error } = await buildBaseQuery(selectedCategory, activeCycleStartAt)
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
    }, [PAGE_SIZE, activeCycleStartAt, buildBaseQuery, hasMore, loading, loadingMore, selectedCategory, tasks]);

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

    // Filter out tasks already validated in the current plan purchase
    const filteredTasks = tasks.filter((t) => !validatedTaskIdsRef.current.has(t.id));

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
                await fetchValidatedTaskIds();

                try {
                    const { data, error } = await buildBaseQuery(selectedCategory, activeCycleStartAt)
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
