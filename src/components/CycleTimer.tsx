import { useState, useEffect } from 'react';
import { Clock, RefreshCw, CalendarClock } from 'lucide-react';
import { useCycleTimer } from '../hooks/useCycleTimer';

interface CycleTimerProps {
    compact?: boolean;
}

export const CycleTimer = ({ compact = false }: CycleTimerProps) => {
    const { cycleInfo, loading, formatTime, timeRemaining } = useCycleTimer();
    const [gapRemaining, setGapRemaining] = useState(0);

    useEffect(() => {
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            console.log('CycleTimer Debug:', { timeRemaining, cycleInfo });
        }

        if (timeRemaining === 0 && cycleInfo && cycleInfo.nextCycleStartAt) {
            const nextStart = cycleInfo.nextCycleStartAt;
            const updateGap = () => {
                const now = new Date().getTime();
                const next = new Date(nextStart).getTime();
                setGapRemaining(Math.max(0, next - now));
            };

            updateGap();
            const interval = setInterval(updateGap, 1000);
            return () => clearInterval(interval);
        }
    }, [timeRemaining, cycleInfo]);

    if (loading || !cycleInfo) {
        return null;
    }

    const isBreakTime = timeRemaining === 0;
    const displayTime = isBreakTime ? gapRemaining : timeRemaining;
    const { hours, minutes, seconds } = formatTime(displayTime);
    const isLowTime = !isBreakTime && timeRemaining < 3600000;

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${isLowTime ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}>
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{hours}:{minutes}:{seconds}</span>
            </div>
        );
    }

    const formatEndTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const totalDuration = new Date(cycleInfo.cycleEndAt).getTime() - new Date(cycleInfo.cycleStartAt).getTime();
    const elapsedTime = totalDuration - timeRemaining;
    const progressPercentage = Math.min(100, Math.max(0, (elapsedTime / totalDuration) * 100));

    // Determine colors
    // Determine colors
    let bgBase: string, textBase: string, iconBase: string, bgLow: string, textLow: string;

    if (isBreakTime) {
        // Break/Waiting Mode (Amber/Orange)
        bgBase = 'bg-amber-950/40 border-amber-500/20';
        bgLow = 'bg-amber-500/10';
        textBase = 'text-amber-400';
        textLow = 'text-amber-300';
        iconBase = 'text-amber-400';
    } else if (isLowTime) {
        // Low Time Mode (Red)
        bgBase = 'bg-red-950/40 border-red-500/20';
        bgLow = 'bg-red-500/10';
        textBase = 'text-red-400';
        textLow = 'text-red-300';
        iconBase = 'text-red-400';
    } else {
        // Normal Mode (Purple)
        bgBase = 'bg-purple-950/40 border-purple-500/20';
        bgLow = 'bg-purple-500/10';
        textBase = 'text-purple-400';
        textLow = 'text-slate-500';
        iconBase = 'text-purple-400';
    }

    return (
        <div className={`relative w-full backdrop-blur-md border-b transition-colors overflow-hidden ${bgBase}`}>

            <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-700/30 via-amber-500/30 to-yellow-400/40 shadow-[0_0_20px_rgba(251,191,36,0.3)] border-r border-yellow-400/30 transition-all duration-1000 ease-linear backdrop-brightness-125"
                style={{ width: `${progressPercentage}%` }}
            />

            <div className="relative z-10 max-w-md mx-auto px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center ${bgLow}`}>
                            {isBreakTime ? (
                                <CalendarClock className={`w-5 h-5 ${iconBase}`} />
                            ) : (
                                <RefreshCw className={`w-5 h-5 ${iconBase} ${timeRemaining < 60000 ? 'animate-spin' : ''}`} />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {isBreakTime ? 'Próximo Ciclo' : `Ciclo #${cycleInfo.currentCycleNumber}`}
                            </p>
                            <p className={`text-[10px] ${textLow} font-bold`}>
                                {isBreakTime
                                    ? `Inicia às ${formatEndTime(cycleInfo.nextCycleStartAt)}`
                                    : `Encerra às ${formatEndTime(cycleInfo.cycleEndAt)}`}
                            </p>
                        </div>
                    </div>

                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${bgLow}`}>
                        <span translate="no" className={`notranslate text-lg font-black ${textBase} font-mono`}>
                            {hours}
                        </span>
                        <span className={`text-[8px] font-bold ${textLow} uppercase`}>h</span>
                    </div>
                    <span className={`text-lg font-black ${textBase} mx-1`}>
                        :
                    </span>
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${bgLow}`}>
                        <span translate="no" className={`notranslate text-lg font-black ${textBase} font-mono`}>
                            {minutes}
                        </span>
                        <span className={`text-[8px] font-bold ${textLow} uppercase`}>m</span>
                    </div>
                    <span className={`text-lg font-black ${textBase} mx-1`}>
                        :
                    </span>
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${bgLow}`}>
                        <span translate="no" className={`notranslate text-lg font-black ${textBase} font-mono`}>
                            {seconds}
                        </span>
                        <span className={`text-[8px] font-bold ${textLow} uppercase`}>s</span>
                    </div>
                </div>
            </div>

            {isLowTime && (
                <div className="relative z-10 mt-2 flex items-center gap-2 text-xs text-red-300 bg-red-500/5 px-3 py-1.5 rounded-xl border border-red-500/10 mx-6 mb-3">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-bold">O próximo ciclo iniciará logo após o término deste.</span>
                </div>
            )}

            {isBreakTime && (
                <div className="relative z-10 mt-2 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10 mx-6 mb-3">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <span className="font-bold">Ciclo encerrado. Aguardando início do próximo.</span>
                </div>
            )}
        </div>
    );
};
