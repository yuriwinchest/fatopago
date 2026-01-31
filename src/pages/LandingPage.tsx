import { ArrowRight, CheckCircle, Users, ShieldCheck, Wallet, PlayCircle, Star, AlertTriangle, Zap, Crown, Shield, Check, Clock, PlusCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS_CONFIG } from '../lib/planRules';

const LandingPage = () => {
    const navigate = useNavigate();

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

                    {/* App Preview Image Mockup */}
                    <div className="relative max-w-5xl mx-auto rounded-[40px] border border-white/10 bg-[#1A1040]/50 p-2 shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0529] to-transparent z-10" />
                        <div className="rounded-[32px] overflow-hidden bg-slate-900 aspect-[16/9] flex items-center justify-center relative">
                            {/* Placeholder/Mockup of the app */}
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-transparent to-black/40" />
                            <div className="z-20 text-center scale-75 md:scale-100">
                                <div className="bg-[#2e0259] p-8 rounded-[40px] shadow-2xl border border-white/10 max-w-md">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="text-left">
                                            <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest">Saldo Atual</p>
                                            <p className="text-3xl font-black text-green-400">R$ 1.250,00</p>
                                        </div>
                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                            <ShieldCheck className="w-6 h-6 text-purple-300" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-12 w-full bg-white/5 rounded-xl border border-white/5 flex items-center px-4 gap-3">
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                                            <div className="h-2 w-32 bg-white/10 rounded" />
                                        </div>
                                        <div className="h-12 w-full bg-white/5 rounded-xl border border-white/5 flex items-center px-4 gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <div className="h-2 w-24 bg-white/10 rounded" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Background Texture */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
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
