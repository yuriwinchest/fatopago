import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface FakeNewsValidation {
    id: string;
    task_id: string;
    user_id: string;
    verdict: boolean;
    justification: string | null;
    proof_link: string | null;
    created_at: string;
    news_tasks: {
        id: string;
        content: {
            title: string;
            description: string;
            category: string;
            source: string;
            image_url?: string;
        };
    };
    profiles: {
        name: string;
        lastname: string;
    };
}

export function useFakeNews() {
    const [fakeNews, setFakeNews] = useState<FakeNewsValidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchFakeNews();
    }, []);

    const fetchFakeNews = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('validations')
                .select(`
                    id,
                    task_id,
                    user_id,
                    verdict,
                    justification,
                    proof_link,
                    created_at,
                    news_tasks (
                        id,
                        content
                    ),
                    profiles (
                        name,
                        lastname
                    )
                `)
                .eq('verdict', false)
                .order('created_at', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            setFakeNews(data || []);
        } catch (err: any) {
            console.error('Error fetching fake news:', err);
            setError(err.message || 'Erro ao carregar notícias falsas');
        } finally {
            setLoading(false);
        }
    };

    return {
        fakeNews,
        loading,
        error,
        refetch: fetchFakeNews
    };
}
