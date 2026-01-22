import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { NewsTask } from '../types';

interface NewsCarouselProps {
    tasks: NewsTask[];
    onValidate: (task: NewsTask) => void;
    isReadOnly?: boolean;
    autoPlay?: boolean;
    interval?: number;
}

export const NewsCarousel: React.FC<NewsCarouselProps> = ({ tasks, onValidate, isReadOnly = false, autoPlay = false, interval = 3000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Reset index if tasks change significantly or shrink
    useEffect(() => {
        if (currentIndex >= tasks.length) {
            setCurrentIndex(0);
        }
    }, [tasks.length]);

    // AutoPlay Effect
    useEffect(() => {
        if (!autoPlay || isPaused || tasks.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev < tasks.length - 1 ? prev + 1 : 0));
        }, interval);

        return () => clearInterval(timer);
    }, [autoPlay, isPaused, interval, tasks.length]);

    // Swipe Refs
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const touchEndRef = useRef<{ x: number, y: number } | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        touchEndRef.current = null;
        touchStartRef.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const onTouchMove = (e: React.TouchEvent) => {
        touchEndRef.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const onTouchEnd = () => {
        if (!touchStartRef.current || !touchEndRef.current) return;

        const distanceX = touchStartRef.current.x - touchEndRef.current.x;
        const distanceY = touchStartRef.current.y - touchEndRef.current.y;

        // Horizontal dominance check
        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            const isLeftSwipe = distanceX > minSwipeDistance;
            const isRightSwipe = distanceX < -minSwipeDistance;

            if (isLeftSwipe && currentIndex < tasks.length - 1) {
                setCurrentIndex(prev => prev + 1);
            }

            if (isRightSwipe && currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
            }
        }
    };

    const nextTask = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex < tasks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const prevTask = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="bg-[#1A1040] p-8 rounded-3xl border border-white/5 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg">Tudo limpo!</h3>
                    <p className="text-slate-400 text-sm mt-1">Nenhuma notícia disponível no momento.</p>
                </div>
            </div>
        );
    }

    const currentTask = tasks[currentIndex];

    return (
        <div className="w-full">
            {/* Header / Controls */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    {/* Optional Header Content passed via Children could go here, but strict props for now */}
                </div>
                {tasks.length > 1 && (
                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 backdrop-blur-sm">
                        <button
                            onClick={prevTask}
                            disabled={currentIndex === 0}
                            className={`p-1 rounded-md transition-colors ${currentIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-white hover:bg-white/10'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <span className="text-xs font-mono text-slate-300 px-2 flex items-center">
                            {currentIndex + 1}/{tasks.length}
                        </span>
                        <button
                            onClick={nextTask}
                            disabled={currentIndex === tasks.length - 1}
                            className={`p-1 rounded-md transition-colors ${currentIndex === tasks.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-white hover:bg-white/10'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Card */}
            <div
                onTouchStart={(e) => { setIsPaused(true); onTouchStart(e); }}
                onTouchMove={onTouchMove}
                onTouchEnd={() => { setIsPaused(false); onTouchEnd(); }}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onClick={() => !isReadOnly && onValidate(currentTask)}
                className={`bg-[#1A1040] rounded-3xl overflow-hidden border border-white/5 shadow-xl transition-all relative touch-pan-y group ${!isReadOnly ? 'cursor-pointer hover:border-purple-500/50' : ''}`}
            >
                {/* Background Watermark Logo for the Card */}
                <img
                    src="/logo.png?v=2"
                    alt=""
                    className="absolute bottom-0 right-0 w-3/4 opacity-[0.07] pointer-events-none select-none grayscale invert -mr-12 -mb-12"
                />

                {/* Image Overlay */}
                <div className="h-48 w-full bg-slate-800 relative">
                    {currentTask.content.image_url ? (
                        <img
                            src={currentTask.content.image_url}
                            alt={currentTask.content.title}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                            <span className="text-purple-300 text-xs font-bold uppercase tracking-wider">Sem Imagem</span>
                        </div>
                    )}

                    {/* Tags */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        {currentTask.difficulty && (
                            <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
                                {currentTask.difficulty}
                            </span>
                        )}
                        <span className="px-2 py-1 rounded-md bg-purple-600/90 backdrop-blur-md border border-purple-400/20 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">
                            + R$ {currentTask.content.reward.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${isReadOnly ? 'bg-slate-400' : 'bg-green-400 animate-pulse'}`}></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {currentTask.content.source} • {new Date(currentTask.created_at).toLocaleDateString('pt-BR')}
                        </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 leading-tight line-clamp-2 group-hover:text-purple-300 transition-colors drop-shadow-sm">
                        {currentTask.content.title}
                    </h3>

                    <p className="text-slate-300 text-sm line-clamp-3 mb-6 leading-relaxed">
                        {currentTask.content.description}
                    </p>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onValidate(currentTask);
                        }}
                        className={`w-full font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${isReadOnly
                            ? 'bg-white/10 text-white hover:bg-white/20'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20'
                            }`}
                    >
                        {isReadOnly ? 'Avaliar Agora' : 'VALIDAR NOTÍCIA'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Navigation Bar / Indicators */}
            {tasks.length > 1 && (
                <div className="mt-4 px-4 w-full">
                    {/* The "Bar" Indicator requested by user */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative mb-2">
                        <div
                            className="absolute top-0 left-0 h-full bg-purple-500 transition-all duration-300 rounded-full"
                            style={{
                                width: `${100 / tasks.length}%`,
                                left: `${(currentIndex / tasks.length) * 100}%`
                            }}
                        />
                    </div>

                    {/* Helper text and center dots */}
                    <div className="flex flex-col items-center">
                        <div className="flex gap-1.5 mb-1">
                            {Array.from({ length: Math.min(5, tasks.length) }).map((_, idx) => {
                                let start = 0;
                                if (tasks.length > 5) {
                                    if (currentIndex > 2) start = currentIndex - 2;
                                    if (start + 5 > tasks.length) start = tasks.length - 5;
                                }
                                const actualIdx = start + idx;
                                const isActive = actualIdx === currentIndex;
                                return (
                                    <div
                                        key={actualIdx}
                                        className={`transition-all duration-300 rounded-full ${isActive ? 'w-4 h-1 bg-purple-500' : 'w-1 h-1 bg-slate-600'}`}
                                    />
                                );
                            })}
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium">Deslize para ver mais</p>
                    </div>
                </div>
            )}
        </div>
    );
};
