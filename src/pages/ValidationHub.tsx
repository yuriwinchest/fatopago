import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Filter, CheckCircle } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useValidationHub } from '../hooks/useValidationHub';
const ValidationHub = () => {
    const navigate = useNavigate();
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
            {error && (
                <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-slate-300">{error}</p>
                    <button
                        onClick={retry}
                        className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                        Recarregar
                    </button>
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
                    onClick={() => handleScroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:block"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <button
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
                                        onClick={() => navigate(`/validation/task/${task.id}`)}
                                        className="bg-[#6D28D9] hover:bg-[#7C3AED] text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95"
                                        aria-label={`Avaliar notícia: ${task.content.title}`}
                                    >
                                        Avaliar
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
