import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { NewsTask } from '../types';

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

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [tasks, setTasks] = useState<NewsTask[]>([]);
    const initialPersisted = useRef<ValidationHubPersistedState | null>(null);
    if (initialPersisted.current === null && typeof window !== 'undefined') {
        initialPersisted.current = readPersistedState();
    }

    const [selectedCategory, setSelectedCategory] = useState(
        initialPersisted.current?.selectedCategory || 'Todas'
    );
    const [error, setError] = useState<string | null>(null);

    // Filter helpers
    const CATEGORIES = ['Todas', 'Política', 'Economia', 'Esportes', 'Internacional', 'Brasil', 'Entretenimento'];

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const restoreDoneRef = useRef(false);
    const scrollRafRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);

    const buildBaseQuery = useCallback(
        (category: string) => {
            let q = supabase
                .from('news_tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (category !== 'Todas') {
                // PostgREST supports JSON path in filters
                q = q.eq('content->>category', category);
            }
            return q;
        },
        []
    );

    const loadFirstPage = useCallback(
        async (category: string) => {
            setLoading(true);
            setError(null);
            setHasMore(true);

            try {
                const { data, error } = await buildBaseQuery(category).range(0, PAGE_SIZE - 1);
                if (error) throw error;
                const rows = (data || []) as NewsTask[];
                setTasks(rows);
                setHasMore(rows.length === PAGE_SIZE);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Falha ao carregar notícias.');
            } finally {
                setLoading(false);
            }
        },
        [PAGE_SIZE, buildBaseQuery]
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

            const { data, error } = await buildBaseQuery(selectedCategory)
                .lt('created_at', lastCreatedAt)
                .range(0, PAGE_SIZE - 1);

            if (error) throw error;
            const rows = (data || []) as NewsTask[];
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
    }, [PAGE_SIZE, buildBaseQuery, hasMore, loading, loadingMore, selectedCategory, tasks]);

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

    // Tasks are filtered server-side now
    const filteredTasks = tasks;

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

                try {
                    const { data, error } = await buildBaseQuery(selectedCategory)
                        .gt('created_at', newestCreatedAt)
                        .range(0, PAGE_SIZE - 1);

                    if (error) throw error;
                    const rows = (data || []) as NewsTask[];
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
    }, [POLL_MS, PAGE_SIZE, buildBaseQuery, loading, selectedCategory, tasks]);

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
        retry: () => loadFirstPage(selectedCategory)
    };
}
