import { ArrowRight, CheckCircle, Newspaper, Trophy, Users, ShieldCheck, Wallet, PlayCircle, Star, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

    const stats = [
        { label: 'Usuários Ativos', value: '150k+', icon: <Users className="w-5 h-5 text-purple-400" /> },
        { label: 'Prêmios Pagos', value: 'R$ 2M+', icon: <Wallet className="w-5 h-5 text-green-400" /> },
        { label: 'Notícias Validadas', value: '500k+', icon: <CheckCircle className="w-5 h-5 text-blue-400" /> },
    ];

    const steps = [
        {
            title: 'Crie sua Conta',
            desc: 'Acesse nossa plataforma e faça seu cadastro em menos de 1 minuto.',
            icon: <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400 font-bold text-xl border border-purple-500/30">1</div>
        },
        {
            title: 'Escolha um Plano',
            desc: 'Selecione o plano ideal para suas metas de ganhos diários.',
            icon: <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 font-bold text-xl border border-blue-500/30">2</div>
        },
        {
            title: 'Valide Notícias',
            desc: 'Analise fatos e ganhe recompensas por cada validação correta.',
            icon: <div className="w-12 h-12 bg-green-600/20 rounded-2xl flex items-center justify-center text-green-400 font-bold text-xl border border-green-500/30">3</div>
        },
    ];

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
                        Transforme sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">Opinião</span> em <span className="text-green-400">Renda Real</span>
                    </h1>

                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                        Ganhe dinheiro auxiliando na verificação de notícias e combata a desinformação. Simples, rápido e direto na sua conta.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <button
                            onClick={() => navigate('/register')}
                            className="w-full sm:w-auto bg-white text-[#0F0529] px-10 py-5 rounded-2xl font-black text-lg shadow-2xl hover:bg-purple-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                        >
                            COMEÇAR AGORA <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/plans')}
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

            {/* How it Works */}
            <section className="py-24 px-6 relative" id="how-it-works">
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full -z-10" />
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-black mb-4">Como funciona o FatoPago?</h2>
                        <p className="text-slate-400 font-medium">Três passos simples para começar a lucrar hoje mesmo.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((step, i) => (
                            <div key={i} className="bg-[#1A1040]/30 border border-white/5 p-8 rounded-[32px] hover:border-purple-500/30 transition-all hover:bg-[#1A1040]/50 relative group">
                                <div className="mb-6">{step.icon}</div>
                                <h3 className="text-xl font-bold mb-3 text-white">{step.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                                <div className="absolute top-4 right-8 text-8xl font-black text-white/[0.03] pointer-events-none group-hover:text-purple-500/10 transition-colors">
                                    0{i + 1}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 bg-gradient-to-r from-[#1A1040] to-transparent p-1 shadow-2xl rounded-[40px] border border-white/10">
                        <div className="bg-[#0F0529]/90 rounded-[39px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex-1">
                                <h3 className="text-2xl font-black mb-4 flex items-center gap-3">
                                    <Trophy className="w-8 h-8 text-yellow-500" />
                                    Premiações Diárias
                                </h3>
                                <p className="text-slate-400 leading-relaxed mb-6 font-medium">
                                    Além dos ganhos por tarefa, os melhores validadores de cada cidade participam de um ranking diário com prêmios em dinheiro de até <span className="text-white font-bold">R$ 200,00</span>.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                                        <Medal className="w-4 h-4 text-purple-400" />
                                        <span className="text-xs font-bold">Ranking Global</span>
                                    </div>
                                    <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                                        <Newspaper className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-bold">+500 Notícias/Dia</span>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <button
                                    onClick={() => navigate('/register')}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-105 transition-all active:scale-95"
                                >
                                    GARANTIR MINHA VAGA
                                </button>
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
