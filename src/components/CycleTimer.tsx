import { Clock, RefreshCw } from 'lucide-react';
import { useCycleTimer } from '../hooks/useCycleTimer';

interface CycleTimerProps {
    compact?: boolean;
}

export const CycleTimer = ({ compact = false }: CycleTimerProps) => {
    const { cycleInfo, loading, formatTime, timeRemaining } = useCycleTimer();

    if (loading || !cycleInfo) {
        return null;
    }

    const { hours, minutes, seconds } = formatTime(timeRemaining);
    const isLowTime = timeRemaining < 3600000;

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

    return (
        <div className={`relative w-full backdrop-blur-md border-b transition-colors overflow-hidden ${isLowTime
            ? 'bg-red-950/40 border-red-500/20'
            : 'bg-purple-950/40 border-purple-500/20'
            }`}>

            {/* Background Progress Fill */}
            <div
                className="absolute top-0 left-0 h-full bg-orange-500/20 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercentage}%` }}
            />

            <div className="relative z-10 max-w-md mx-auto px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center ${isLowTime
                            ? 'bg-red-500/10'
                            : 'bg-purple-500/10'
                            }`}>
                            <RefreshCw className={`w-5 h-5 ${isLowTime ? 'text-red-400' : 'text-purple-400'
                                } ${timeRemaining < 60000 ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Ciclo #{cycleInfo.currentCycleNumber}
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold">
                                {timeRemaining === 0
                                    ? 'Aguardando início do próximo ciclo...'
                                    : `Encerra às ${formatEndTime(cycleInfo.cycleEndAt)}`}
                            </p>
                        </div>
                    </div>

                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${isLowTime ? 'bg-red-500/10' : 'bg-white/5'
                        }`}>
                        <span translate="no" className={`notranslate text-lg font-black ${isLowTime ? 'text-red-400' : 'text-white'
                            } font-mono`}>
                            {hours}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">h</span>
                    </div>
                    <span className={`text-lg font-black ${isLowTime ? 'text-red-400' : 'text-slate-600'
                        } mx-1`}>
                        :
                    </span>
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${isLowTime ? 'bg-red-500/10' : 'bg-white/5'
                        }`}>
                        <span translate="no" className={`notranslate text-lg font-black ${isLowTime ? 'text-red-400' : 'text-white'
                            } font-mono`}>
                            {minutes}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">m</span>
                    </div>
                    <span className={`text-lg font-black ${isLowTime ? 'text-red-400' : 'text-slate-600'
                        } mx-1`}>
                        :
                    </span>
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${isLowTime ? 'bg-red-500/10' : 'bg-white/5'
                        }`}>
                        <span translate="no" className={`notranslate text-lg font-black ${isLowTime ? 'text-red-400' : 'text-white'
                            } font-mono`}>
                            {seconds}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">s</span>
                    </div>
                </div>
            </div>

            {isLowTime && (
                <div className="relative z-10 mt-2 flex items-center gap-2 text-xs text-red-300 bg-red-500/5 px-3 py-1.5 rounded-xl border border-red-500/10 mx-6 mb-3">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-bold">O próximo ciclo iniciará logo após o término deste.</span>
                </div>
            )}
        </div>
    );
};
