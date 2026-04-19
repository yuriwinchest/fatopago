import { ArrowLeft, Mail, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_CONTACT_EMAIL, PLATFORM_CONTACT_MAILTO } from '../lib/platformContact';

const contactHighlights = [
    'Dúvidas sobre cadastro, login e acesso à plataforma.',
    'Solicitações comerciais, suporte operacional e contato institucional.',
    'Orientações gerais sobre pacotes, validações e funcionamento da plataforma.'
];

const ContactPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0F0529] text-white selection:bg-fuchsia-500/30">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.22),transparent_40%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_42%)]" />

            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b0837]/85 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4 lg:px-10">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm font-bold">Voltar</span>
                    </button>
                    <img src="/logo.png" alt="Fatopago" className="h-8 w-auto" />
                </div>
            </header>

            <main className="relative mx-auto w-full max-w-[1200px] px-6 py-12 lg:px-10">
                <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(64,18,135,0.9),rgba(14,5,40,0.98))] p-8 shadow-[0_30px_80px_rgba(29,8,59,0.34)] md:p-12">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2">
                        <Mail className="h-4 w-4 text-fuchsia-100" />
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100">Contato da plataforma</span>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
                        <div>
                            <h1 className="max-w-4xl text-3xl font-black leading-tight md:text-5xl">
                                Fale com a equipe da Fatopago
                            </h1>
                            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200/90 md:text-lg">
                                Este é o canal oficial de contato da plataforma para dúvidas operacionais, suporte geral e tratativas institucionais.
                            </p>

                            <div className="mt-8 grid gap-3">
                                {contactHighlights.map((item) => (
                                    <div
                                        key={item}
                                        className="flex items-start gap-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-relaxed text-slate-100 md:text-[15px]"
                                    >
                                        <Send className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <aside className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-fuchsia-100/80">
                                E-mail oficial
                            </p>
                            <a
                                href={PLATFORM_CONTACT_MAILTO}
                                className="mt-4 block break-all text-2xl font-black leading-tight text-white transition-colors hover:text-cyan-200 md:text-3xl"
                            >
                                {PLATFORM_CONTACT_EMAIL}
                            </a>
                            <p className="mt-4 text-sm leading-relaxed text-slate-300">
                                Ao clicar no e-mail, o sistema abrirá seu aplicativo padrão de mensagens para iniciar o contato com a plataforma.
                            </p>

                            <a
                                href={PLATFORM_CONTACT_MAILTO}
                                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/15 px-5 text-sm font-black uppercase tracking-[0.18em] text-fuchsia-50 transition hover:bg-fuchsia-500/25"
                            >
                                <Mail className="h-4 w-4" />
                                Enviar e-mail
                            </a>
                        </aside>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-8 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
                © 2026 Fatopago. Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default ContactPage;
