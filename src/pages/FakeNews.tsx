import { useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    ExternalLink,
    RefreshCw,
    ShieldAlert,
    User
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useFakeNews } from '../hooks/useFakeNews';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/classNames';

const FakeNews = () => {
    const { fakeNews, loading, error, refetch } = useFakeNews();
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const startY = useRef(0);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            politica: 'bg-red-500/10 text-red-400 border-red-500/20',
            economia: 'bg-green-500/10 text-green-400 border-green-500/20',
            saude: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            tecnologia: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            entretenimento: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
            esportes: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        };
        return colors[category.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    const categoryStats = useMemo(() => {
        const map = new Map<string, number>();
        fakeNews.forEach(item => {
            const key = item.news_tasks?.content?.category || 'Outros';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [fakeNews]);

    const toggleCard = (id: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current && containerRef.current && containerRef.current.scrollTop === 0) {
            const currentY = e.touches[0].clientY;
            const distance = currentY - startY.current;
            if (distance > 0 && distance < 100) {
                setPullDistance(distance);
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) {
            void handleRefresh();
        }
        setPullDistance(0);
        startY.current = 0;
    };

    if (loading) {
        return (
            <AppLayout title="Notícias Falsas" subtitle="Conteúdos validados pela comunidade" showLogout={true}>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} tone="default" className="space-y-4 border-white/10 bg-[#1A1040] p-5">
                            <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
                            <div className="space-y-3">
                                <div className="h-5 w-2/3 animate-pulse rounded bg-white/5" />
                                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                                <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                            </div>
                        </Card>
                    ))}
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Notícias Falsas" subtitle="Conteúdos validados pela comunidade" showLogout={true}>
            <div
                ref={containerRef}
                className="relative space-y-6"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {pullDistance > 0 && (
                    <div
                        className="absolute -top-12 left-0 right-0 z-20 flex justify-center transition-opacity"
                        style={{ opacity: Math.min(pullDistance / 60, 1) }}
                    >
                        <RefreshCw className={cn('h-6 w-6 text-purple-400', pullDistance > 60 && 'animate-spin')} />
                    </div>
                )}

                <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#0F0529]/95 pb-4 pt-1 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                            <ShieldAlert className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">{fakeNews.length}</h3>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notícias falsas</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => void handleRefresh()}
                        disabled={refreshing}
                        variant="secondary"
                        className="min-h-0 px-4 py-2.5 text-xs"
                        leftIcon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />}
                    >
                        Atualizar
                    </Button>
                </div>

                {error && (
                    <Card tone="soft" className="flex items-center gap-3 border-red-500/20 bg-red-500/10 p-4">
                        <AlertTriangle className="h-5 w-5 text-red-300" />
                        <p className="flex-1 text-sm text-red-100">{error}</p>
                        <Button variant="secondary" className="min-h-0 px-3 py-2 text-xs" onClick={() => void handleRefresh()}>
                            Tentar novamente
                        </Button>
                    </Card>
                )}

                {!error && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                        <aside className="space-y-4 xl:col-span-4">
                            <Card tone="elevated" className="border-red-500/20 bg-gradient-to-br from-[#2a103f] to-[#1A1040] p-5">
                                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-red-200">Panorama</h4>
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Total reportado</p>
                                        <p className="text-2xl font-black text-white">{fakeNews.length}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Com prova</p>
                                        <p className="text-2xl font-black text-white">
                                            {fakeNews.filter(item => !!item.proof_link || !!item.proof_image_url).length}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Top categorias</h4>
                                <div className="space-y-2">
                                    {categoryStats.length > 0 ? (
                                        categoryStats.map(item => (
                                            <div key={item.category} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                <span className="text-sm text-slate-200">{item.category}</span>
                                                <span className="text-xs font-bold text-white">{item.count}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500">Sem dados ainda.</p>
                                    )}
                                </div>
                            </Card>
                        </aside>

                        <section className="space-y-3 xl:col-span-8">
                            {fakeNews.length === 0 ? (
                                <Card tone="soft" className="py-12 text-center">
                                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                                    <p className="text-sm text-slate-400">Nenhuma notícia falsa identificada ainda.</p>
                                </Card>
                            ) : (
                                fakeNews.map(item => {
                                    const isExpanded = expandedCards.has(item.id);
                                    const news = item.news_tasks?.content;

                                    return (
                                        <Card
                                            key={item.id}
                                            tone="default"
                                            className="overflow-hidden border-red-500/20 bg-[#1A1040] p-0 transition-all hover:border-red-500/40"
                                        >
                                            <div className="p-5">
                                                {news?.image_url && (
                                                    <div className="relative mb-4 h-52 overflow-hidden rounded-2xl bg-black/30">
                                                        <img
                                                            src={news.image_url}
                                                            alt={news.title}
                                                            className="h-full w-full object-cover"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                        <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black uppercase text-white shadow-xl">
                                                            Falsa
                                                        </span>
                                                        <span className={cn(
                                                            'absolute left-4 top-4 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md',
                                                            getCategoryColor(news.category)
                                                        )}>
                                                            {news.category}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={news?.image_url ? '' : 'pt-1'}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <h4 className="flex-1 text-base font-bold leading-snug text-white">
                                                            {news?.title || 'Notícia indisponível'}
                                                        </h4>
                                                        {!news?.image_url && (
                                                            <span className={cn(
                                                                'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold',
                                                                getCategoryColor(news?.category || '')
                                                            )}>
                                                                {news?.category || 'Outros'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-400">
                                                        {news?.description}
                                                    </p>

                                                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-500">
                                                        <span className="font-bold">Fonte:</span>
                                                        <span className="truncate">{news?.source || 'Indisponível'}</span>
                                                    </div>
                                                </div>

                                                {item.justification && (
                                                    <button
                                                        onClick={() => toggleCard(item.id)}
                                                        className="mt-4 w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left transition-all hover:bg-red-500/15"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                                                <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                                                                    Justificativa
                                                                </span>
                                                            </div>
                                                            <ChevronDown className={cn('h-5 w-5 text-red-400 transition-transform', isExpanded && 'rotate-180')} />
                                                        </div>

                                                        <div className={cn(
                                                            'overflow-hidden transition-all duration-300',
                                                            isExpanded ? 'max-h-96 pt-3 opacity-100' : 'max-h-0 opacity-0'
                                                        )}>
                                                            <p className="mb-3 text-sm leading-relaxed text-slate-300">{item.justification}</p>
                                                            {item.proof_image_url && (
                                                                <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                                                    <img
                                                                        src={item.proof_image_url}
                                                                        alt="Foto da prova enviada pelo usuário"
                                                                        className="max-h-72 w-full object-cover"
                                                                        loading="lazy"
                                                                    />
                                                                </div>
                                                            )}
                                                            {item.proof_link && (
                                                                <a
                                                                    href={item.proof_link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="inline-flex items-center gap-2 text-xs font-bold text-purple-400 transition-colors hover:text-purple-300"
                                                                >
                                                                    <ExternalLink className="h-4 w-4" />
                                                                    Ver prova/fonte
                                                                </a>
                                                            )}
                                                        </div>
                                                    </button>
                                                )}

                                                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20">
                                                            <User className="h-3.5 w-3.5 text-purple-400" />
                                                        </div>
                                                        <span className="font-bold text-purple-400">
                                                            {item.profiles?.name} {item.profiles?.lastname}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-600">
                                                        {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </section>
                    </div>
                )}
            </div>

            <style>{`
                .line-clamp-3 {
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}</style>
        </AppLayout>
    );
};

export default FakeNews;
