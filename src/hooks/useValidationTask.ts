import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { NewsTask } from '../types';
import { getPlanAccessForCurrentUser } from '../lib/planService';

export function useValidationTask() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [task, setTask] = useState<NewsTask | null>(null);
    const [voting, setVoting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [recentValidations, setRecentValidations] = useState<any[]>([]);
    const [planBlocked, setPlanBlocked] = useState(false);
    const [planMessage, setPlanMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchTask = async () => {
            if (!id) return;
            try {
                const planAccess = await getPlanAccessForCurrentUser();
                if (planAccess.status === 'no-session') {
                    navigate('/login');
                    return;
                }
                if (planAccess.status === 'no-plan' || planAccess.status === 'exhausted') {
                    setPlanBlocked(true);
                    setPlanMessage('Você não tem notícias disponíveis para validar. Escolha um plano para continuar.');
                    return;
                }
                if (planAccess.status !== 'ok') {
                    setPlanBlocked(true);
                    setPlanMessage(planAccess.status === 'error' ? planAccess.message : 'Falha ao verificar plano.');
                    return;
                }

                const { data, error } = await supabase
                    .from('news_tasks')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                if (data.consensus_reached || (data.consensus_status && data.consensus_status !== 'open')) {
                    setPlanBlocked(true);
                    setPlanMessage('Esta notícia não está mais aberta para validação. Volte e escolha outra.');
                    return;
                }

                // Apply dynamic reward policy
                const { getRewardByCategory } = await import('../lib/planRules');
                const taskWithPolicy = {
                     ...data,
                     content: {
                        ...data.content,
                        reward: getRewardByCategory(data.content.category)
                     }
                };
                
                setTask(taskWithPolicy);
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

    const handleVote = async (verdict: boolean | null, justification?: string, proofLink?: string) => {
        if (!task) return;

        setVoting(true);

        try {
            // Use RPC for secure, atomic validation
            const { data, error } = await supabase.rpc('submit_validation', {
                p_task_id: task.id,
                p_verdict: verdict,
                p_justification: verdict ? null : (justification?.trim() || null),
                p_proof_link: verdict ? null : (proofLink?.trim() || null)
            });

            if (error) {
                throw error;
            }

            if (data?.status === 'error') {
                throw new Error(data.message);
            }

            setShowSuccess(true);
            setTimeout(() => {
                navigate('/validation');
            }, 2000);

        } catch (err: any) {
            console.error("Error submitting vote:", err);
            setVoting(false);
            const raw = String(err?.message || err || '');
            const normalized = raw.toLowerCase();
            if (
                normalized.includes('validations_user_id_fkey') ||
                normalized.includes('is not present in table "profiles"')
            ) {
                alert('Seu cadastro está sendo sincronizado. Tente novamente em alguns segundos.');
                return;
            }
            alert(raw || "Erro ao enviar validação. Tente novamente.");
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
        navigate,
        planBlocked,
        planMessage,
    };
}
