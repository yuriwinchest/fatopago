import { Trophy, MapPin, Loader2 } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useRanking } from '../hooks/useRanking';

const Ranking = () => {
    const { profiles, scope, setScope, loading } = useRanking();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <AppLayout
            title="Ranking Global"
            showBackButton={true}
        >
            {/* Scope Tabs */}
            <div className="mb-8 relative z-30">
                <div className="bg-[#1A1040] p-1 rounded-xl flex items-center border border-white/5 relative z-30">
                    <button
                        onClick={() => setScope('city')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'city' ? 'bg-[#9D5CFF] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Cidade
                    </button>
                    <button
                        onClick={() => setScope('state')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'state' ? 'bg-[#9D5CFF] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Estado
                    </button>
                    <button
                        onClick={() => setScope('national')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wide ${scope === 'national' ? 'bg-[#9D5CFF] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Brasil
                    </button>
                </div>
            </div>

            {/* Top 3 Podium */}
            <div className="flex items-end justify-center gap-4 mb-12 pt-12 relative">
                {/* Silver - 2nd */}
                {profiles[1] && (
                    <div className="flex flex-col items-center flex-1 order-1">
                        <div className="relative mb-3">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-300/10 border-2 border-slate-300 flex items-center justify-center text-xl font-bold text-slate-300">
                                {profiles[1].name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-500 shadow-lg z-10 whitespace-nowrap">
                                #2
                            </div>
                        </div>
                        <p className="font-bold text-sm w-full truncate text-center mt-1 text-white">{profiles[1].name}</p>
                        <p className="text-xs text-slate-400 font-mono font-medium">{profiles[1].reputation_score}</p>
                    </div>
                )}

                {/* Gold - 1st */}
                {profiles[0] && (
                    <div className="flex flex-col items-center flex-1 -mt-8 z-10 order-2">
                        <div className="relative mb-4">
                            <Trophy className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 fill-yellow-400/20 w-10 h-10 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] z-20 pointer-events-none" />
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 border-4 border-yellow-400 flex items-center justify-center text-4xl font-bold text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                                {profiles[0].name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-600 text-white text-xs font-bold px-4 py-1 rounded-full border border-yellow-400 shadow-lg z-20 whitespace-nowrap">
                                #1
                            </div>
                        </div>
                        <p className="font-bold text-lg text-yellow-100 w-full truncate text-center mt-2">{profiles[0].name}</p>
                        <p className="text-sm text-yellow-200/50 font-mono font-bold">{profiles[0].reputation_score} XP</p>
                    </div>
                )}

                {/* Bronze - 3rd */}
                {profiles[2] && (
                    <div className="flex flex-col items-center flex-1 order-3">
                        <div className="relative mb-3">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-600/10 border-2 border-amber-600 flex items-center justify-center text-xl font-bold text-amber-600">
                                {profiles[2].name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-600 shadow-lg z-10 whitespace-nowrap">
                                #3
                            </div>
                        </div>
                        <p className="font-bold text-sm w-full truncate text-center mt-1 text-white">{profiles[2].name}</p>
                        <p className="text-xs text-slate-400 font-mono font-medium">{profiles[2].reputation_score}</p>
                    </div>
                )}
            </div>

            {/* List Content */}
            <div className="bg-[#1A1040] rounded-[2.5rem] -mx-6 p-6 pb-8 relative z-0 shadow-inner border-t border-white/5">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />

                <div className="space-y-4">
                    {profiles.slice(3).map((profile, idx) => (
                        <div key={profile.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[#0F0529]/50 border border-white/5 active:scale-[0.98] transition-all">
                            <div className="font-bold text-slate-500 w-8 text-center text-sm">#{idx + 4}</div>
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg text-slate-300">
                                {profile.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-white truncate">{profile.name} {profile.lastname}</h3>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{profile.city}, {profile.state}</span>
                                </div>
                            </div>
                            <div className="text-right whitespace-nowrap">
                                <div className="font-bold text-purple-400 text-sm">{profile.reputation_score}</div>
                                <div className="text-[9px] text-slate-600 uppercase font-bold">pontos</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
};

export default Ranking;
