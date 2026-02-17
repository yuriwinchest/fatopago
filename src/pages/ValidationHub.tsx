import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Clock,
    Filter,
    Loader2,
    Sparkles,
    X
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useValidationHub } from '../hooks/useValidationHub';
import { getPlanAccessForCurrentUser } from '../lib/planService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/classNames';
import { NewsTask } from '../types';

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
        loadingMore,
        hasMore,
        loadMore,
        retry
    } = useValidationHub();

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const getDifficultyColor = (diff: string) => {
        switch (diff) {
            case 'easy':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'medium':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'hard':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            default:
                return 'bg-slate-500/20 text-slate-400 border-white/10';
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        if (difficulty === 'hard') return 'Dificil';
        if (difficulty === 'medium') return 'Medio';
        return 'Facil';
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
            setCycleModalMessage(access.message || 'Aguarde o proximo ciclo para validar.');
            setShowCycleModal(true);
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'no-plan' || access.status === 'exhausted') {
            navigate(`/plans?reason=no-balance&returnTo=/validation/task/${taskId}`);
            setCheckingPlan(false);
            return;
        }

        setPlanNotice(access.status === 'error' ? access.message : 'Nao foi possivel verificar seu plano.');
        navigate(`/plans?reason=error&returnTo=/validation/task/${taskId}`);
        setCheckingPlan(false);
    };

    const hardCount = filteredTasks.filter(task => task.content.difficulty === 'hard').length;

    const renderTaskCard = (task: NewsTask, mode: 'mobile' | 'desktop') => (
        <article
            key={task.id}
            className={cn(
                'group relative overflow-hidden rounded-3xl border border-white/10 bg-[#1A1040] shadow-xl transition-all hover:border-[#9D5CFF]/50',
                mode === 'mobile'
                    ? 'shrink-0 snap-center w-[85vw] max-w-sm h-[420px] cursor-pointer'
                    : 'h-[420px]'
            )}
        >
            <div className="absolute inset-0 z-0 bg-slate-800">
                {task.content.image_url && (
                    <img
                        src={task.content.image_url}
                        alt={task.content.title}
                        className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0529] via-[#0F0529]/80 to-transparent" />
            </div>

            <div className="absolute left-4 top-4 z-10 flex gap-2">
                <span className={cn('rounded-full border px-2 py-1 text-[10px] font-bold uppercase backdrop-blur-md shadow-lg', getDifficultyColor(task.content.difficulty))}>
                    {getDifficultyLabel(task.content.difficulty)}
                </span>
                {task.content.reward >= 1.0 && (
                    <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                        Alta
                    </span>
                )}
            </div>

            <div className="relative z-10 flex h-full flex-col justify-end p-6">
                <div className="mb-2">
                    <div className="mb-2 flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', task.content.source.includes('G1') ? 'bg-red-500' : 'bg-blue-500')} />
                        <span className="rounded bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                            {task.content.source}
                        </span>
                    </div>
                    <h3 className="line-clamp-3 text-xl font-bold leading-tight text-white drop-shadow-md">
                        {task.content.title}
                    </h3>
                </div>

                <div className="-mx-6 -mb-6 flex items-center justify-between border-t border-white/10 bg-black/20 px-6 py-4 backdrop-blur-sm">
                    <div className="flex flex-col">
                        <span className="mb-0.5 text-[9px] font-bold uppercase text-zinc-400">Recompensa</span>
                        <span className="text-lg font-bold text-[#00E676]">{formatCurrency(task.content.reward)}</span>
                    </div>
                    <Button
                        onClick={() => handleValidateClick(task.id)}
                        disabled={checkingPlan}
                        className="min-h-0 rounded-xl px-5 py-3 text-xs"
                    >
                        {checkingPlan ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            'Avaliar'
                        )}
                    </Button>
                </div>
            </div>
        </article>
    );

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0F0529] text-white">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <AppLayout
            title="Painel de Validacao"
            subtitle="Escolha uma noticia para verificar"
            headerClassName="pb-4"
        >
            {showCycleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-md rounded-3xl border border-purple-500/30 bg-[#1A1040] p-8 shadow-2xl">
                        <div className="mb-6 flex items-start justify-between">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-500/40 bg-purple-500/20">
                                <Clock className="h-7 w-7 text-purple-400" />
                            </div>
                            <button
                                onClick={() => setShowCycleModal(false)}
                                className="rounded-full p-2 transition-colors hover:bg-white/10"
                                aria-label="Fechar"
                            >
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>

                        <h2 className="mb-3 text-2xl font-bold text-white">Ciclo nao disponivel</h2>
                        <p className="mb-6 text-sm leading-relaxed text-slate-300">{cycleModalMessage}</p>

                        <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
                            <p className="text-xs leading-relaxed text-purple-200">
                                Os ciclos de validacao duram 24 horas. Apos cada ciclo, ha intervalo de 30 minutos antes do proximo.
                            </p>
                        </div>

                        <Button onClick={() => setShowCycleModal(false)} fullWidth>
                            Entendi
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {(error || planNotice) && (
                    <Card tone="soft" className="flex items-start gap-4 border-yellow-500/40 bg-yellow-500/10 p-5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-yellow-500/30 bg-yellow-500/20">
                            <Filter className="h-5 w-5 text-yellow-300" />
                        </div>
                        <div className="flex-1">
                            <p className="mb-1 text-sm font-bold text-yellow-100">Atencao</p>
                            <p className="text-sm text-yellow-50">{planNotice || error}</p>
                        </div>
                        {error && (
                            <Button variant="secondary" className="min-h-0 px-4 py-2 text-xs" onClick={retry}>
                                Recarregar
                            </Button>
                        )}
                    </Card>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <aside className="space-y-4 lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 lg:self-start">
                        <Card tone="default" className="hidden border-white/10 bg-[#1A1040] p-4 lg:block">
                            <div className="mb-3 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-300" />
                                <h4 className="text-sm font-bold text-white">Categorias</h4>
                            </div>
                            <div className="space-y-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => selectCategory(cat)}
                                        className={cn(
                                            'w-full rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all',
                                            selectedCategory === cat
                                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/20 text-white'
                                                : 'border-white/10 bg-[#120a2a] text-slate-300 hover:border-white/20'
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </aside>

                    <section className="space-y-4 lg:col-span-8 xl:col-span-9">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => selectCategory(cat)}
                                    className={cn(
                                        'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-all',
                                        selectedCategory === cat
                                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-[0_0_15px_rgba(157,92,255,0.4)]'
                                            : 'border-white/10 bg-[#1A1040] text-slate-400 hover:bg-white/5'
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Noticias para validar</h3>
                                    <p className="text-xs text-slate-400">
                                        Categoria atual: <span className="font-bold text-slate-200">{selectedCategory}</span>
                                    </p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                                    Dificeis: <span className="font-bold text-white">{hardCount}</span>
                                </div>
                            </div>
                        </Card>

                        {filteredTasks.length > 0 ? (
                            <>
                                <div className="relative group/carousel lg:hidden">
                                    <button
                                        aria-label="Scroll left"
                                        title="Scroll left"
                                        onClick={() => handleScroll('left')}
                                        className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2 text-white backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100 md:block lg:hidden"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>

                                    <button
                                        aria-label="Scroll right"
                                        title="Scroll right"
                                        onClick={() => handleScroll('right')}
                                        className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/60 p-2 text-white backdrop-blur-sm transition-opacity group-hover/carousel:opacity-100 md:block lg:hidden"
                                    >
                                        <ArrowLeft className="h-5 w-5 rotate-180" />
                                    </button>

                                    <div
                                        ref={scrollContainerRef}
                                        onScroll={handleUserScroll}
                                        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-8 scrollbar-hide overscroll-x-contain scroll-smooth touch-pan-x"
                                        aria-label="Carrossel de noticias"
                                    >
                                        {filteredTasks.map(task => renderTaskCard(task, 'mobile'))}
                                    </div>
                                </div>

                                <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                                    {filteredTasks.map(task => renderTaskCard(task, 'desktop'))}
                                </div>
                            </>
                        ) : (
                            <Card tone="soft" className="py-12 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                    <Filter className="h-8 w-8 text-slate-600" />
                                </div>
                                <h3 className="mb-1 font-bold text-slate-200">Nenhuma noticia encontrada</h3>
                                <p className="text-xs text-slate-500">Tente selecionar outra categoria.</p>
                            </Card>
                        )}

                        {loadingMore && (
                            <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando mais noticias...
                            </div>
                        )}

                        {hasMore && filteredTasks.length > 0 && (
                            <div className="hidden justify-center lg:flex">
                                <Button
                                    variant="secondary"
                                    className="px-6"
                                    onClick={() => void loadMore()}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                                </Button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
};

export default ValidationHub;
