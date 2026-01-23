import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, NewsTask } from '../types';
import { MOCK_NEWS } from '../data/mockNews';

interface UserStats {
    totalValidations: number;
    accuracy: number;
    pendingTasks: number;
    weeklyEarnings: number;
}

interface UseUserDataReturn {
    profile: UserProfile | null;
    tasks: NewsTask[];
    stats: UserStats;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    isAuthenticated: boolean;
}

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<T>;
};

export const useUserData = (): UseUserDataReturn => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [tasks, setTasks] = useState<NewsTask[]>([]);
    const [stats, setStats] = useState<UserStats>({
        totalValidations: 0,
        accuracy: 98,
        pendingTasks: 0,
        weeklyEarnings: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const fetchUserData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Get Current User Session
            const { data: { session }, error: sessionError } = (await withTimeout(
                supabase.auth.getSession(),
                8000,
                'Tempo excedido ao validar sessão.'
            )) as any;

            if (sessionError) throw sessionError;

            const user = session?.user;
            if (!user) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }

            setIsAuthenticated(true);

            // 2. Fetch Profile
            const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
            const fallbackProfile: UserProfile = {
                name: (metadata?.name as string) || 'Usuário',
                lastname: (metadata?.lastname as string) || '',
                current_balance: 0,
                reputation_score: 0,
                city: (metadata?.city as string) || '',
                state: (metadata?.state as string) || '',
                affiliate_code: ''
            };

            const { data: profileData, error: profileError } = (await withTimeout(
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single(),
                12000,
                'Tempo excedido ao carregar perfil.'
            )) as any;

            if (profileError) {
                console.warn('Profile fetch error:', profileError);
                setProfile(fallbackProfile);
            } else {
                setProfile(profileData || fallbackProfile);
            }

            // 3. Fetch User Validations (for stats)
            const { data: validations, error: validationsError } = (await withTimeout(
                supabase
                    .from('validations')
                    .select('task_id, created_at')
                    .eq('user_id', user.id),
                12000,
                'Tempo excedido ao carregar validações.'
            )) as any;

            const validatedTaskIds: string[] = validationsError ? [] : (validations?.map((v: any) => v.task_id) || []);

            // Calculate weekly earnings (simplified)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekValidations = validations?.filter((v: any) => new Date(v.created_at) > weekAgo).length || 0;
            const weeklyEarnings = weekValidations * 0.80; // Avg R$0.80 per validation

            // 4. Fetch Available Tasks
            const { data: tasksData, error: tasksError } = (await withTimeout(
                supabase
                    .from('news_tasks')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50),
                12000,
                'Tempo excedido ao carregar notícias.'
            )) as any;

            let finalTasks = tasksError ? [] : ((tasksData || []) as NewsTask[]);
            finalTasks = finalTasks.filter((t) => !validatedTaskIds.includes(t.id));

            if (finalTasks.length === 0) {
                finalTasks = MOCK_NEWS;
            }

            setTasks(finalTasks);

            // 5. Update Stats
            setStats({
                totalValidations: validations?.length || 0,
                accuracy: 98, // Mock for now
                pendingTasks: finalTasks.length,
                weeklyEarnings
            });

        } catch (err) {
            console.error('Error loading user data:', err);
            setError((err as any)?.message || 'Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    return {
        profile,
        tasks,
        stats,
        loading,
        error,
        refetch: fetchUserData,
        isAuthenticated
    };
};
