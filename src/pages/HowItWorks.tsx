import {
    ArrowRight,
    CheckCircle,
    Clock,
    HelpCircle,
    Newspaper,
    Package,
    PlusCircle,
    RefreshCw
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const HowItWorks = () => {
    const navigate = useNavigate();

    const summaryItems = [
        { icon: <RefreshCw className="h-5 w-5 text-purple-400" />, text: 'Ciclo semanal: domingo 12h até domingo 11h' },
        { icon: <Package className="h-5 w-5 text-blue-400" />, text: 'Cada pacote libera um total fixo de notícias' },
        { icon: <Newspaper className="h-5 w-5 text-green-400" />, text: 'Cada notícia validada consome 1 unidade do pacote' },
        { icon: <PlusCircle className="h-5 w-5 text-pink-400" />, text: 'Você pode comprar outro pacote quando as notícias acabarem' },
        { icon: <RefreshCw className="h-5 w-5 text-amber-400" />, text: 'Entre 11h e 12h existe a janela de reinício do ciclo' }
    ];

    return (
        <div className="min-h-screen bg-[#0F0529] font-sans text-white selection:bg-purple-500/30">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b0837]/85 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4 lg:px-10">
                    <button className="flex items-center gap-3" onClick={() => navigate('/')} aria-label="Ir para início">
                        <img src="/logo.png" alt="FatoPago" className="h-8 w-auto" />
                    </button>

                    <nav className="hidden items-center gap-8 text-sm font-bold text-slate-300 md:flex">
                        <Link to="/" className="transition-colors hover:text-white">Início</Link>
                        <Link to="/how-it-works" className="text-purple-300">Como funciona</Link>
                        <Link to="/noticias-falsas" className="transition-colors hover:text-white">Notícias falsas</Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        <Link to="/login" className="hidden text-sm font-bold text-slate-300 transition-colors hover:text-white sm:inline-flex">
                            Login
                        </Link>
                        <Link
                            to="/register"
                            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:from-purple-500 hover:to-indigo-500"
                        >
                            Começar
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1200px] space-y-20 px-6 py-14 lg:px-10">
                <section className="text-center">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2">
                        <HelpCircle className="h-4 w-4 text-purple-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-200">Guia completo</span>
                    </div>
                    <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight md:text-6xl">
                        O que é o <span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">Ciclo</span> no FatoPago?
                    </h1>
                    <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
                        Ciclo é o período em que seu pacote fica ativo para validação de notícias. Veja como funciona, da liberação das notícias até a renovação automática.
                    </p>
                </section>

                <section>
                    <div className="rounded-[32px] border border-white/10 bg-[#1A1040]/40 p-6 md:p-8">
                        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-500/30 bg-purple-600/20">
                                <Clock className="h-10 w-10 text-purple-300" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white md:text-3xl">Duração do ciclo: semanal</h2>
                                <p className="mt-2 text-base leading-relaxed text-slate-300">
                                    O ciclo começa todo domingo ao meio-dia e encerra no domingo seguinte, às 11h da manhã. Depois disso, a plataforma reinicia a janela semanal e prepara o próximo ranking.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <article className="rounded-[28px] border border-white/10 bg-[#1A1040]/30 p-7">
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
                            <PlusCircle className="h-6 w-6 text-blue-400" />
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-white">Compra de pacotes no ciclo</h3>
                        <p className="mb-4 text-sm leading-relaxed text-slate-400">
                            Você pode comprar outro pacote no mesmo ciclo, mas apenas quando finalizar o pacote atual.
                        </p>
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                            <p className="flex items-center gap-2 text-sm font-bold text-blue-300">
                                <ArrowRight className="h-4 w-4" />
                                Regra: 1 pacote ativo por vez. Ao terminar, você libera a compra do próximo.
                            </p>
                        </div>
                    </article>

                    <article className="rounded-[28px] border border-white/10 bg-[#1A1040]/30 p-7">
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10">
                            <Package className="h-6 w-6 text-green-400" />
                        </div>
                        <h3 className="mb-4 text-xl font-bold text-white">Como o pacote funciona</h3>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <li className="flex gap-3">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                <span>Cada pacote libera um total fixo de notícias para validar.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                <span>Cada notícia validada consome 1 unidade do pacote.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                <span>A contagem é debitada automaticamente a cada validação.</span>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                <span>Você valida enquanto houver notícias disponíveis e ciclo ativo.</span>
                            </li>
                        </ul>
                    </article>
                </section>

                <section>
                    <div className="rounded-[32px] border border-purple-500/30 bg-gradient-to-br from-[#2E0259] to-[#0F0529] p-8 text-center md:p-12">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-600/20">
                            <RefreshCw className="h-8 w-8 text-purple-300" />
                        </div>
                        <h2 className="text-2xl font-black md:text-4xl">Pacotes no próximo ciclo</h2>
                        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
                            Se as notícias do pacote acabarem, você pode comprar outro pacote dentro da validade liberada para o seu perfil.
                        </p>
                    </div>
                </section>

                <section className="mx-auto max-w-3xl">
                    <h3 className="mb-8 text-center text-3xl font-black">Resumo rápido</h3>
                    <div className="space-y-3">
                        {summaryItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1A1040]/25 p-4">
                                {item.icon}
                                <span className="text-sm font-bold text-slate-200">{item.text}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 text-center">
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-3 rounded-2xl bg-white px-9 py-4 text-lg font-black text-[#0F0529] transition-all hover:scale-[1.02]"
                        >
                            COMEÇAR AGORA <ArrowRight className="h-6 w-6" />
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-10 text-center text-sm text-slate-600">
                <p>&copy; 2026 FatoPago. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
};

export default HowItWorks;
