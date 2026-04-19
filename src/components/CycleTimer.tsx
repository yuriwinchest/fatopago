import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useCycleTimer } from '../hooks/useCycleTimer';

interface CycleTimerProps {
    compact?: boolean;
}

export const CycleTimer = ({ compact = false }: CycleTimerProps) => {
    const { cycleInfo, loading, formatTime, timeRemaining } = useCycleTimer();
    const [gapRemaining, setGapRemaining] = useState(0);

    useEffect(() => {
        if (import.meta.env.DEV) {
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

    const totalDuration = new Date(cycleInfo.cycleEndAt).getTime() - new Date(cycleInfo.cycleStartAt).getTime();
    const elapsedTime = totalDuration - timeRemaining;
    const cycleProgressPercentage = Math.min(100, Math.max(0, (elapsedTime / totalDuration) * 100));

    const breakDuration = new Date(cycleInfo.nextCycleStartAt).getTime() - new Date(cycleInfo.cycleEndAt).getTime();
    const breakElapsed = Math.max(0, breakDuration - gapRemaining);
    const breakProgressPercentage = breakDuration > 0
        ? Math.min(100, Math.max(0, (breakElapsed / breakDuration) * 100))
        : 100;

    const progressPercentage = isBreakTime ? breakProgressPercentage : cycleProgressPercentage;
    const cycleEndLabel = new Date(cycleInfo.cycleEndAt).toLocaleString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    const nextCycleLabel = new Date(cycleInfo.nextCycleStartAt).toLocaleString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const mode: 'active' | 'hurry' | 'break' = isBreakTime ? 'break' : (isLowTime ? 'hurry' : 'active');

    const theme = {
        active: {
            base: 'border-[#0b1536] bg-gradient-to-r from-[#0b1634] via-[#21124f] to-[#0b1a40]',
            overlay: 'bg-[radial-gradient(120%_90%_at_12%_0%,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_55%)]',
            stroke: 'border-white/10',
            box: 'bg-[#0b132d]/65 border-white/10',
            boxLabel: 'text-slate-200/70',
            boxValue: 'text-white',
            title: 'text-white',
            subtitle: 'text-white/80',
            progress: 'text-white/70',
            fill: 'from-cyan-400 via-indigo-400 to-fuchsia-500'
        },
        hurry: {
            base: 'border-[#3a0a16] bg-gradient-to-r from-[#2b0710] via-[#2b0a16] to-[#2a0b05]',
            overlay: 'bg-[radial-gradient(120%_90%_at_12%_0%,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_55%)]',
            stroke: 'border-white/10',
            box: 'bg-black/35 border-white/10',
            boxLabel: 'text-rose-100/80',
            boxValue: 'text-white',
            title: 'text-white',
            subtitle: 'text-rose-100/85',
            progress: 'text-rose-100/80',
            fill: 'from-rose-500 via-orange-500 to-amber-400'
        },
        break: {
            base: 'border-[#3a240a] bg-gradient-to-r from-[#2a1a06] via-[#201a0c] to-[#07201a]',
            overlay: 'bg-[radial-gradient(120%_90%_at_12%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_55%)]',
            stroke: 'border-white/10',
            box: 'bg-black/30 border-white/10',
            boxLabel: 'text-amber-100/80',
            boxValue: 'text-white',
            title: 'text-white',
            subtitle: 'text-amber-100/85',
            progress: 'text-amber-100/80',
            fill: 'from-amber-400 via-lime-300 to-emerald-400'
        }
    }[mode];

    return (
        <div className={`relative w-full overflow-hidden border-b backdrop-blur-md ${theme.base}`}>
            <div className={`pointer-events-none absolute inset-0 ${theme.overlay}`} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

            {/* Bottom progress line (like the screenshot "Ciclo: 90%") */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/25" />
            <div
                className={`pointer-events-none absolute left-0 bottom-0 h-[3px] bg-gradient-to-r ${theme.fill} transition-[width] duration-700 ease-out`}
                style={{ width: `${progressPercentage}%` }}
            />

            <div className="relative z-10 mx-auto flex max-w-md items-center justify-between gap-4 px-[calc(1rem+env(safe-area-inset-left))] py-3.5 pr-[calc(1rem+env(safe-area-inset-right))] sm:px-6 sm:py-4 md:px-8 lg:max-w-[1200px] lg:px-10">
                <div className="min-w-0">
                    <p className={`truncate text-[17px] font-black leading-tight tracking-tight ${theme.title} sm:text-xl lg:text-2xl`}>
                        {isBreakTime ? 'INTERVALO' : `CICLO: ${cycleInfo.currentCycleNumber}`}
                        <span className="hidden sm:inline">
                            {isBreakTime ? ' - Tempo restante para início do próximo ciclo' : ' - Tempo restante para fim deste ciclo'}
                        </span>
                    </p>
                    <p className={`mt-1 text-[14px] font-bold leading-tight ${theme.subtitle} sm:hidden`}>
                        {isBreakTime ? 'Tempo restante para início do próximo ciclo' : 'Tempo restante para fim deste ciclo'}
                    </p>
                    <p className={`mt-1 text-[11px] font-bold leading-tight ${theme.subtitle}`}>
                        {isBreakTime ? `Reabre em ${nextCycleLabel}` : `Encerra em ${cycleEndLabel}`}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl border ${theme.box} sm:h-16 sm:w-16`}>
                        <span className={`text-[9px] font-black uppercase tracking-[0.22em] ${theme.boxLabel}`}>HORAS</span>
                        <span translate="no" className={`notranslate mt-0.5 font-mono text-xl font-black tabular-nums ${theme.boxValue} sm:text-2xl`}>{hours}</span>
                    </div>
                    <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl border ${theme.box} sm:h-16 sm:w-16`}>
                        <span className={`text-[9px] font-black uppercase tracking-[0.22em] ${theme.boxLabel}`}>MIN</span>
                        <span translate="no" className={`notranslate mt-0.5 font-mono text-xl font-black tabular-nums ${theme.boxValue} sm:text-2xl`}>{minutes}</span>
                    </div>
                    <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl border ${theme.box} sm:h-16 sm:w-16`}>
                        <span className={`text-[9px] font-black uppercase tracking-[0.22em] ${theme.boxLabel}`}>SEG</span>
                        <span translate="no" className={`notranslate mt-0.5 font-mono text-xl font-black tabular-nums ${theme.boxValue} sm:text-2xl`}>{seconds}</span>
                    </div>
                </div>

                <div className={`absolute bottom-1 right-3 text-[11px] font-bold ${theme.progress} sm:right-4`}>
                    {isBreakTime ? 'Intervalo' : 'Ciclo'}: {Math.round(progressPercentage)}%
                </div>
            </div>
        </div>
    );
};
