import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface FakeNewsValidation {
    id: string;
    task_id: string;
    verdict: boolean;
    justification: string | null;
    proof_link: string | null;
    proof_image_url: string | null;
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
                .rpc('get_public_fake_news', { p_limit: 50 });

            if (fetchError) throw fetchError;

            // Map RPC rows to the shape the UI expects
            const mapped: FakeNewsValidation[] = (data || []).map((row: any) => ({
                id: row.id,
                task_id: row.task_id,
                user_id: '',
                verdict: row.verdict,
                justification: row.justification,
                proof_link: row.proof_link,
                proof_image_url: row.proof_image_url,
                created_at: row.created_at,
                news_tasks: {
                    id: row.news_id,
                    content: {
                        title: row.news_title || '',
                        description: row.news_description || '',
                        category: row.news_category || '',
                        source: row.news_source || '',
                        image_url: row.news_image_url || undefined
                    }
                },
                profiles: {
                    name: row.user_name || 'Usuário',
                    lastname: row.user_lastname || ''
                }
            }));

            setFakeNews(mapped);
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
