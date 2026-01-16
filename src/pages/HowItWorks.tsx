import { ArrowRight, CheckCircle, ShieldCheck, Zap, Users, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
    return (
        <div className="min-h-screen bg-brand-dark text-white font-sans">
            {/* Header */}
            <header className="p-6 lg:px-16 flex justify-between items-center bg-brand-dark/95 backdrop-blur-md fixed w-full z-50 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-bold text-primary">✓</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight">FatoPago</span>
                </div>
                <nav className="hidden md:flex gap-8 text-sm font-semibold text-slate-300">
                    <Link to="/" className="hover:text-white transition-colors">Início</Link>
                    <Link to="/how-it-works" className="text-white">Como Funciona</Link>
                    <Link to="/login" className="hover:text-white transition-colors">Login</Link>
                </nav>
                <Link to="/" className="bg-primary hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-primary/20">
                    Começar Agora
                </Link>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 lg:px-16 text-center max-w-4xl mx-auto">
                <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                    Como Funciona o Sistema de Ciclos
                </h1>
                <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
                    Entenda como transformar sua análise crítica em rendimentos reais através do nosso inovador sistema de validação por ciclos.
                </p>

                <div className="grid md:grid-cols-3 gap-8 text-left">
                    <div className="bg-[#1A1040] p-6 rounded-2xl border border-white/5 relative group hover:border-primary/50 transition-all">
                        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Zap className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">1. Adquira um Ciclo</h3>
                        <p className="text-slate-400 text-sm">Ao invés de mensalidades, você compra um pacote de validações (Ciclo). Você tem total controle sobre seu ritmo.</p>
                    </div>

                    <div className="bg-[#1A1040] p-6 rounded-2xl border border-white/5 relative group hover:border-primary/50 transition-all">
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">2. Valide Notícias</h3>
                        <p className="text-slate-400 text-sm">Analise as notícias apresentadas. Quanto maior sua precisão, maior sua reputação e seus ganhos.</p>
                    </div>

                    <div className="bg-[#1A1040] p-6 rounded-2xl border border-white/5 relative group hover:border-primary/50 transition-all">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Trophy className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">3. Receba Recompensas</h3>
                        <p className="text-slate-400 text-sm">Acumule saldo a cada validação correta. Saques via PIX instantâneo ao atingir R$ 50,00.</p>
                    </div>
                </div>
            </section>

            {/* Ranking & Safety */}
            <section className="py-20 bg-[#0F0826]">
                <div className="px-6 lg:px-16 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
                    <div className="lg:w-1/2">
                        <div className="bg-gradient-to-br from-[#8a2ce2] to-[#4B0082] p-8 rounded-3xl relative overflow-hidden shadow-2xl">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-bold mb-1">Ranking de Elite</h3>
                                <p className="text-purple-200 mb-6 text-sm">Dispute posições com validadores do seu estado.</p>

                                <div className="space-y-3">
                                    <div className="bg-white/10 p-3 rounded-xl flex items-center justify-between backdrop-blur-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-200 flex items-center justify-center font-bold">1</div>
                                            <div className="font-bold text-sm">São Paulo - SP</div>
                                        </div>
                                        <div className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded">R$ 4.2k pagos</div>
                                    </div>
                                    <div className="bg-white/10 p-3 rounded-xl flex items-center justify-between backdrop-blur-sm opacity-80">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-400/20 text-slate-200 flex items-center justify-center font-bold">2</div>
                                            <div className="font-bold text-sm">Rio de Janeiro - RJ</div>
                                        </div>
                                        <div className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded">R$ 3.1k pagos</div>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative */}
                            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                        </div>
                    </div>

                    <div className="lg:w-1/2 space-y-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldCheck className="w-8 h-8 text-green-400" />
                                <h2 className="text-3xl font-bold">Segurança e Transparência</h2>
                            </div>
                            <p className="text-slate-400 leading-relaxed">
                                Nosso algoritmo de consenso garante que apenas validações precisas sejam remuneradas. Isso protege o ecossistema contra fraudes e valoriza os validadores sérios.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-white mb-2">Saque PIX</h4>
                                <p className="text-sm text-slate-500">Receba seus ganhos em segundos, diretamente na sua conta bancária.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-2">Sem Mensalidades</h4>
                                <p className="text-sm text-slate-500">Pague apenas pelo ciclo de trabalho que desejar realizar.</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Link to="/" className="inline-flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all">
                                Quero me tornar um validador <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 text-center text-slate-600 text-sm">
                <p>&copy; 2024 FatoPago. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
};

export default HowItWorks;
