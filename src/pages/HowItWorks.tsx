import { ArrowRight, CheckCircle, Clock, Package, PlusCircle, RefreshCw, HelpCircle, Newspaper } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const HowItWorks = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="fixed w-full z-50 bg-[#2e0259]/90 backdrop-blur-md rounded-b-[40px] shadow-2xl p-6 lg:px-16 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <img src="/logo.png" alt="Logo" className="h-8 lg:h-10" />
                </div>
                <nav className="hidden md:flex gap-8 text-sm font-bold text-slate-300">
                    <Link to="/" className="hover:text-white transition-colors">Início</Link>
                    <Link to="/how-it-works" className="text-purple-400">Como Funciona</Link>
                    <Link to="/noticias-falsas" className="hover:text-white transition-colors">Notícias Falsas</Link>
                </nav>
                <div className="flex gap-4">
                    <Link to="/login" className="hidden sm:flex items-center text-sm font-bold text-slate-300 hover:text-white px-4">
                        Login
                    </Link>
                    <Link to="/register" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-purple-500/20">
                        Começar Agora
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 lg:px-16 text-center max-w-5xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full mb-6">
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">Guia Completo</span>
                </div>
                <h1 className="text-4xl lg:text-7xl font-black mb-6 leading-tight tracking-tight">
                    O que é o <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Ciclo</span> no Fatopago?
                </h1>
                <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
                    Ciclo é o período de tempo em que o seu pacote fica ativo para validação de notícias. Entenda cada detalhe de como funciona.
                </p>

                <div className="bg-[#1A1040]/40 border border-white/10 p-8 rounded-[40px] text-left relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[80px] rounded-full" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-20 h-20 bg-purple-600/20 rounded-3xl flex items-center justify-center border border-purple-500/30 flex-shrink-0">
                            <Clock className="w-10 h-10 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold mb-2 text-white">⏱ Duração do Ciclo</h3>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                Cada ciclo tem duração de <span className="text-white font-bold">24 horas</span>. Durante esse período, você pode usar o saldo do seu pacote para validar notícias e gerar seus ganhos.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Detailed sections */}
            <section className="py-20 bg-white/[0.02] border-y border-white/5">
                <div className="px-6 lg:px-16 max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
                    {/* Compra de pacotes */}
                    <div className="bg-[#1A1040]/30 border border-white/5 p-8 rounded-[32px] hover:border-purple-500/30 transition-all">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                            <PlusCircle className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-4 text-white">Compra de pacotes durante o ciclo</h3>
                        <p className="text-slate-400 leading-relaxed mb-4">
                            Durante o ciclo do Fatopago, você pode comprar quantos pacotes quiser.
                        </p>
                        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl">
                            <p className="text-blue-300 text-sm font-bold flex items-center gap-2">
                                <ArrowRight className="w-4 h-4" />
                                Os valores adquiridos se somam, aumentando o seu saldo disponível.
                            </p>
                        </div>
                    </div>

                    {/* Funcionamento do saldo */}
                    <div className="bg-[#1A1040]/30 border border-white/5 p-8 rounded-[32px] hover:border-purple-500/30 transition-all">
                        <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
                            <Package className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-4 text-white">Como funciona o saldo do pacote?</h3>
                        <ul className="space-y-3 text-slate-400 text-sm">
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>O valor do pacote se transforma em <span className="text-white font-bold">saldo para validação</span>.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Cada notícia possui um valor (custo).</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>A cada notícia validada, esse valor é debitado automaticamente do seu saldo.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>Você pode validar notícias enquanto houver saldo e o ciclo estiver ativo.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Proximo ciclo */}
            <section className="py-24 px-6 relative">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gradient-to-br from-[#2E0259] to-[#0F0529] border-2 border-purple-500/30 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
                        <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                            <RefreshCw className="w-8 h-8 text-purple-400" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black mb-6">Saldo para ativar o próximo ciclo</h2>
                        <p className="text-slate-300 text-lg leading-relaxed mb-8">
                            🔁 Você pode manter um saldo correspondente ao valor de um pacote para ativar automaticamente o próximo ciclo.
                        </p>
                        <div className="bg-black/40 rounded-3xl p-6 border border-white/5 text-left">
                            <p className="text-purple-200 font-bold mb-2 uppercase tracking-widest text-xs">Como funciona:</p>
                            <p className="text-slate-400">
                                Se ao final do ciclo você tiver saldo suficiente equivalente a um pacote, esse saldo será utilizado para <span className="text-white font-bold">iniciar o ciclo seguinte</span>, sem necessidade de nova compra imediata.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Summary */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <h3 className="text-3xl font-black mb-10 text-center">Resumo rápido</h3>
                    <div className="grid gap-4">
                        {[
                            { icon: <RefreshCw className="w-5 h-5 text-purple-400" />, text: "🔄 Ciclo: dura 24 horas" },
                            { icon: <Package className="w-5 h-5 text-blue-400" />, text: "📦 Pacote: vira saldo para validação" },
                            { icon: <Newspaper className="w-5 h-5 text-green-400" />, text: "📰 Cada notícia: consome parte do saldo" },
                            { icon: <PlusCircle className="w-5 h-5 text-pink-400" />, text: "➕ Pode comprar vários pacotes no mesmo ciclo" },
                            { icon: <RefreshCw className="w-5 h-5 text-amber-400" />, text: "🔁 Saldo pode ativar o próximo ciclo automaticamente" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 bg-[#1A1040]/20 border border-white/5 p-5 rounded-2xl">
                                {item.icon}
                                <span className="font-bold text-slate-200">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 text-center">
                        <Link to="/register" className="inline-flex items-center gap-3 bg-white text-[#0F0529] px-10 py-5 rounded-2xl font-black text-lg hover:bg-purple-50 transition-all hover:scale-105 active:scale-95 shadow-2xl">
                            COMEÇAR AGORA <ArrowRight className="w-6 h-6" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 text-center text-slate-600 text-sm">
                <p>&copy; 2026 FatoPago. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
};

export default HowItWorks;
