import { Check, Shield, Star } from 'lucide-react';
import PromoMediaAsset from '../PromoMediaAsset';

interface LandingHeroSectionProps {
    sectionPaddingX: string;
    sectionStackGap: string;
    landingPrizeAmountLabel: string;
    promoMediaKind: 'video' | 'image';
    promoMediaUrl: string;
}

const LandingHeroSection = ({
    sectionPaddingX,
    sectionStackGap,
    landingPrizeAmountLabel,
    promoMediaKind,
    promoMediaUrl
}: LandingHeroSectionProps) => {
    return (
        <section className="relative pt-32 pb-8 md:pb-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10" />

            <div className={`max-w-7xl mx-auto ${sectionStackGap} ${sectionPaddingX}`}>
                <div className="relative overflow-hidden rounded-[36px] border border-white/12 bg-[linear-gradient(135deg,rgba(122,44,246,0.92),rgba(96,22,190,0.9),rgba(73,13,138,0.92))] px-5 py-5 shadow-[0_30px_90px_rgba(78,20,180,0.38)] md:px-8 md:py-6 lg:px-10 lg:py-7">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),rgba(255,255,255,0)_34%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.18),rgba(251,191,36,0)_35%)]" />
                    <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-fuchsia-400/10 blur-[100px]" />
                    <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-cyan-300/10 blur-[120px]" />

                    <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch lg:gap-10">
                        <div className="flex h-full flex-col items-center justify-center gap-6 text-center lg:min-h-[420px] lg:self-stretch">
                            <h1 className="w-full max-w-[560px] text-center text-balance text-[clamp(1.55rem,4vw,3.25rem)] font-extrabold leading-[0.96] tracking-[-0.04em] text-white">
                                <span className="block md:whitespace-nowrap">SEJA O PRIMEIRO</span>
                                <span className="block md:whitespace-nowrap">DO RANKING E RECEBA</span>
                            </h1>

                            <div className="relative w-full max-w-[560px] lg:mt-3">
                                <div className="pointer-events-none absolute -inset-3 rounded-[38px] bg-[radial-gradient(circle,rgba(251,191,36,0.42),rgba(249,115,22,0.18),rgba(249,115,22,0))] blur-2xl opacity-95" />
                                <div className="relative w-full overflow-hidden rounded-[30px] border border-amber-100/35 bg-[linear-gradient(135deg,rgba(255,240,179,0.30),rgba(249,115,22,0.18),rgba(255,255,255,0.08))] px-5 sm:px-6 py-5 shadow-[0_24px_58px_rgba(120,34,0,0.34)] backdrop-blur-md">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                                    <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-amber-50/85">
                                        Prêmio em destaque
                                    </span>
                                    <span className="mt-2 flex items-end justify-center gap-2 sm:gap-3 bg-[linear-gradient(135deg,#fff8d1_0%,#ffffff_42%,#ffd166_100%)] bg-clip-text text-transparent drop-shadow-[0_8px_22px_rgba(255,209,102,0.35)]">
                                        <span className="text-[clamp(1.8rem,3.7vw,2.5rem)] font-black leading-none tracking-[-0.04em]">
                                            R$
                                        </span>
                                        <span className="text-[clamp(3.25rem,7vw,5.2rem)] font-black leading-none tracking-[-0.065em]">
                                            {landingPrizeAmountLabel}
                                        </span>
                                    </span>
                                </div>
                            </div>

                            <div className="inline-flex items-center justify-center self-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.18em] text-purple-50 shadow-[0_12px_24px_rgba(34,10,88,0.16)]">
                                Sua primeira plataforma de validação de notícias
                            </div>
                        </div>

                        <div className="flex w-full justify-center lg:justify-end">
                            <div className="relative w-full max-w-[290px] sm:max-w-[320px]">
                                <div className="pointer-events-none absolute inset-x-6 -top-3 h-12 rounded-full bg-white/12 blur-2xl" />
                                <div className="pointer-events-none absolute -inset-6 rounded-[42px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0)_58%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.22),rgba(251,191,36,0)_60%)] blur-3xl opacity-80" />
                                <div className="relative overflow-hidden rounded-[34px] border border-white/18 bg-black/10 shadow-[0_28px_70px_rgba(14,4,40,0.42)]">
                                    <PromoMediaAsset
                                        mediaKind={promoMediaKind}
                                        src={promoMediaUrl}
                                        alt="Mídia principal da plataforma FatoPago"
                                        className="block aspect-[9/16] w-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`max-w-7xl mx-auto ${sectionStackGap} ${sectionPaddingX}`}>
                <article className="relative overflow-hidden rounded-[34px] lg:rounded-[46px] border border-cyan-300/20 bg-gradient-to-br from-[#1A0C44]/95 via-[#140737]/95 to-[#0E0528]/95 p-5 sm:p-6 md:p-8 lg:p-12 shadow-[0_25px_65px_rgba(80,45,180,0.34)]">
                    <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-400/10 blur-[110px] rounded-full pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-fuchsia-500/10 blur-[110px] rounded-full pointer-events-none" />
                    <div className="absolute inset-x-5 top-4 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent pointer-events-none" />

                    <div className="relative z-10 mx-auto max-w-[960px]">
                        <div className="flex flex-col items-center gap-4 text-center md:gap-5">
                            <div className="hero-title-surface mx-auto w-full max-w-[640px]">
                                <h2 className="text-center text-[clamp(1.95rem,8vw,2.55rem)] sm:text-4xl md:text-5xl font-black leading-[1.02] tracking-tight text-white text-balance drop-shadow-[0_2px_0_rgba(12,4,28,0.35)]">
                                    <span className="inline">O que é</span>
                                    <span className="inline ml-2">a Fatopago?</span>
                                </h2>
                            </div>

                            <div className="hero-badge-surface mx-auto w-fit">
                                <Star className="w-5 h-5 text-cyan-200 fill-cyan-200" />
                                <span className="text-[12px] uppercase tracking-[0.14em] text-cyan-100 font-black leading-[1.12]">
                                    APRESENTAÇÃO DA
                                    <br />
                                    PLATAFORMA
                                </span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="min-w-0 space-y-4">
                                <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center md:p-5">
                                    <p className="text-slate-100/95 text-[16px] md:text-[17px] leading-relaxed">
                                        A Fatopago é uma plataforma tecnológica de participação digital estruturada em modelo colaborativo de validação de conteúdos informativos.
                                    </p>
                                </div>

                                <div className="mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
                                    <p className="text-slate-200 text-[15px] md:text-[16px] leading-relaxed mb-3">
                                        A empresa oferece um ambiente online no qual usuários cadastrados podem:
                                    </p>
                                    <ul className="grid gap-2.5">
                                        {[
                                            'Adquirir pacotes de participação',
                                            'Realizar análises e validações de notícias',
                                            'Participar de ciclos de desempenho',
                                            'Integrar programa de indicação'
                                        ].map((item) => (
                                            <li key={item} className="group flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-3 py-2.5 transition-all hover:border-emerald-300/35 hover:bg-emerald-300/10 active:scale-[0.99]">
                                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10">
                                                    <Check className="w-4 h-4 text-emerald-300" />
                                                </span>
                                                <span className="text-slate-100 text-[15px] md:text-[16px] leading-relaxed">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 mx-auto w-full max-w-[760px] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 md:px-5 md:py-4">
                            <p className="text-slate-200 text-[15px] md:text-[16px] leading-relaxed flex items-start gap-2.5">
                                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                                <span>
                                    A Fatopago é uma iniciativa tecnológica baseada em engajamento digital estruturado e regulamentado por regras próprias de funcionamento.
                                </span>
                            </p>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    );
};

export default LandingHeroSection;
