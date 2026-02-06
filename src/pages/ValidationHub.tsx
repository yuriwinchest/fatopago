import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Filter, CheckCircle, Clock, X } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useValidationHub } from '../hooks/useValidationHub';
import { getPlanAccessForCurrentUser } from '../lib/planService';
const ValidationHub = () => {
    const navigate = useNavigate();
    const [planNotice, setPlanNotice] = useState<string | null>(null);
    const [checkingPlan, setCheckingPlan] = useState(false);
    const [showCycleModal, setShowCycleModal] = useState(false);
    const [cycleModalMessage, setCycleModalMessage] = useState('');
    const {
        filteredTasks,
        loading,
        error,
        selectedCategory,
        selectCategory,
        CATEGORIES,
        scrollContainerRef,
        handleScroll,
        handleUserScroll,
        retry
    } = useValidationHub();

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const getDifficultyColor = (diff: string) => {
        switch (diff) {
            case 'easy': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'hard': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-white/10';
        }
    };

    const handleValidateClick = async (taskId: string) => {
        if (checkingPlan) return;
        setCheckingPlan(true);
        setPlanNotice(null);

        const access = await getPlanAccessForCurrentUser();
        if (access.status === 'ok') {
            navigate(`/validation/task/${taskId}`);
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'no-session') {
            navigate('/login');
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'cycle-break' || access.status === 'no-cycle') {
            setCycleModalMessage(access.message || 'Aguarde o próximo ciclo para validar.');
            setShowCycleModal(true);
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'no-plan' || access.status === 'exhausted') {
            navigate(`/plans?reason=no-balance&returnTo=/validation/task/${taskId}`);
            setCheckingPlan(false);
            return;
        }

        // Se chegou aqui, é erro ou status desconhecido - redireciona para planos
        setPlanNotice(access.status === 'error' ? access.message : 'Não foi possível verificar seu plano.');
        navigate(`/plans?reason=error&returnTo=/validation/task/${taskId}`);
        setCheckingPlan(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <AppLayout
            title="Painel de Validação"
            subtitle="Escolha uma notícia para verificar"
            headerClassName="pb-4"
        >
            {(error || planNotice) && (
                <div className="mb-6 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-2xl p-5 flex items-start gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-yellow-200 mb-1">Atenção</p>
                        <p className="text-sm text-yellow-100">{planNotice || error}</p>
                    </div>
                    {error && (
                        <button
                            onClick={retry}
                            className="shrink-0 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                            Recarregar
                        </button>
                    )}

                    {/* Cycle Info Modal */}
                    {showCycleModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-[#1A1040] border border-purple-500/30 rounded-3xl p-8 max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-purple-500/40">
                                        <Clock className="w-7 h-7 text-purple-400" />
                                    </div>
                                    <button
                                        onClick={() => setShowCycleModal(false)}
                                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                        aria-label="Fechar"
                                    >
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>

                                <h2 className="text-2xl font-bold text-white mb-3">
                                    Ciclo Não Disponível
                                </h2>

                                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                    {cycleModalMessage}
                                </p>

                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
                                    <p className="text-xs text-purple-200 leading-relaxed">
                                        <strong className="text-purple-300">ℹ️ Como funciona:</strong><br />
                                        Os ciclos de validação duram 24 horas. Após cada ciclo, há um intervalo de 30 minutos antes do próximo começar.
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowCycleModal(false)}
                                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                                >
                                    Entendi
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Stats Banner */}
            <div className="bg-gradient-to-r from-purple-900 to-[#1A1040] rounded-2xl p-5 border border-purple-500/30 mb-8 relative overflow-hidden shadow-xl">
                <div className="relative z-10 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 border border-green-500/30">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Validar Notícias</h3>
                        <p className="text-xs text-purple-200 mt-1 leading-relaxed max-w-[250px]">
                            Ganhe até <span className="font-bold text-white">R$ 1,20</span> por notícia validada corretamente. Sua precisão define seu ranking.
                        </p>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-32 h-32 bg-purple-600/20 blur-3xl rounded-full -mr-10 -mt-10" />
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => selectCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === cat
                            ? 'bg-[#9D5CFF] text-white border-[#9D5CFF] shadow-[0_0_15px_rgba(157,92,255,0.4)]'
                            : 'bg-[#1A1040] text-slate-400 border-white/5 hover:bg-white/5'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Carousel Container */}
            <div className="relative group/carousel">
                <button
                    aria-label="Scroll left"
                    title="Scroll left"
                    onClick={() => handleScroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:block"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <button
                    aria-label="Scroll right"
                    title="Scroll right"
                    onClick={() => handleScroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:block"
                >
                    <ArrowLeft className="w-6 h-6 rotate-180" />
                </button>

                <div
                    ref={scrollContainerRef}
                    onScroll={handleUserScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-8 gap-4 overscroll-x-contain scroll-smooth touch-pan-x"
                    aria-label="Carrossel de notícias"
                >
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className="shrink-0 snap-center w-[85vw] max-w-sm h-[400px] bg-[#1A1040] rounded-3xl border border-white/10 overflow-hidden group hover:border-[#9D5CFF]/50 transition-all flex flex-col relative shadow-xl cursor-pointer"
                            role="group"
                        >
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0 bg-slate-800">
                                {task.content.image_url && (
                                    <img
                                        src={task.content.image_url}
                                        alt={task.content.title}
                                        className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0529] via-[#0F0529]/80 to-transparent" />
                            </div>

                            {/* Badge */}
                            <div className="absolute top-4 left-4 z-10 flex gap-2">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase backdrop-blur-md shadow-lg border ${getDifficultyColor(task.content.difficulty)}`}>
                                    {task.content.difficulty === 'hard' ? 'Difícil' : (task.content.difficulty === 'medium' ? 'Médio' : 'Fácil')}
                                </span>
                                {task.content.reward >= 1.0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg uppercase tracking-wider animate-pulse">
                                        Alta
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="relative z-10 p-6 flex flex-col h-full justify-end mt-auto">
                                <div className="mb-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${task.content.source.includes('G1') ? 'bg-red-500' : 'bg-blue-500'}`} />
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider backdrop-blur-sm bg-black/30 px-2 py-0.5 rounded">
                                            {task.content.source}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-xl text-white leading-tight mb-2 drop-shadow-md line-clamp-3">
                                        {task.content.title}
                                    </h3>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-white/10 bg-black/20 -mx-6 -mb-6 px-6 py-4 backdrop-blur-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Recompensa</span>
                                        <span className="text-lg font-bold text-[#00E676]">{formatCurrency(task.content.reward)}</span>
                                    </div>
                                    <button
                                        onClick={() => handleValidateClick(task.id)}
                                        disabled={checkingPlan}
                                        className={`text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 ${checkingPlan
                                            ? 'bg-gray-600 cursor-not-allowed'
                                            : 'bg-[#6D28D9] hover:bg-[#7C3AED] hover:scale-105 active:scale-95'
                                            }`}
                                        aria-label={`Avaliar notícia: ${task.content.title}`}
                                    >
                                        {checkingPlan ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Verificando...
                                            </>
                                        ) : (
                                            'Avaliar'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {filteredTasks.length === 0 && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-1">Nenhuma notícia encontrada</h3>
                    <p className="text-slate-500 text-xs">Tente selecionar outra categoria.</p>
                </div>
            )}
        </AppLayout>
    );
};

export default ValidationHub;
