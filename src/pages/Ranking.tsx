import { useState } from 'react';
import { MapPin, Loader2, Crown, ChevronDown } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useRanking } from '../hooks/useRanking';

const Ranking = () => {
    const { profiles, scope, setScope, loading } = useRanking();
    const [selectedState, setSelectedState] = useState('SP');
    const [selectedCity, setSelectedCity] = useState('São Paulo');

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const top3 = profiles.slice(0, 3);
    const others = profiles.slice(3);

    // Mock User "Me" Data (para a barra inferior)
    const myRank = {
        rank: 42,
        score: 1250,
        avatar: "https://i.pravatar.cc/150?u=me",
        name: "Você",
        city: "São Paulo",
        state: "SP"
    };

    return (
        <AppLayout title="Ranking" showBackButton={true}>
            <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-500 pb-24">

                {/* Controls Section (Sticky-ish behavior inside layout) */}
                <div className="sticky top-0 z-20 backdrop-blur-md bg-background/80 pt-2 pb-4 -mx-4 px-4 border-b border-white/5 mb-6">
                    {/* Segmented Control */}
                    <div className="flex p-1 bg-secondary/20 rounded-xl mb-3 border border-white/5">
                        <button
                            onClick={() => setScope('national')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 uppercase tracking-wide ${scope === 'national' ? 'bg-primary text-white shadow-md cursor-default' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Nacional
                        </button>
                        <button
                            onClick={() => setScope('state')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 uppercase tracking-wide ${scope === 'state' ? 'bg-primary text-white shadow-md cursor-default' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Estadual
                        </button>
                        <button
                            onClick={() => setScope('city')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 uppercase tracking-wide ${scope === 'city' ? 'bg-primary text-white shadow-md cursor-default' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Municipal
                        </button>
                    </div>

                    {/* Filters (Condicional) */}
                    {(scope === 'state' || scope === 'city') && (
                        <div className="flex gap-2 animate-in slide-in-from-top-2">
                            <div className="relative flex-1 group">
                                <select
                                    value={selectedState}
                                    onChange={(e) => setSelectedState(e.target.value)}
                                    className="w-full appearance-none bg-secondary/30 border border-white/10 rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all group-hover:bg-secondary/40 font-medium"
                                >
                                    <option value="SP" className="bg-background">São Paulo</option>
                                    <option value="RJ" className="bg-background">Rio de Janeiro</option>
                                    <option value="MG" className="bg-background">Minas Gerais</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>

                            {scope === 'city' && (
                                <div className="relative flex-1 group">
                                    <select
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="w-full appearance-none bg-secondary/30 border border-white/10 rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all group-hover:bg-secondary/40 font-medium"
                                    >
                                        <option value="São Paulo" className="bg-background">São Paulo</option>
                                        <option value="Campinas" className="bg-background">Campinas</option>
                                        <option value="Santos" className="bg-background">Santos</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Podium Top 3 */}
                <div className="flex items-end justify-center gap-2 sm:gap-4 mb-8 relative px-2">

                    {/* 2nd Place */}
                    {top3[1] && (
                        <div className="flex-1 flex flex-col items-center justify-end order-1">
                            <div className="relative mb-2">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-200 border-4 border-slate-300 flex items-center justify-center overflow-hidden shadow-lg">
                                    <img src={`https://i.pravatar.cc/150?u=${top3[1].id}`} alt={top3[1].name} className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-500 shadow-lg z-10 whitespace-nowrap">
                                    #2
                                </div>
                            </div>
                            <p className="font-bold text-xs sm:text-sm w-full truncate text-center mt-1 text-foreground/90">{top3[1].name.split(' ')[0]}</p>
                            <p className="text-[10px] sm:text-xs text-primary font-bold">{top3[1].reputation_score}</p>
                            {/* Podium Block */}
                            <div className="w-full h-16 bg-gradient-to-t from-slate-400/10 to-transparent mt-2 rounded-t-lg mx-auto max-w-[80px]" />
                        </div>
                    )}

                    {/* 1st Place */}
                    {top3[0] && (
                        <div className="flex-1 flex flex-col items-center justify-end z-10 -mt-8 order-2">
                            <div className="relative mb-3">
                                <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 fill-yellow-400 w-8 h-8 animate-bounce drop-shadow-md z-20 pointer-events-none" />
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 border-4 border-yellow-400 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.4)] ring-4 ring-yellow-400/20">
                                    <img src={`https://i.pravatar.cc/150?u=${top3[0].id}`} alt={top3[0].name} className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-950 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300 shadow-lg z-20 whitespace-nowrap">
                                    #1
                                </div>
                            </div>
                            <p className="font-bold text-sm sm:text-base text-yellow-500 w-full truncate text-center mt-2 px-1">{top3[0].name}</p>
                            <p className="text-xs sm:text-sm text-yellow-600/80 font-bold">{top3[0].reputation_score} pts</p>
                            {/* Podium Block */}
                            <div className="w-full h-24 bg-gradient-to-t from-yellow-400/10 to-transparent mt-2 rounded-t-lg mx-auto max-w-[100px]" />
                        </div>
                    )}

                    {/* 3rd Place */}
                    {top3[2] && (
                        <div className="flex-1 flex flex-col items-center justify-end order-3">
                            <div className="relative mb-2">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-700 border-4 border-amber-600 flex items-center justify-center overflow-hidden shadow-lg">
                                    <img src={`https://i.pravatar.cc/150?u=${top3[2].id}`} alt={top3[2].name} className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-amber-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-600 shadow-lg z-10 whitespace-nowrap">
                                    #3
                                </div>
                            </div>
                            <p className="font-bold text-xs sm:text-sm w-full truncate text-center mt-1 text-foreground/90">{top3[2].name.split(' ')[0]}</p>
                            <p className="text-[10px] sm:text-xs text-primary font-bold">{top3[2].reputation_score}</p>
                            {/* Podium Block */}
                            <div className="w-full h-12 bg-gradient-to-t from-amber-600/10 to-transparent mt-2 rounded-t-lg mx-auto max-w-[80px]" />
                        </div>
                    )}
                </div>

                {/* List Ranking */}
                <div className="space-y-3 px-1">
                    {others.map((profile, idx) => (
                        <div
                            key={profile.id}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-secondary/10 border border-white/5 active:scale-[0.98] active:bg-secondary/20 transition-all"
                        >
                            <div className="font-bold text-muted-foreground w-6 text-center text-sm">#{idx + 4}</div>
                            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-white/10">
                                <img src={`https://i.pravatar.cc/150?u=${profile.id}`} alt={profile.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-foreground truncate flex items-center gap-1">
                                    {profile.name} {profile.lastname}
                                </h3>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{profile.city || 'São Paulo'}, {profile.state || 'SP'}</span>
                                </div>
                            </div>
                            <div className="text-right whitespace-nowrap">
                                <div className="font-bold text-primary text-sm">{profile.reputation_score}</div>
                                <div className="text-[9px] text-muted-foreground font-medium lowercase">pts</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sticky "Me" Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50 pb-safe-bottom animate-in slide-in-from-bottom-5">
                <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />

                    <span className="w-8 text-center text-primary font-bold text-lg">
                        #{myRank.rank}
                    </span>

                    <img
                        src={myRank.avatar}
                        alt="Eu"
                        className="w-10 h-10 rounded-full object-cover border-2 border-primary shadow-sm"
                    />

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">Você</p>
                        <p className="text-xs text-muted-foreground truncate">{myRank.city}, {myRank.state}</p>
                    </div>

                    <div className="text-right pr-2">
                        <p className="text-lg font-bold text-primary">{myRank.score}</p>
                        <p className="text-[10px] text-muted-foreground -mt-1">pontos</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default Ranking;
