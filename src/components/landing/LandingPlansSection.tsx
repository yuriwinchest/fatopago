import { Check, Clock, Crown, RefreshCw, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatNewsCount, PLANS_CONFIG } from '../../lib/planRules';

interface LandingPlansSectionProps {
    sectionPaddingX: string;
    sectionPaddingTop: string;
    sectionPaddingBottom: string;
}

const LandingPlansSection = ({
    sectionPaddingX,
    sectionPaddingTop,
    sectionPaddingBottom
}: LandingPlansSectionProps) => {
    const navigate = useNavigate();

    return (
        <section className={`${sectionPaddingTop} ${sectionPaddingBottom} ${sectionPaddingX} relative bg-white/[0.01] scroll-mt-32 md:scroll-mt-40`} id="plans">
            <div className="absolute top-1/2 left-0 w-72 h-72 bg-purple-600/10 blur-[100px] rounded-full -z-10" />
            <div className="max-w-7xl mx-auto">
                <div className="mx-auto mb-8 w-full md:mb-10">
                    <div className="flex flex-col items-center gap-3.5 text-center md:gap-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold uppercase tracking-widest text-purple-200">Planos de acesso</span>
                        </div>
                        <div className="space-y-2.5 md:space-y-3">
                            <h2 className="mx-auto max-w-4xl text-[2rem] md:text-5xl font-black leading-[0.96] title-duo-gradient">
                                Escolha o plano ideal e comece agora!
                            </h2>
                            <p className="mx-auto max-w-[34rem] text-sm leading-relaxed text-slate-300 md:max-w-3xl md:text-base">
                                Cada pacote libera uma quantidade total de notícias. Você decide como consumir tudo até terminar as notícias liberadas.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 w-full rounded-[32px] bg-[linear-gradient(120deg,rgba(34,211,238,0.45),rgba(99,102,241,0.28),rgba(16,185,129,0.38))] p-[1.5px] shadow-[0_0_32px_rgba(34,211,238,0.16)] md:mt-8">
                        <div className="grid gap-4 rounded-[31px] border border-white/10 bg-[#120633]/90 px-5 py-5 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:items-center md:px-6 md:py-6">
                            <div className="space-y-2 text-left">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/90">Modelo operacional do ciclo</p>
                                <p className="max-w-2xl text-sm font-semibold leading-relaxed text-white md:text-base">
                                    Cada notícia validada consome 1 unidade do pacote. Se acabar, você pode comprar outro pacote e continuar validando.
                                </p>
                            </div>
                            <div className="grid gap-3 text-left text-xs text-slate-100 md:text-sm">
                                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                    <span>O ciclo semanal vai de domingo 12h até domingo 11h.</span>
                                </div>
                                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                    <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                                    <span>Se as notícias do pacote acabarem antes, você pode comprar outro pacote e continuar validando no mesmo ciclo.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 md:gap-8">
                    <div className="flex min-h-[440px] h-full flex-col rounded-[40px] border border-white/10 bg-[#1A1040]/40 p-8 transition-all md:hover:scale-[1.02] md:hover:border-blue-500/30">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.starter.name}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">6 reais</span>
                                    <span className="text-slate-400 text-sm">( {formatNewsCount(PLANS_CONFIG.starter.maxValidations)} )</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                <Shield className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4">
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Check className="w-4 h-4 text-green-400" /> {formatNewsCount(PLANS_CONFIG.starter.maxValidations)} por pacote
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Clock className="w-4 h-4 text-cyan-300" /> Ativo até consumir todas as notícias do pacote
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <RefreshCw className="w-4 h-4 text-emerald-300" /> Se acabar hoje, compre outro pacote e siga validando
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Check className="w-4 h-4 text-green-400" /> 20% de comissão por indicação por cada pacote
                            </li>
                        </ul>
                        <button onClick={() => navigate('/register')} className="mt-auto min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/5 py-4 font-bold text-white transition-all active:scale-[0.99] md:hover:bg-white/10 touch-manipulation">
                            COMEÇAR AGORA
                        </button>
                    </div>

                    <div className="relative z-10 flex min-h-[440px] h-full flex-col rounded-[40px] border-2 border-purple-500/50 bg-gradient-to-br from-[#2E0259] to-[#0F0529] p-8 shadow-2xl shadow-purple-500/20">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full border border-white/20 shadow-lg uppercase tracking-widest">
                            RECOMENDADO
                        </div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-purple-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.pro.name}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-black text-white">10 reais</span>
                                    <span className="text-slate-400 text-sm">( {formatNewsCount(PLANS_CONFIG.pro.maxValidations)} )</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                                <Zap className="w-8 h-8 text-purple-400" />
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4">
                            <li className="flex items-center gap-3 text-white text-sm font-bold">
                                <Check className="w-5 h-5 text-green-400" /> {formatNewsCount(PLANS_CONFIG.pro.maxValidations)} por pacote
                            </li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold">
                                <Clock className="w-5 h-5 text-cyan-300" /> Ativo até consumir todas as notícias do pacote
                            </li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold">
                                <RefreshCw className="w-5 h-5 text-emerald-300" /> Se acabar hoje, compre outro pacote e siga validando
                            </li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold">
                                <Check className="w-5 h-5 text-green-400" /> 20% de comissão por indicação por cada pacote
                            </li>
                        </ul>
                        <button onClick={() => navigate('/register')} className="mt-auto min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 py-4 font-black text-white shadow-xl transition-all active:scale-[0.99] md:hover:scale-[1.02] md:hover:from-purple-500 md:hover:to-pink-500 touch-manipulation">
                            SELECIONAR PRO
                        </button>
                    </div>

                    <div className="flex min-h-[440px] h-full flex-col rounded-[40px] border border-white/10 bg-[#1A1040]/40 p-8 transition-all md:hover:scale-[1.02] md:hover:border-amber-500/30">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-1">{PLANS_CONFIG.expert.name}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-white">20 reais</span>
                                    <span className="text-slate-400 text-sm">( {formatNewsCount(PLANS_CONFIG.expert.maxValidations)} )</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                                <Crown className="w-6 h-6 text-amber-400" />
                            </div>
                        </div>
                        <ul className="mb-8 flex-1 space-y-4">
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Check className="w-4 h-4 text-green-400" /> {formatNewsCount(PLANS_CONFIG.expert.maxValidations)} por pacote
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Clock className="w-4 h-4 text-cyan-300" /> Ativo até consumir todas as notícias do pacote
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <RefreshCw className="w-4 h-4 text-emerald-300" /> Se acabar hoje, compre outro pacote e siga validando
                            </li>
                            <li className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                <Check className="w-4 h-4 text-green-400" /> 20% de comissão por indicação por cada pacote
                            </li>
                        </ul>
                        <button onClick={() => navigate('/register')} className="mt-auto min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/5 py-4 font-bold text-white transition-all active:scale-[0.99] md:hover:bg-white/10 touch-manipulation">
                            COMEÇAR AGORA
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LandingPlansSection;
