import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserProfile, NewsTask } from '../types';
import { MOCK_NEWS } from '../data/mockNews';
import { fetchActivePlan, PlanPurchase } from '../lib/planService';

export function useDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [tasks, setTasks] = useState<NewsTask[]>([]);
    const [activePlan, setActivePlan] = useState<PlanPurchase | null>(null);

    // We can expose modal state here or keep in component if it's purely UI
    // For cleanliness, we keep modal UI state in the component, but data here usually
    // Let's keep data logic here

    const loadDashboard = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session?.user) {
                navigate('/login');
                return;
            }

            const user = session.user;

            // Parallel fetching for performance
            const [profileResult, validationsResult, tasksResult, activePlanResult] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('validations').select('task_id').eq('user_id', user.id),
                supabase.from('news_tasks').select('*').order('created_at', { ascending: false }).limit(50),
                fetchActivePlan(user.id)
            ]);

            setProfile(profileResult.data);
            setActivePlan(activePlanResult);

            const validatedTaskIds = validationsResult.data?.map((v: any) => v.task_id) || [];
            const baseTasks = (tasksResult.data || []) as NewsTask[];

            let finalTasks = baseTasks.filter((t) => !validatedTaskIds.includes(t.id));
            if (finalTasks.length === 0) {
                finalTasks = MOCK_NEWS;
            }

            setTasks(finalTasks);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [navigate]);

    return {
        profile,
        tasks,
        setTasks,
        loading,
        activePlan
    };
}
