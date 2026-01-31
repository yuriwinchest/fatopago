import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { NewsTask } from '../types';
import { consumeActivePlanValidation, getPlanAccessForCurrentUser, PlanPurchase } from '../lib/planService';

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
    const [activePlan, setActivePlan] = useState<PlanPurchase | null>(null);
    const [alreadyVoted, setAlreadyVoted] = useState(false);

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
                    setPlanMessage('Você não tem saldo para validar. Escolha um plano para continuar.');
                    return;
                }
                if (planAccess.status !== 'ok') {
                    setPlanBlocked(true);
                    setPlanMessage(planAccess.status === 'error' ? planAccess.message : 'Falha ao verificar plano.');
                    return;
                }

                setActivePlan(planAccess.plan);

                const { data, error } = await supabase
                    .from('news_tasks')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setTask(data);

                // Check if user already voted in current cycle
                const cycleStart = new Date(data.cycle_start_at || data.created_at);
                const cycleEnd = new Date(cycleStart.getTime() + 24 * 60 * 60 * 1000);
                const now = new Date();

                if (now >= cycleEnd) {
                    setPlanBlocked(true);
                    setPlanMessage('Este ciclo de votação foi encerrado. Aguarde novas notícias.');
                    return;
                }

                const { data: existingVote } = await supabase
                    .from('validations')
                    .select('id')
                    .eq('task_id', id)
                    .eq('user_id', planAccess.plan.user_id)
                    .gte('created_at', cycleStart.toISOString())
                    .single();

                if (existingVote) {
                    setAlreadyVoted(true);
                    setPlanBlocked(true);
                    setPlanMessage('Você já votou nesta notícia neste ciclo. Aguarde o próximo ciclo.');
                }
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
                if (error.message.includes("function public.submit_validation") || error.message.includes("does not exist")) {
                    console.warn("RPC submit_validation not found, falling back to legacy insecure method.");
                    await handleLegacyVote(verdict);
                    return;
                }
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
            alert(err.message || "Erro ao enviar validação. Tente novamente.");
        }
    };

    const handleLegacyVote = async (verdict: boolean | null) => {
        if (!task) return;

        if (!activePlan) {
            alert("Você não tem saldo para validar. Escolha um plano para continuar.");
            navigate('/plans?reason=no-balance&returnTo=/validation');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                navigate('/login');
                return;
            }

            const { error: insertError } = await supabase.from('validations').insert({
                task_id: task.id,
                user_id: user.id,
                plan_purchase_id: activePlan.id,
                verdict: verdict
            });

            if (insertError) throw insertError;

            await consumeActivePlanValidation(activePlan);

            const { data: profile } = await supabase
                .from('profiles')
                .select('current_balance, reputation_score')
                .eq('id', user.id)
                .single();

            if (profile) {
                await supabase.from('profiles').update({
                    current_balance: (profile.current_balance || 0) + Number(task.content.reward),
                    reputation_score: (profile.reputation_score || 0) + 10
                }).eq('id', user.id);
            }

            setShowSuccess(true);
            setTimeout(() => {
                navigate('/validation');
            }, 2000);

        } catch (err) {
            console.error("Legacy vote error:", err);
            alert("Erro na validação legada. Tente novamente.");
        } finally {
            setVoting(false);
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
        alreadyVoted
    };
}
