import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types'; // Ensure you have this type or define locally if needed

interface ValidationHistory {
    id: string;
    verdict: boolean;
    created_at: string;
    news_tasks: {
        content: {
            title: string;
            category: string;
        }
    }
}

export function useProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState({ total: 0, accuracy: 0 });
    const [history, setHistory] = useState<ValidationHistory[]>([]);
    const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        try {
            const { data: userRes, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            const user = userRes.user;
            if (!user) {
                navigate('/login');
                return;
            }

            // Fetch Profile & Full History
            const [profileRes, historyRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                supabase
                    .from('validations')
                    .select(`
                        id,
                        verdict,
                        created_at,
                        news_tasks!task_id (
                            content
                        )
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50)
            ]);

            if (profileRes.error) throw profileRes.error;

            const baseProfile: any = {
                // Keep UI usable even if the row is missing or partially filled.
                name: '',
                lastname: '',
                current_balance: 0,
                reputation_score: 0,
                city: '',
                state: '',
                affiliate_code: '',
                referral_code: '',
                referral_active: false,
                plan_status: 'none',
                avatar_url: null,
                ...(profileRes.data || {})
            };

            // If the profile row does not exist yet, try to create it (best effort).
            // We don't block the UI on this; saving will use upsert on the Profile page.
            if (!profileRes.data) {
                try {
                    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });
                } catch (e) {
                    console.warn('Profile row missing and could not be created (best effort):', e);
                }
            }

            setProfile({
                ...baseProfile,
                email: (baseProfile as any)?.email || user.email
            });

            if (historyRes.error) {
                console.warn('Erro ao buscar histórico de validações:', historyRes.error);
            }

            if (historyRes.data) {
                setHistory(historyRes.data as any[]);
                setStats({
                    total: historyRes.data.length,
                    accuracy: 98
                });
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return {
        profile,
        stats,
        history,
        loading,
        activeTab,
        setActiveTab,
        handleLogout,
        refetch: fetchProfileData,
        getLevel: (xp: number) => {
            if (xp < 100) return "Novato";
            if (xp < 500) return "Observador";
            if (xp < 1000) return "Analista";
            if (xp < 5000) return "Especialista";
            return "Mestre da Verdade";
        }
    };
}
