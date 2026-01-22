
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const withTimeout = (promise: Promise<any>, ms: number, message: string): Promise<any> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<any>;
};

interface NewsTask {
    id: string;
    content: {
        title: string;
        description: string;
        reward: number;
        category: string;
        source: string;
        difficulty: string;
    };
    created_at: string;
}
const ValidationTask = () => {
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
        const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            8000,
            "Tempo excedido ao validar sessão. Tente novamente."
        );
        const user = session?.user;
        if (!user) return;

        const { data } = await supabase
            .from('validations')
            .select(`
                *,
                news_tasks (
                    content
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) setRecentValidations(data);
    };

    const handleVote = async (verdict: boolean | null) => {
        if (!task) return;
        setVoting(true);

        try {
            // 1. Get User
            const { data: { session } } = await withTimeout(
                supabase.auth.getSession(),
                8000,
                "Tempo excedido ao validar sessão. Tente novamente."
            );
            const user = session?.user;
            if (!user) {
                navigate('/login');
                return;
            }

            // 2. Insert Validation
            const { error: insertError } = await supabase.from('validations').insert({
                task_id: task.id,
                user_id: user.id,
                verdict: verdict
            });

            if (insertError) throw insertError;

            // 3. Update User Profile (Add Balance/Score - Optimistic Client Side or Trigger)
            const { data: profile } = await supabase.from('profiles').select('current_balance, reputation_score').eq('id', user.id).single();

            if (profile) {
                const newBalance = (profile.current_balance || 0) + task.content.reward;
                const newScore = (profile.reputation_score || 0) + 10; // +10 XP

                await supabase.from('profiles').update({
                    current_balance: newBalance,
                    reputation_score: newScore
                }).eq('id', user.id);
            }

            // Success Animation
            setShowSuccess(true);
            setTimeout(() => {
                navigate('/validation'); // Go back to Hub
            }, 2000);

        } catch (err) {
            console.error("Error submitting vote:", err);
            setVoting(false);
            alert("Erro ao enviar validação. Tente novamente.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white flex-col gap-4">
                <p>Tarefa não encontrada.</p>
                <button onClick={() => navigate('/validation')} className="text-purple-400 font-bold">Voltar ao Painel</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 sticky top-0 bg-[#0F0529]/80 backdrop-blur-md z-20 border-b border-white/5">
                <button onClick={() => navigate('/validation')} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-slate-300" />
                </button>
                <h1 className="font-bold text-lg tracking-wide">Validar Notícia</h1>
                <div className="flex gap-1">
                    <button onClick={() => setShowHistory(!showHistory)} className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
                        <Share2 className="w-6 h-6 text-slate-300" />
                        {showHistory && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                    </button>
                    {/* User Profile Link - As requested */}
                    <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-purple-500 border border-white/20 flex items-center justify-center text-[10px] font-bold">
                            U
                        </div>
                    </button>
                </div>
            </div>

            {/* History Popover (Small History) */}
            {showHistory && (
                <div className="absolute top-20 right-4 w-72 bg-[#1A1040] border border-white/10 rounded-2xl shadow-2xl z-30 p-4 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Últimas Validações</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {recentValidations.length > 0 ? (
                            recentValidations.map((val: any) => (
                                <div key={val.id} className="flex gap-3 items-start pb-3 border-b border-white/5 last:border-0">
                                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${val.verdict ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div>
                                        <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
                                            {val.news_tasks?.content?.title || 'Notícia validada'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {new Date(val.created_at).toLocaleDateString('pt-BR')} • {val.verdict ? 'Aprovado' : 'Reprovado'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-500 text-center py-4">Nenhuma validação recente.</p>
                        )}
                    </div>
                    <button onClick={() => navigate('/profile')} className="w-full mt-3 bg-white/5 hover:bg-white/10 text-xs font-bold py-2 rounded-lg transition-colors text-center text-purple-300">
                        Ver Histórico Completo
                    </button>
                </div>
            )}

            {/* Success Overlay */}
            {showSuccess && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0F0529]/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="text-center transform scale-105 transition-transform">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 border-4 border-green-500">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Validação Confirmada!</h2>
                        <p className="text-purple-300 font-bold text-xl">+ R$ {task.content.reward.toFixed(2)}</p>
                        <p className="text-slate-400 text-sm mt-4">Redirecionando...</p>
                    </div>
                </div>
            )}

            <div className="max-w-xl mx-auto p-6 pb-32">
                {/* News Card */}
                <div className="bg-[#1A1040]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-purple-600 text-xs font-bold px-3 py-1.5 rounded-bl-2xl">
                        SALDO: R$ {task.content.reward.toFixed(2)}
                    </div>

                    <div className="mb-6 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md">
                            {task.content.category}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold leading-tight mb-4 text-white">
                        {task.content.title}
                    </h2>

                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Share2 className="w-3 h-3 text-purple-400" />
                            <span className="text-xs font-bold text-purple-300 uppercase">Fonte: {task.content.source}</span>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {task.content.description}
                        </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>Relevância: Alta</span>
                        <span>Dificuldade: {task.content.difficulty}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 space-y-4">
                    <p className="text-center text-slate-400 text-sm mb-4">Esta notícia é verdadeira?</p>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleVote(true)}
                            disabled={voting}
                            className="bg-gradient-to-br from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 text-white font-bold py-4 rounded-2xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1 disabled:opacity-50"
                        >
                            <CheckCircle className="w-6 h-6" />
                            VERDADEIRO
                        </button>

                        <button
                            onClick={() => handleVote(false)}
                            disabled={voting}
                            className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-bold py-4 rounded-2xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1 disabled:opacity-50"
                        >
                            <XCircle className="w-6 h-6" />
                            FALSO / FAKE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationTask;
