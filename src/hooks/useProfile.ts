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
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                navigate('/login');
                return;
            }

            const [profileRes, historyRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase
                    .from('validations')
                    .select(`
                        id,
                        verdict,
                        created_at,
                        news_tasks (
                            content
                        )
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
            ]);

            if (profileRes.error) throw profileRes.error;
            setProfile({
                ...profileRes.data,
                email: user.email
            });

            if (historyRes.data) {
                setHistory(historyRes.data as any[]);
                // Mock accuracy logic
                setStats({
                    total: historyRes.data.length,
                    accuracy: 98 // Hardcoded as per original logic
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
        navigate('/login');
    };

    return {
        profile,
        stats,
        history,
        loading,
        activeTab,
        setActiveTab,
        handleLogout,
        getLevel: (xp: number) => {
            if (xp < 100) return "Novato";
            if (xp < 500) return "Observador";
            if (xp < 1000) return "Analista";
            if (xp < 5000) return "Especialista";
            return "Mestre da Verdade";
        }
    };
}
