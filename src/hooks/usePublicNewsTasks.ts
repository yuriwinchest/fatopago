import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PUBLIC_NEWS_TASKS_SELECT, mapPublicNewsRowsToTasks } from '../lib/publicNewsShowcase';
import { NewsTask } from '../types';

const buildPublicNewsQuery = (limit: number) => {
    return supabase
        .from('news_tasks')
        .select(PUBLIC_NEWS_TASKS_SELECT)
        .eq('is_admin_post', true)
        .order('admin_priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);
};

export const usePublicNewsTasks = (limit = 12) => {
    const [tasks, setTasks] = useState<NewsTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadTasks = async () => {
            setLoading(true);

            try {
                const { data, error } = await buildPublicNewsQuery(limit);

                if (error) {
                    throw error;
                }

                const rows = Array.isArray(data) ? data : [];

                if (!active) return;
                setTasks(mapPublicNewsRowsToTasks(rows));
            } catch (error) {
                if (!active) return;
                console.warn('Falha ao carregar notícias públicas para o login:', error);
                setTasks([]);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadTasks();

        return () => {
            active = false;
        };
    }, [limit]);

    return { tasks, loading };
};
