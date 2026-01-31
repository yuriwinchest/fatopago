import { Share2, CheckCircle, XCircle, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useValidationTask } from '../hooks/useValidationTask';
import { useState } from 'react';


const ValidationTask = () => {
    const {
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
        planMessage
    } = useValidationTask();

    // False Justification State
    const [isFalseFlow, setIsFalseFlow] = useState(false);
    const [justification, setJustification] = useState("");
    const [proofLink, setProofLink] = useState("");

    const rewardValue = Number(task?.content?.reward ?? 0);

    const onVote = async (verdict: boolean) => {
        if (verdict === false && !isFalseFlow) {
            setIsFalseFlow(true);
            return;
        }

        if (verdict === false && isFalseFlow) {
            if (!justification || justification.trim().length < 10) {
                alert("Por favor, justifique com pelo menos 10 caracteres.");
                return;
            }
        }

        await handleVote(verdict, justification, proofLink);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!task) {
        if (planBlocked) {
            return (
                <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white flex-col gap-4 p-6 text-center">
                    <p>{planMessage || 'Você não tem saldo para validar.'}</p>
                    <button
                        onClick={() => navigate('/plans?reason=no-balance&returnTo=/validation')}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                        Escolher plano
                    </button>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white flex-col gap-4">
                <p>Tarefa não encontrada.</p>
                <button onClick={() => navigate('/validation')} className="text-purple-400 font-bold">Voltar ao Painel</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans relative overflow-hidden pb-24">

            {/* Custom Header separate from AppLayout because of custom actions */}
            <div className="relative z-20 bg-[#2e0259] rounded-b-[40px] shadow-2xl p-6 flex items-center justify-between">
                <button
                    onClick={() => navigate('/validation')}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    title="Voltar"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-300" />
                </button>
                <h1 className="font-bold text-lg tracking-wide">Validar Notícia</h1>
                <div className="flex gap-1">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors relative"
                    >
                        <Share2 className="w-6 h-6 text-slate-300" />
                        {showHistory && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                    </button>
                </div>
            </div>

            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0529]/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="text-center transform scale-105 transition-transform">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 border-4 border-green-500">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Validação Confirmada!</h2>
                        <p className="text-purple-300 font-bold text-xl h-8">+ R$ {rewardValue.toFixed(2)}</p>
                        <p className="text-slate-400 text-sm mt-4">Redirecionando...</p>
                    </div>
                </div>
            )}

            {/* History Popover */}
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
                </div>
            )}

            <div className="max-w-xl mx-auto p-6">
                {/* News Card */}
                <div className="bg-[#1A1040]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-purple-600 text-xs font-bold px-3 py-1.5 rounded-bl-2xl">
                        SALDO: R$ {rewardValue.toFixed(2)}
                    </div>

                    <div className="mb-6 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md">
                            {task.content.category}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold leading-tight mb-4 text-white">
                        {task.content.title}
                    </h2>

                    {!isFalseFlow ? (
                        <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Share2 className="w-3 h-3 text-purple-400" />
                                <span className="text-xs font-bold text-purple-300 uppercase">Fonte: {task.content.source}</span>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {task.content.description}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 mb-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-200">Você identificou esta notícia como <b>Falsa</b>. Por favor, forneça provas.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="page-validation-justification" className="text-xs font-bold text-slate-400 uppercase">Justificativa <span className="text-red-400">*</span></label>
                                <textarea
                                    id="page-validation-justification"
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    placeholder="Explique por que esta notícia é falsa..."
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none min-h-[112px] resize-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="page-validation-proof-link" className="text-xs font-bold text-slate-400 uppercase">Link de Prova</label>
                                <input
                                    id="page-validation-proof-link"
                                    type="url"
                                    value={proofLink}
                                    onChange={(e) => setProofLink(e.target.value)}
                                    placeholder="https://fonte-confiavel.com/..."
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none min-h-[48px]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>Relevância: Alta</span>
                        <span>Dificuldade: {task.content.difficulty}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 space-y-4">
                    <p className="text-center text-slate-400 text-sm mb-4">Esta notícia é verdadeira?</p>

                    <div className="grid grid-cols-2 gap-4">
                        {!isFalseFlow ? (
                            <>
                                <button
                                    onClick={() => onVote(true)}
                                    disabled={voting}
                                    className="bg-gradient-to-br from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 text-white font-bold py-4 rounded-2xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1 disabled:opacity-50"
                                >
                                    <CheckCircle className="w-6 h-6" />
                                    VERDADEIRO
                                </button>

                                <button
                                    onClick={() => onVote(false)}
                                    disabled={voting}
                                    className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-bold py-4 rounded-2xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1 disabled:opacity-50"
                                >
                                    <XCircle className="w-6 h-6" />
                                    FALSO / FAKE
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsFalseFlow(false)}
                                    disabled={voting}
                                    className="bg-white/5 hover:bg-white/10 text-slate-200 font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    VOLTAR
                                </button>

                                <button
                                    onClick={() => onVote(false)}
                                    disabled={voting}
                                    className="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-bold py-4 rounded-2xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    {voting ? <Loader2 className="w-6 h-6 animate-spin" /> : <XCircle className="w-6 h-6" />}
                                    CONFIRMAR
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationTask;
