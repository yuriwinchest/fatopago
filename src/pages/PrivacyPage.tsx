import { ArrowLeft, CheckCircle2, FileLock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const privacySections = [
    {
        title: 'Compromisso com a Proteção de Dados',
        paragraphs: [
            'A plataforma de validação de notícias tem como princípio fundamental a proteção da privacidade de seus usuários.',
            'Todas as informações coletadas são tratadas com rigor e em conformidade com legislações de proteção de dados, como a LGPD (Lei Geral de Proteção de Dados) no Brasil.'
        ]
    },
    {
        title: 'Coleta de Informações',
        bullets: [
            'Dados Pessoais: Apenas informações essenciais para o funcionamento da plataforma são solicitadas, como nome, e-mail e preferências de uso.',
            'Dados de Navegação: São coletados de forma anônima para melhorar a experiência do usuário e otimizar os serviços.'
        ]
    },
    {
        title: 'Uso das Informações',
        bullets: [
            'Garantir a autenticidade e segurança das interações.',
            'Personalizar conteúdos e recomendações.',
            'Prevenir fraudes e uso indevido da plataforma.'
        ]
    },
    {
        title: 'Compartilhamento de Dados',
        bullets: [
            'Não há venda de dados: As informações dos usuários não são comercializadas.',
            'Parceiros confiáveis: Dados podem ser compartilhados apenas com parceiros que seguem padrões de segurança equivalentes.'
        ]
    },
    {
        title: 'Segurança',
        bullets: [
            'Criptografia de ponta a ponta para proteger comunicações.',
            'Monitoramento contínuo contra acessos não autorizados.',
            'Atualizações regulares de protocolos de segurança.'
        ]
    },
    {
        title: 'Direitos do Usuário',
        bullets: [
            'Direito de acesso às próprias informações.',
            'Direito de correção de dados incorretos.',
            'Direito de exclusão de dados mediante solicitação.'
        ]
    },
    {
        title: 'Transparência',
        paragraphs: [
            'A plataforma mantém políticas claras e acessíveis sobre como os dados são coletados, usados e protegidos, garantindo que o usuário tenha total controle sobre sua privacidade.'
        ]
    }
];

const PrivacyPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0F0529] text-white selection:bg-cyan-500/30">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.14),transparent_40%)]" />

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
                <section className="mb-10 rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(13,63,95,0.78),rgba(14,5,40,0.96))] p-8 shadow-[0_30px_80px_rgba(7,28,45,0.32)] md:mb-14 md:p-12">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2">
                        <FileLock className="h-4 w-4 text-cyan-100" />
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Privacidade do usuário</span>
                    </div>

                    <h1 className="max-w-5xl text-3xl font-black leading-tight md:text-5xl">
                        Privacidade de Usuário na Plataforma de Validação de Notícias
                    </h1>
                </section>

                <section className="grid gap-6">
                    {privacySections.map((section, index) => (
                        <article
                            key={section.title}
                            className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,47,73,0.34),rgba(14,5,40,0.88))] p-6 shadow-[0_20px_50px_rgba(6,78,110,0.18)] md:p-8"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/12 text-lg font-black text-cyan-100">
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/80">
                                        Política de privacidade
                                    </p>
                                    <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">
                                        {section.title}
                                    </h2>
                                </div>
                            </div>

                            {section.paragraphs ? (
                                <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-100/95 md:text-base">
                                    {section.paragraphs.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>
                            ) : null}

                            {section.bullets ? (
                                <ul className="mt-6 grid gap-3">
                                    {section.bullets.map((item) => (
                                        <li
                                            key={item}
                                            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed text-slate-100 md:text-[15px]"
                                        >
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </article>
                    ))}
                </section>
            </main>

            <footer className="border-t border-white/5 py-8 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
                © 2026 Fatopago. Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default PrivacyPage;
