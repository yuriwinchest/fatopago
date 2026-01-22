
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, MapPin, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profile {
    id: string;
    name: string;
    lastname: string;
    reputation_score: number;
    city: string;
    state: string;
}

const MOCK_PROFILES = [
    { id: '1', name: 'Ana', lastname: 'Silva', reputation_score: 985, city: 'São Paulo', state: 'SP' },
    { id: '2', name: 'Carlos', lastname: 'Oliveira', reputation_score: 950, city: 'Rio de Janeiro', state: 'RJ' },
    { id: '3', name: 'Marcos', lastname: 'Souza', reputation_score: 920, city: 'Belo Horizonte', state: 'MG' },
    { id: '4', name: 'Julia', lastname: 'Mendes', reputation_score: 890, city: 'Curitiba', state: 'PR' },
    { id: '5', name: 'Roberto', lastname: 'Lima', reputation_score: 850, city: 'Salvador', state: 'BA' },
];

const Ranking = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [scope, setScope] = useState<'city' | 'state' | 'national'>('national');

    useEffect(() => {
        const fetchRanking = async () => {
            setLoading(true);
            try {
                // In a real app, we would apply filters based on user location + scope here
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, lastname, reputation_score, city, state')
                    .order('reputation_score', { ascending: false })
                    .limit(50);

                if (error) console.error(error);

                if (!data || data.length === 0) {
                    setProfiles(MOCK_PROFILES);
                } else {
                    // Start with real data, maybe merge mock if too few?
                    // For now, if < 3 real users, pad with mock.
                    if (data.length < 3) {
                        const padded = [...data, ...MOCK_PROFILES.slice(0, 5 - data.length).map(p => ({ ...p, id: `mock-${p.id}` }))];
                        setProfiles(padded as any);
                    } else {
                        setProfiles(data);
                    }
                }
            } catch (err) {
                console.error(err);
                setProfiles(MOCK_PROFILES);
            } finally {
                setLoading(false);
            }
        };

        fetchRanking();
    }, [scope]);



    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (

        <div className="min-h-screen bg-[#0F0529] text-white font-sans flex flex-col">
            {/* Header - Fixed/Sticky with solid background to prevent overlap transparency issues */}
            <div className="relative z-30 bg-[#2e0259] rounded-b-[40px] shadow-2xl pb-2 pt-2">
                <div className="flex items-center justify-between px-6 py-4">
                    <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-slate-300" />
                    </button>
                    <h1 className="font-bold text-lg tracking-wide uppercase">Ranking Global</h1>
                    <div className="w-10" /> {/* Spacer for optical centering */}
                </div>

                {/* Scope Tabs - Inside Header to stick with it */}
                <div className="px-6 pb-4">
                    <div className="bg-[#1A1040] p-1 rounded-xl flex items-center border border-white/5">
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
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-safe-area-bottom">
                {/* Top 3 Podium */}
                <div className="flex items-end justify-center gap-4 mt-12 px-6 mb-12 pt-8">
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
                            <p className="font-bold text-sm w-full truncate text-center mt-1">{profiles[1].name}</p>
                            <p className="text-xs text-slate-400 font-mono font-medium">{profiles[1].reputation_score}</p>
                        </div>
                    )}

                    {/* Gold - 1st */}
                    {profiles[0] && (
                        <div className="flex flex-col items-center flex-1 -mt-12 z-10 order-2">
                            <div className="relative mb-4">
                                <Trophy className="absolute -top-12 left-1/2 -translate-x-1/2 text-yellow-400 fill-yellow-400/20 w-10 h-10 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
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
                            <p className="font-bold text-sm w-full truncate text-center mt-1">{profiles[2].name}</p>
                            <p className="text-xs text-slate-400 font-mono font-medium">{profiles[2].reputation_score}</p>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="bg-[#1A1040] rounded-t-[2.5rem] min-h-[50vh] p-6 pb-32 -mx-0 relative z-0 shadow-inner border-t border-white/5">
                    <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" /> {/* Handle bar aesthetic */}
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
            </div>
        </div>
    );
};

export default Ranking;
