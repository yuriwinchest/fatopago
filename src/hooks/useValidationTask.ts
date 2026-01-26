import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { NewsTask } from '../types';

export function useValidationTask() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [task, setTask] = useState<NewsTask | null>(null);
    const [voting, setVoting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [recentValidations, setRecentValidations] = useState<any[]>([]);

    useEffect(() => {
        const fetchTask = async () => {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('news_tasks')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setTask(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, [id]);

    useEffect(() => {
        if (showHistory) {
            fetchHistory();
        }
    }, [showHistory]);

    const fetchHistory = async () => {
        // Simplified fetch without redundant timeouts for now
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data } = await supabase
            .from('validations')
            .select(`*, news_tasks (content)`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) setRecentValidations(data);
    };

    const handleVote = async (verdict: boolean | null) => {
        if (!task) return;
        setVoting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                navigate('/login');
                return;
            }

            // Transaction-like logic
            const { error: insertError } = await supabase.from('validations').insert({
                task_id: task.id,
                user_id: user.id,
                verdict: verdict
            });

            if (insertError) throw insertError;

            // Optimistic update of profile (or Trigger based)
            // Here we assume a trigger or we update manually:
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_balance, reputation_score')
                .eq('id', user.id)
                .single();

            if (profile) {
                await supabase.from('profiles').update({
                    current_balance: (profile.current_balance || 0) + task.content.reward,
                    reputation_score: (profile.reputation_score || 0) + 10
                }).eq('id', user.id);
            }

            setShowSuccess(true);
            setTimeout(() => {
                navigate('/validation');
            }, 2000);

        } catch (err) {
            console.error("Error submitting vote:", err);
            setVoting(false);
            alert("Erro ao enviar validação. Tente novamente.");
        }
    };

    return {
        task,
        loading,
        voting,
        showSuccess,
        showHistory,
        setShowHistory,
        recentValidations,
        handleVote,
        navigate
    };
}
