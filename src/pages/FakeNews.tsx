import { AlertTriangle, ExternalLink, RefreshCw, User, ChevronDown } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useFakeNews } from '../hooks/useFakeNews';
import { useState, useRef } from 'react';

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
            'politica': 'bg-red-500/10 text-red-400 border-red-500/20',
            'economia': 'bg-green-500/10 text-green-400 border-green-500/20',
            'saude': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            'tecnologia': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            'entretenimento': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
            'esportes': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        };
        return colors[category.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    const toggleCard = (id: string) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
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
            handleRefresh();
        }
        setPullDistance(0);
        startY.current = 0;
    };

    const SkeletonCard = () => (
        <div className="bg-[#1A1040] border border-white/5 rounded-3xl p-5 space-y-4 animate-pulse">
            <div className="w-full h-40 bg-white/5 rounded-2xl" />
            <div className="space-y-3">
                <div className="h-6 bg-white/5 rounded-lg w-3/4" />
                <div className="h-4 bg-white/5 rounded-lg w-full" />
                <div className="h-4 bg-white/5 rounded-lg w-5/6" />
            </div>
        </div>
    );

    if (loading) {
        return (
            <AppLayout title="Notícias Falsas" subtitle="Conteúdos verificados pela comunidade" showLogout={true}>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout title="Notícias Falsas" subtitle="Conteúdos verificados pela comunidade" showLogout={true}>
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-2xl px-4 py-3 flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Notícias Falsas" subtitle="Conteúdos verificados pela comunidade" showLogout={true}>
            <div 
                ref={containerRef}
                className="space-y-6 relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {pullDistance > 0 && (
                    <div 
                        className="absolute -top-12 left-0 right-0 flex justify-center transition-opacity"
                        style={{ opacity: Math.min(pullDistance / 60, 1) }}
                    >
                        <RefreshCw className={`w-6 h-6 text-purple-400 ${pullDistance > 60 ? 'animate-spin' : ''}`} />
                    </div>
                )}

                <div className="flex items-center justify-between sticky top-0 bg-[#0F0529] z-10 pb-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white">{fakeNews.length}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Notícias Falsas</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-purple-600/20 active:bg-purple-600/40 text-purple-300 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {fakeNews.length === 0 ? (
                    <div className="bg-[#1A1040] border border-white/5 rounded-3xl p-8 text-center animate-[fadeIn_0.5s_ease-out]">
                        <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 text-sm">Nenhuma notícia falsa identificada ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {fakeNews.map((item, index) => {
                            const isExpanded = expandedCards.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    className="bg-[#1A1040] border border-red-500/20 rounded-3xl overflow-hidden transition-all duration-300 hover:border-red-500/40 active:scale-[0.98]"
                                    style={{
                                        animation: `slideUp 0.4s ease-out ${index * 0.1}s backwards`
                                    }}
                                >
                                    <div className="p-5 space-y-4">
                                        {item.news_tasks.content.image_url && (
                                            <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-black/30 -m-5 mb-0">
                                                <img
                                                    src={item.news_tasks.content.image_url}
                                                    alt={item.news_tasks.content.title}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                <div className="absolute top-4 right-4">
                                                    <span className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-black uppercase shadow-2xl backdrop-blur-sm">
                                                        Falsa
                                                    </span>
                                                </div>
                                                <span className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md ${getCategoryColor(item.news_tasks.content.category)}`}>
                                                    {item.news_tasks.content.category}
                                                </span>
                                            </div>
                                        )}

                                        <div className={item.news_tasks.content.image_url ? 'pt-3' : ''}>
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="font-bold text-white text-base leading-snug flex-1">
                                                    {item.news_tasks.content.title}
                                                </h4>
                                                {!item.news_tasks.content.image_url && (
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getCategoryColor(item.news_tasks.content.category)}`}>
                                                        {item.news_tasks.content.category}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-slate-400 text-sm leading-relaxed mt-3 line-clamp-3">
                                                {item.news_tasks.content.description}
                                            </p>

                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-3 bg-white/5 px-3 py-2 rounded-xl">
                                                <span className="font-bold">Fonte:</span>
                                                <span className="truncate">{item.news_tasks.content.source}</span>
                                            </div>
                                        </div>

                                        {item.justification && (
                                            <button
                                                onClick={() => toggleCard(item.id)}
                                                className="w-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-2xl p-4 space-y-3 transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                                        <span className="font-bold text-red-300 text-xs uppercase tracking-wider">
                                                            Justificativa
                                                        </span>
                                                    </div>
                                                    <ChevronDown 
                                                        className={`w-5 h-5 text-red-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                                    />
                                                </div>
                                                
                                                <div 
                                                    className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                                >
                                                    <p className="text-slate-300 text-sm leading-relaxed text-left mb-3">
                                                        {item.justification}
                                                    </p>

                                                    {item.proof_link && (
                                                        <a
                                                            href={item.proof_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-xs font-bold transition-colors active:scale-95"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            Ver prova/fonte
                                                        </a>
                                                    )}
                                                </div>
                                            </button>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                                                    <User className="w-3.5 h-3.5 text-purple-400" />
                                                </div>
                                                <span className="text-purple-400 font-bold">
                                                    {item.profiles.name} {item.profiles.lastname}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-600 font-mono">
                                                {formatDate(item.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

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
