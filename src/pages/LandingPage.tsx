import { ArrowRight, CheckCircle, Users, Wallet, PlayCircle, Star, AlertTriangle, Zap, Crown, Shield, Check, Clock, PlusCircle, RefreshCw, MapPin, Search, Globe, Map, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS_CONFIG } from '../lib/planRules';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

const LandingPage = () => {
    const navigate = useNavigate();
    const { states, cities, fetchCities } = useLocation();
    const [searchName, setSearchName] = useState('');
    const [searchState, setSearchState] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [foundUser, setFoundUser] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchName && !searchState && !searchCity) return;

        setIsSearching(true);
        setHasSearched(true);
        setFoundUser(null);

        try {
            let query = supabase.from('profiles').select('*');

            if (searchName) query = query.ilike('name', `%${searchName}%`);
            if (searchState) query = query.eq('state', searchState);
            if (searchCity) query = query.eq('city', searchCity);

            const { data, error } = await query.limit(1).maybeSingle();

            if (error) {
                console.error('Error searching user:', error);
            } else if (data) {
                setFoundUser(data);
            }
        } catch (e) {
            console.error('Search exception:', e);
        } finally {
            setIsSearching(false);
        }
    };


    const stats = [
        { label: 'Usuários Ativos', value: '150k+', icon: <Users className="w-5 h-5 text-purple-400" /> },
        { label: 'Prêmios Pagos', value: 'R$ 2M+', icon: <Wallet className="w-5 h-5 text-green-400" /> },
        { label: 'Notícias Validadas', value: '500k+', icon: <CheckCircle className="w-5 h-5 text-blue-400" /> },
    ];

    const steps = [
        {
            number: '1',
            title: 'Crie sua Conta',
            desc: 'Acesse nossa plataforma e faça seu cadastro em menos de 1 minuto.',
            footer: '01'
        },
        {
            number: '2',
            title: 'Escolha um Plano',
            desc: 'Selecione o plano ideal para suas metas de ganhos diários.',
            footer: '02'
        },
        {
            number: '3',
            title: 'Valide Notícias',
            desc: 'Analise fatos, valide e se for o primeiro no ranking de sua cidade receberá prêmio em dinheiro*',
            footer: '03'
        },
    ];

    const scrollToPlans = () => {
        const plansSection = document.getElementById('plans');
        if (plansSection) {
            plansSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans overflow-x-hidden selection:bg-purple-500/30">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-0 md:px-0">
                <div className="bg-[#2e0259] shadow-2xl border-b border-white/10 px-6 py-4 md:py-5 rounded-b-[32px] md:rounded-b-[45px] transition-all duration-300">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <img
                            src="/logo.png"
                            alt="Fatopago Logo"
                            className="h-8 md:h-12 drop-shadow-2xl hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        />
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="text-slate-300 hover:text-white font-bold text-sm transition-colors"
                            >
                                Entrar
                            </button>
                            <button
                                onClick={() => navigate('/register')}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 md:px-7 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                Criar Conta
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10" />

                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-bold text-purple-200">Plataforma #1 de Verificação de Notícias</span>
                    </div>

                    <h1 className="text-4xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
                        Veja quanto você pode <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">ganhar por</span> <span className="text-green-400">indicação</span>
                    </h1>

                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                        Ganhe dinheiro auxiliando na verificação de notícias e combata a desinformação. Simples, rápido e direto na sua conta. Comissão por indicação e prêmio para o primeiro do ranking.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <button
                            onClick={() => navigate('/register')}
                            className="w-full sm:w-auto bg-white text-[#0F0529] px-10 py-5 rounded-2xl font-black text-lg shadow-2xl hover:bg-purple-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                        >
                            COMEÇAR AGORA <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={scrollToPlans}
                            className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3 backdrop-blur-sm"
                        >
                            Ver Planos <PlayCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Ranking Section */}
                <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 relative z-20 mt-16">
                    {/* Cycle Status Banner */}
                    <div className="max-w-7xl mx-auto mb-8 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex relative">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            </div>
                            <p className="text-white text-sm font-bold flex items-center gap-2">
                                Ciclo Atual em Andamento <span className="text-slate-500 text-xs font-normal">•</span> <span className="text-purple-300 text-xs">Atualizando em tempo real</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                            <p className="text-xs text-slate-300 font-medium">
                                Último Fechamento: <span className="text-white font-bold">Hoje, 17:00</span>
                            </p>
                        </div>
                    </div>


                    {/* New: Check Personal Rank Card */}
                    <div className="bg-[#2E0259]/80 border border-purple-500/30 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full -z-10 pointer-events-none" />
                        <div className="flex flex-col xl:flex-row items-center gap-8 relative z-10">
                            <div className="flex-1 text-center xl:text-left">
                                <h3 className="text-2xl md:text-3xl font-black text-white mb-2">
                                    Consulte sua Posição
                                </h3>
                                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                                    Quer saber em que lugar você ou outro validador está no ranking da sua cidade?
                                    Pesquise agora e veja quantas notícias foram validadas.
                                </p>
                            </div>
                            <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                                <div className="relative w-full sm:w-64">
                                    <input
                                        type="text"
                                        value={searchName}
                                        onChange={(e) => setSearchName(e.target.value)}
                                        placeholder="Buscar pelo nome..."
                                        className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 pl-11 text-sm text-white focus:outline-none focus:border-purple-500 transition-all placeholder:text-slate-500"
                                    />
                                    <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                                </div>

                                <div className="relative w-full sm:w-32">
                                    <select
                                        value={searchState}
                                        onChange={(e) => {
                                            setSearchState(e.target.value);
                                            fetchCities(e.target.value);
                                        }}
                                        className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 pl-8 text-sm text-white focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">UF</option>
                                        {states.map(state => (
                                            <option key={state.id} value={state.sigla} className="bg-[#2E0259]">{state.sigla}</option>
                                        ))}
                                    </select>
                                    <Map className="w-4 h-4 text-slate-400 absolute left-3 top-4 pointer-events-none" />
                                </div>

                                <div className="relative w-full sm:w-48">
                                    <select
                                        value={searchCity}
                                        onChange={(e) => setSearchCity(e.target.value)}
                                        disabled={!searchState}
                                        className="w-full h-12 bg-black/30 border border-white/10 rounded-xl px-4 pl-9 text-sm text-white focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Cidade</option>
                                        {cities.map(city => (
                                            <option key={city.id} value={city.nome} className="bg-[#2E0259]">{city.nome}</option>
                                        ))}
                                    </select>
                                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-4 pointer-events-none" />
                                </div>

                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait shrink-0 w-full sm:w-auto"
                                >
                                    {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Consultar'}
                                </button>
                            </div>
                        </div>

                        {/* Search Results */}
                        {foundUser && (
                            <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                                <div className="relative shrink-0">
                                    <div className="w-16 h-16 rounded-full p-0.5 border-2 border-green-400">
                                        <img src={`https://ui-avatars.com/api/?name=${foundUser.name}&background=random`} alt={foundUser.name} className="w-full h-full rounded-full object-cover" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white font-bold text-lg">{foundUser.name} {foundUser.lastname || ''}</h4>
                                    <p className="text-slate-400 text-sm flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5" /> {foundUser.city}, {foundUser.state}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-green-400 font-black text-xl">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(foundUser.current_balance || 0)}</p>
                                    <p className="text-slate-500 text-xs font-bold uppercase">Saldo Atual</p>
                                </div>
                            </div>
                        )}

                        {hasSearched && !foundUser && !isSearching && (
                            <div className="mt-8 text-center text-slate-400 text-sm animate-in fade-in">
                                Nenhum validador encontrado com esses critérios.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1. Ranking Nacional */}
                        <div className="bg-[#1A0B2E] rounded-[32px] shadow-2xl border border-white/5 overflow-hidden flex flex-col hover:scale-[1.01] transition-transform duration-300 group">
                            <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Globe className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest">Ranking</p>
                                            <p className="text-lg font-black text-white leading-none">Nacional</p>
                                        </div>
                                    </div>
                                    <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">TOP 100</span>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[500px] px-4 py-4 space-y-2 custom-scrollbar">
                                {[
                                    { name: "Carlos Silva", loc: "São Paulo, SP", pts: "R$ 450,00", img: "https://i.pravatar.cc/150?u=1", rank: 1, count: 450 },
                                    { name: "Ana Pereira", loc: "Rio de Janeiro, RJ", pts: "R$ 380,50", img: "https://i.pravatar.cc/150?u=2", rank: 2, count: 380 },
                                    { name: "Marcos Souza", loc: "Curitiba, PR", pts: "R$ 310,25", img: "https://i.pravatar.cc/150?u=3", rank: 3, count: 310 },
                                    { name: "Pedro Santos", loc: "Salvador, BA", pts: "R$ 150,00", img: "https://i.pravatar.cc/150?u=5", rank: 4, count: 150 },
                                    { name: "Júlia Lima", loc: "Belo Horizonte, MG", pts: "R$ 290,00", img: "https://i.pravatar.cc/150?u=4", rank: 5, count: 290 },
                                    { name: "Roberto Junior", loc: "Campinas, SP", pts: "R$ 310,00", img: "https://i.pravatar.cc/150?u=6", rank: 6, count: 140 },
                                    { name: "Fernanda Costa", loc: "Santos, SP", pts: "R$ 280,50", img: "https://i.pravatar.cc/150?u=7", rank: 7, count: 125 },
                                ].map((user, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:bg-white/5 ${i === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20' : 'bg-transparent border-white/5'}`}>
                                        <div className="relative shrink-0">
                                            <div className={`w-10 h-10 rounded-full p-0.5 ${i === 0 ? 'border-2 border-yellow-400' : 'border border-white/10'}`}>
                                                <img src={user.img} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                            </div>
                                            {i === 0 && <Crown className="absolute -top-2 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400 animate-bounce" />}
                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border ${i === 0 ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{user.rank}</div>
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className={`text-sm font-bold truncate ${i === 0 ? 'text-yellow-100' : 'text-white'}`}>{user.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {user.loc}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className={`font-black text-sm ${i === 0 ? 'text-yellow-400' : 'text-green-400'}`}>{user.pts}</p>
                                            <p className="text-[10px] text-slate-500 font-medium bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5" /> {user.count}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Ranking Estadual */}
                        <div className="bg-[#1A0B2E] rounded-[32px] shadow-2xl border border-white/5 overflow-hidden flex flex-col hover:scale-[1.01] transition-transform duration-300 group">
                            <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                                            <Map className="w-4 h-4 text-pink-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-pink-300 font-bold uppercase tracking-widest">Ranking</p>
                                            <p className="text-lg font-black text-white leading-none">Estadual</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Filtrar estado..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 pl-9 text-xs text-white focus:outline-none focus:border-pink-500/50 transition-all placeholder:text-slate-500"
                                    />
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[500px] px-4 py-4 space-y-2 custom-scrollbar">
                                {/* Mocking SP State Data */}
                                {[
                                    { name: "Carlos Silva", loc: "São Paulo, SP", pts: "R$ 450,00", img: "https://i.pravatar.cc/150?u=1", rank: 1, count: 450 },
                                    { name: "Roberto Junior", loc: "Campinas, SP", pts: "R$ 310,00", img: "https://i.pravatar.cc/150?u=6", rank: 2, count: 310 },
                                    { name: "Fernanda Costa", loc: "Santos, SP", pts: "R$ 280,50", img: "https://i.pravatar.cc/150?u=7", rank: 3, count: 280 },
                                    { name: "Lucas Mota", loc: "São Paulo, SP", pts: "R$ 210,00", img: "https://i.pravatar.cc/150?u=8", rank: 4, count: 210 },
                                    { name: "Patricia Lima", loc: "Ribeirão Preto, SP", pts: "R$ 190,00", img: "https://i.pravatar.cc/150?u=9", rank: 5, count: 190 },
                                    { name: "Marcos Souza", loc: "São Paulo, SP", pts: "R$ 180,00", img: "https://i.pravatar.cc/150?u=3", rank: 6, count: 180 },
                                ].map((user, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:bg-white/5 ${i === 0 ? 'bg-gradient-to-r from-pink-500/10 to-transparent border-pink-500/20' : 'bg-transparent border-white/5'}`}>
                                        <div className="relative shrink-0">
                                            <div className={`w-10 h-10 rounded-full p-0.5 ${i === 0 ? 'border-2 border-pink-400' : 'border border-white/10'}`}>
                                                <img src={user.img} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                            </div>
                                            {i === 0 && <Crown className="absolute -top-2 -right-1 w-4 h-4 text-pink-400 fill-pink-400 animate-bounce" />}
                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border ${i === 0 ? 'bg-pink-500 text-black border-pink-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{user.rank}</div>
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className={`text-sm font-bold truncate ${i === 0 ? 'text-pink-100' : 'text-white'}`}>{user.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {user.loc}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className={`font-black text-sm ${i === 0 ? 'text-pink-400' : 'text-green-400'}`}>{user.pts}</p>
                                            <p className="text-[10px] text-slate-500 font-medium bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5" /> {user.count}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Ranking Municipal */}
                        <div className="bg-[#1A0B2E] rounded-[32px] shadow-2xl border border-white/5 overflow-hidden flex flex-col hover:scale-[1.01] transition-transform duration-300 group">
                            <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-widest">Ranking</p>
                                            <p className="text-lg font-black text-white leading-none">Municipal</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Filtrar cidade..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 pl-9 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-500"
                                    />
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[500px] px-4 py-4 space-y-2 custom-scrollbar">
                                {/* Mocking SP Capital Data */}
                                {[
                                    { name: "Carlos Silva", loc: "São Paulo, SP", pts: "R$ 450,00", img: "https://i.pravatar.cc/150?u=1", rank: 1, count: 450 },
                                    { name: "Lucas Mota", loc: "São Paulo, SP", pts: "R$ 210,00", img: "https://i.pravatar.cc/150?u=8", rank: 2, count: 210 },
                                    { name: "Amanda Nunes", loc: "São Paulo, SP", pts: "R$ 180,25", img: "https://i.pravatar.cc/150?u=10", rank: 3, count: 180 },
                                    { name: "Ricardo Gomes", loc: "São Paulo, SP", pts: "R$ 145,00", img: "https://i.pravatar.cc/150?u=11", rank: 4, count: 145 },
                                    { name: "Beatriz Alves", loc: "São Paulo, SP", pts: "R$ 120,50", img: "https://i.pravatar.cc/150?u=12", rank: 5, count: 120 },
                                    { name: "User 6", loc: "São Paulo, SP", pts: "R$ 110,00", img: "https://i.pravatar.cc/150?u=13", rank: 6, count: 110 },
                                    { name: "User 7", loc: "São Paulo, SP", pts: "R$ 90,00", img: "https://i.pravatar.cc/150?u=14", rank: 7, count: 90 },
                                ].map((user, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:bg-white/5 ${i === 0 ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/20' : 'bg-transparent border-white/5'}`}>
                                        <div className="relative shrink-0">
                                            <div className={`w-10 h-10 rounded-full p-0.5 ${i === 0 ? 'border-2 border-cyan-400' : 'border border-white/10'}`}>
                                                <img src={user.img} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                            </div>
                                            {i === 0 && <Crown className="absolute -top-2 -right-1 w-4 h-4 text-cyan-400 fill-cyan-400 animate-bounce" />}
                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border ${i === 0 ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{user.rank}</div>
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className={`text-sm font-bold truncate ${i === 0 ? 'text-cyan-100' : 'text-white'}`}>{user.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {user.loc}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className={`font-black text-sm ${i === 0 ? 'text-cyan-400' : 'text-green-400'}`}>{user.pts}</p>
                                            <p className="text-[10px] text-slate-500 font-medium bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5" /> {user.count}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="py-12 px-6 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="flex items-center justify-center gap-4 group">
                            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-purple-500/10 transition-colors">
                                {stat.icon}
                            </div>
                            <div className="text-left">
                                <p className="text-2xl font-black text-white">{stat.value}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Fake News Section */}
            <section className="py-16 px-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/10 blur-[120px] rounded-full -z-10" />
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gradient-to-br from-red-950/40 via-[#1A1040]/60 to-purple-950/40 border-2 border-red-500/20 rounded-[40px] p-8 md:p-12 relative overflow-hidden group hover:border-red-500/40 transition-all">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[80px] rounded-full" />

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-shrink-0">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-red-500/10 rounded-3xl flex items-center justify-center border-2 border-red-500/30 group-hover:scale-110 transition-transform">
                                    <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-red-400" />
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-2xl md:text-4xl font-black mb-3 flex items-center justify-center md:justify-start gap-3 flex-wrap">
                                    <span className="text-white">Notícias</span>
                                    <span className="text-red-400">Falsas Verificadas</span>
                                </h2>
                                <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
                                    Veja em tempo real as notícias que foram identificadas como falsas pela nossa comunidade de verificadores.
                                    <span className="text-white font-bold"> Transparência total</span> com justificativas e provas.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                                    <button
                                        onClick={() => navigate('/noticias-falsas')}
                                        className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-base shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <AlertTriangle className="w-5 h-5" />
                                        VER NOTÍCIAS FALSAS
                                    </button>
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                                        <span className="font-bold">Atualizado em tempo real</span>
                                    </div>
                                </div>
                            </div>

                            <div className="hidden lg:flex flex-col gap-3 w-64">
                                <div className="bg-black/30 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-400 font-bold mb-1">Política</p>
                                            <p className="text-sm text-white font-bold line-clamp-2">Informação verificada como falsa...</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/30 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-400 font-bold mb-1">Saúde</p>
                                            <p className="text-sm text-white font-bold line-clamp-2">Notícia desmentida pela comunidade...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-0 right-0 text-9xl font-black text-white/[0.02] pointer-events-none">
                            FAKE
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24 px-6 relative" id="how-it-works">
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full -z-10" />
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black mb-4">Como funciona o FatoPago?</h2>
                        <p className="text-slate-400 font-medium">Três passos simples para começar a ganhar após o ciclo de validação</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((step, i) => (
                            <div key={i} className="bg-[#1A1040]/30 border border-white/5 p-8 rounded-[32px] hover:border-purple-500/30 transition-all hover:bg-[#1A1040]/50 relative group flex flex-col">
                                <h1 className="text-5xl font-black text-purple-500/50 mb-4 group-hover:text-purple-500 transition-colors">{step.number}</h1>
                                <h3 className="text-xl font-bold mb-3 text-white">{step.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8">{step.desc}</p>
                                <div className="mt-auto text-2xl font-black text-white/[0.05] group-hover:text-purple-500/20 transition-colors">
                                    {step.footer}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Plans Section */}
            <section className="py-24 px-6 relative bg-white/[0.01]" id="plans">
                <div className="absolute top-1/2 left-0 w-72 h-72 bg-purple-600/10 blur-[100px] rounded-full -z-10" />
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full mb-4">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">Planos de Acesso</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black mb-4">Veja quanto você pode ganhar por indicação</h2>
                        <p className="text-slate-400 font-medium max-w-2xl mx-auto">
                            Ganhe dinheiro auxiliando na verificação de notícias e combata a desinformação. Simples, rápido e direto na sua conta. Comissão por indicação e prêmio para o primeiro do ranking.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        {/* Starter Plan */}
                        <div className="bg-[#1A1040]/40 border border-white/10 rounded-[40px] p-8 transition-all hover:scale-[1.02] hover:border-blue-500/30">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.starter.name}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-white">5 reais</span>
                                        <span className="text-slate-400 text-sm">( 10 noticias)</span>
                                    </div>
                                </div>
                                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-blue-400" />
                                </div>
                            </div>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <Check className="w-4 h-4 text-green-400" /> 10 notícias validadas por pacote
                                </li>
                                <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <Check className="w-4 h-4 text-green-400" /> 20% de comissão por indicação por cada pacote
                                </li>
                            </ul>
                            <button onClick={() => navigate('/register')} className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-white transition-all">
                                COMEÇAR AGORA
                            </button>
                        </div>

                        {/* Pro Plan (Recommended) */}
                        <div className="relative bg-gradient-to-br from-[#2E0259] to-[#0F0529] border-2 border-purple-500/50 rounded-[40px] p-10 shadow-2xl shadow-purple-500/20 scale-105 z-10">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full border border-white/20 shadow-lg uppercase tracking-widest">
                                RECOMENDADO
                            </div>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-purple-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.pro.name}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-white">10 reais</span>
                                        <span className="text-slate-400 text-sm">( 20 notícias)</span>
                                    </div>
                                </div>
                                <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                                    <Zap className="w-8 h-8 text-purple-400" />
                                </div>
                            </div>
                            <ul className="space-y-4 mb-10">
                                <li className="flex items-center gap-3 text-white text-sm font-bold">
                                    <Check className="w-5 h-5 text-green-400" /> 20 notícias validadas por pacote
                                </li>
                                <li className="flex items-center gap-3 text-white text-sm font-bold">
                                    <Check className="w-5 h-5 text-green-400" /> 20% de comissão por indicação por cada pacote
                                </li>
                            </ul>
                            <button onClick={() => navigate('/register')} className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl font-black text-white shadow-xl transition-all hover:scale-105 active:scale-95">
                                SELECIONAR PRO
                            </button>
                        </div>

                        {/* Expert Plan */}
                        <div className="bg-[#1A1040]/40 border border-white/10 rounded-[40px] p-8 transition-all hover:scale-[1.02] hover:border-amber-500/30">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.expert.name}</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-white">20 reais</span>
                                        <span className="text-slate-400 text-sm">( 40 notícias)</span>
                                    </div>
                                </div>
                                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                                    <Crown className="w-6 h-6 text-amber-400" />
                                </div>
                            </div>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <Check className="w-4 h-4 text-green-400" /> 40 notícias validadas por pacote
                                </li>
                                <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <Check className="w-4 h-4 text-green-400" /> 20% de comissão por indicação por cada pacote
                                </li>
                            </ul>
                            <button onClick={() => navigate('/register')} className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-white transition-all">
                                COMEÇAR AGORA
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="mt-0 bg-gradient-to-r from-[#1A1040] to-transparent p-1 shadow-2xl rounded-[40px] border border-white/10">
                        <div className="bg-[#0F0529]/90 rounded-[39px] p-8 md:p-12 flex flex-col items-start gap-8">
                            <div className="w-full">
                                <h3 className="text-2xl md:text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                    O que é o Ciclo no Fatopago?
                                </h3>

                                <div className="grid md:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                            <p className="text-slate-300 leading-relaxed">
                                                Ciclo é o período de tempo em que o seu pacote fica ativo para validação de notícias.
                                            </p>
                                            <div className="mt-4 flex items-center gap-3 text-purple-400 font-bold">
                                                <Clock className="w-5 h-5" />
                                                ⏱ Cada ciclo tem duração de 24 horas.
                                            </div>
                                            <p className="mt-4 text-sm text-slate-400">
                                                Durante esse período, você pode usar o saldo do seu pacote para validar notícias.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-xl font-bold text-white flex items-center gap-3">
                                                <PlusCircle className="w-5 h-5 text-blue-400" />
                                                Compra de pacotes durante o ciclo
                                            </h4>
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                Durante o ciclo do Fatopago, você pode comprar quantos pacotes quiser.
                                                Os valores adquiridos se somam, aumentando o seu saldo disponível.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                            <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                                <Wallet className="w-5 h-5 text-green-400" />
                                                Como funciona o saldo?
                                            </h4>
                                            <ul className="space-y-3">
                                                {[
                                                    "O valor do pacote vira saldo para validação.",
                                                    "Cada notícia possui um valor (custo).",
                                                    "O valor é debitado automaticamente do saldo.",
                                                    "Valide enquanto houver saldo e ciclo ativo."
                                                ].map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                                                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-6 rounded-3xl border border-purple-500/30">
                                            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-3">
                                                <RefreshCw className="w-5 h-5 text-purple-400" />
                                                Saldo para próximo ciclo
                                            </h4>
                                            <p className="text-slate-300 text-sm leading-relaxed">
                                                🔁 Você pode manter um saldo correspondente ao valor de um pacote para ativar automaticamente o próximo ciclo.
                                            </p>
                                            <p className="mt-3 text-xs text-slate-400 italic">
                                                Se ao final do ciclo você tiver saldo suficiente equivalente a um pacote, esse saldo iniciará o ciclo seguinte automaticamente.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/5">
                                    <div className="flex flex-wrap gap-4">
                                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Ciclo de 24h</span>
                                        </div>
                                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-yellow-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Saldo Cumulativo</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate('/register')}
                                        className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-purple-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        GARANTIR MINHA VAGA <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 border-t border-white/5 bg-black/20">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <img src="/logo.png" alt="Fatopago Logo" className="h-10 mb-6" />
                        <p className="text-slate-500 text-sm max-w-xs leading-relaxed font-medium">
                            Combata a desinformação e seja recompensado por isso. A primeira plataforma focada na verdade dos fatos.
                        </p>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-4">
                        <div className="flex gap-6">
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Termos</a>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacidade</a>
                            <button onClick={() => navigate('/politica-ganhos')} className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Política de Ganhos</button>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Contato</a>
                        </div>
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">© 2026 FATOPAGO. TODOS OS DIREITOS RESERVADOS.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
