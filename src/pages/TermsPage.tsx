import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type LegalBlock = {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
};

type LegalDocument = {
    id: string;
    label: string;
    title: string;
    blocks: LegalBlock[];
};

const legalDocuments: LegalDocument[] = [
    {
        id: 'termos-participacao',
        label: 'Documento 01',
        title: 'Termos de Participação e Aceite da Plataforma de Validação de Notícias',
        blocks: [
            {
                title: '1. Objeto',
                paragraphs: [
                    'A presente plataforma tem como finalidade a validação de notícias pelos usuários cadastrados, não se enquadrando juridicamente como atividade de apostas, jogos de azar, pirâmides financeiras ou similares.'
                ]
            },
            {
                title: '2. Cadastro e Pacotes',
                bullets: [
                    'O usuário deverá realizar cadastro na plataforma para participar.',
                    'Após o cadastro, o usuário poderá adquirir pacotes de validação de notícias, disponíveis nas modalidades: básico, semanal ou mensal.',
                    'Cada pacote concede ao usuário o direito de validar uma quantidade específica de notícias dentro de um ciclo pré-determinado.'
                ]
            },
            {
                title: '3. Ciclos de Validação',
                bullets: [
                    'Durante cada mês, serão realizados 4 ciclos de validação.',
                    'Ao final de cada ciclo, será elaborado um ranking dos usuários com base na quantidade de notícias validadas.',
                    'O usuário que ocupar a primeira posição do ranking ao término do ciclo será declarado vencedor.',
                    'Em caso de empate na quantidade de validações, o critério de desempate será o horário da última validação, sendo declarado vencedor o usuário que realizou a última validação por último. Exemplo: Se o Usuário A validou 200 notícias às 10:20 e o Usuário B validou 200 notícias às 10:30, o vencedor será o Usuário B (última validação mais recente).'
                ]
            },
            {
                title: '4. Premiação',
                bullets: [
                    'O vencedor de cada ciclo receberá o valor de R$ 6.000,00 (seis mil reais).',
                    'O pagamento será realizado conforme os prazos e procedimentos definidos pela plataforma.'
                ]
            },
            {
                title: '5. Direito de Imagem',
                bullets: [
                    'O usuário vencedor deverá disponibilizar seu direito de imagem pelo período de 90 (noventa) dias após o recebimento do prêmio.',
                    'Essa disponibilização tem como finalidade a comprovação social da entrega do prêmio e poderá ser utilizada pela plataforma em materiais de divulgação.'
                ]
            },
            {
                title: '6. Aceite',
                paragraphs: [
                    'Ao se inscrever e participar da plataforma, o usuário declara estar ciente e de acordo com todos os termos aqui descritos, reconhecendo que:'
                ],
                bullets: [
                    'A atividade não constitui aposta, jogo de azar ou pirâmide financeira.',
                    'A premiação está condicionada ao desempenho individual dentro dos ciclos de validação.',
                    'O direito de imagem do vencedor será cedido temporariamente para fins de divulgação institucional.'
                ]
            }
        ]
    },
    {
        id: 'politicas-ganhos-privacidade',
        label: 'Documento 02',
        title: 'Políticas de Ganhos e Privacidade',
        blocks: [
            {
                title: '1. Políticas de Ganhos'
            },
            {
                title: '1.1 Estrutura de Remuneração',
                paragraphs: [
                    'Os ganhos dos usuários serão calculados com base em métricas previamente definidas, como desempenho, engajamento ou volume de vendas.',
                    'A remuneração poderá incluir valores fixos, comissões ou bônus variáveis.'
                ]
            },
            {
                title: '1.2 Transparência',
                paragraphs: [
                    'Todos os cálculos de ganhos serão disponibilizados em relatórios claros e acessíveis.',
                    'Alterações nas regras de remuneração serão comunicadas com antecedência mínima de 30 dias.'
                ]
            },
            {
                title: '1.3 Condições',
                paragraphs: [
                    'O usuário deve cumprir integralmente os termos de uso para ter direito aos ganhos.',
                    'Ganhos indevidos ou obtidos por meio de fraude serão anulados.'
                ]
            },
            {
                title: '1.4 Pagamentos',
                paragraphs: [
                    'Os pagamentos serão realizados mensalmente, por meio de métodos seguros e previamente acordados.',
                    'Em caso de atraso, será informado o motivo e o prazo para regularização.'
                ]
            },
            {
                title: '2. Políticas de Privacidade'
            },
            {
                title: '2.1 Coleta de Dados',
                paragraphs: [
                    'Serão coletadas apenas informações necessárias para o funcionamento da plataforma.',
                    'Dados sensíveis não serão compartilhados sem consentimento explícito.'
                ]
            },
            {
                title: '2.2 Uso de Dados',
                paragraphs: [
                    'As informações coletadas serão utilizadas para melhorar a experiência do usuário, personalizar serviços e garantir segurança.',
                    'Dados poderão ser usados para análises estatísticas, sempre de forma anonimizada.'
                ]
            },
            {
                title: '2.3 Compartilhamento',
                paragraphs: [
                    'Informações pessoais não serão vendidas ou cedidas a terceiros.',
                    'O compartilhamento só ocorrerá em casos previstos em lei ou mediante autorização do usuário.'
                ]
            },
            {
                title: '2.4 Segurança',
                paragraphs: [
                    'Medidas técnicas e administrativas serão adotadas para proteger os dados contra acessos não autorizados.',
                    'Em caso de incidente de segurança, os usuários serão notificados imediatamente.'
                ]
            },
            {
                title: '2.5 Direitos do Usuário',
                paragraphs: [
                    'O usuário poderá solicitar acesso, correção ou exclusão de seus dados.',
                    'É garantido o direito de revogar consentimentos a qualquer momento.'
                ]
            },
            {
                title: '3. Disposições Gerais',
                paragraphs: [
                    'As políticas de ganhos e privacidade poderão ser atualizadas periodicamente.',
                    'O uso contínuo da plataforma implica concordância com as versões mais recentes das políticas.',
                    'Última atualização: Março de 2026'
                ]
            }
        ]
    },
    {
        id: 'privacidade-usuario',
        label: 'Documento 03',
        title: 'Privacidade de Usuário na Plataforma de Validação de Notícias',
        blocks: [
            {
                title: 'Compromisso com a Proteção de Dados',
                paragraphs: [
                    'A plataforma de validação de notícias tem como princípio fundamental a proteção da privacidade de seus usuários. Todas as informações coletadas são tratadas com rigor e em conformidade com legislações de proteção de dados, como a LGPD (Lei Geral de Proteção de Dados) no Brasil.'
                ]
            },
            {
                title: 'Coleta de Informações',
                paragraphs: [
                    'Dados Pessoais: Apenas informações essenciais para o funcionamento da plataforma são solicitadas, como nome, e-mail e preferências de uso.',
                    'Dados de Navegação: São coletados de forma anônima para melhorar a experiência do usuário e otimizar os serviços.'
                ]
            },
            {
                title: 'Uso das Informações',
                paragraphs: [
                    'Garantir a autenticidade e segurança das interações.',
                    'Personalizar conteúdos e recomendações.',
                    'Prevenir fraudes e uso indevido da plataforma.'
                ]
            },
            {
                title: 'Compartilhamento de Dados',
                paragraphs: [
                    'Não há venda de dados: As informações dos usuários não são comercializadas.',
                    'Parceiros confiáveis: Dados podem ser compartilhados apenas com parceiros que seguem padrões de segurança equivalentes.'
                ]
            },
            {
                title: 'Segurança',
                paragraphs: [
                    'Criptografia de ponta a ponta para proteger comunicações.',
                    'Monitoramento contínuo contra acessos não autorizados.',
                    'Atualizações regulares de protocolos de segurança.'
                ]
            },
            {
                title: 'Direitos do Usuário',
                paragraphs: [
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
        ]
    },
    {
        id: 'ciclo-fatopago',
        label: 'Documento 04',
        title: 'O que é o Ciclo no Fatopago?',
        blocks: [
            {
                title: 'Definição do Ciclo',
                paragraphs: [
                    'Ciclo é o período de tempo em que o seu pacote fica ativo para validação de notícias.',
                    'Cada ciclo vai de domingo, 12h, até domingo, 11h.',
                    'Durante esse período, você pode usar a quantidade de notícias do seu pacote para validar notícias.'
                ]
            },
            {
                title: 'Compra de pacotes durante o ciclo',
                paragraphs: [
                    'Durante o ciclo semanal do Fatopago, você pode usar todas as notícias do pacote em um único dia ou dividir as validações ao longo dos 7 dias.',
                    'Se finalizar o pacote atual antes do encerramento do ciclo, pode comprar outro e continuar validando normalmente.'
                ]
            },
            {
                title: 'Como funciona o pacote?',
                bullets: [
                    'Cada pacote libera uma quantidade total de notícias para validação.',
                    'Cada notícia validada consome 1 unidade do pacote.',
                    'A contagem é debitada automaticamente a cada validação.',
                    'Valide enquanto houver notícias disponíveis e ciclo ativo.'
                ]
            },
            {
                title: 'Pacote para o próximo ciclo',
                paragraphs: [
                    'Se as notícias do pacote acabarem, você pode comprar outro pacote compatível com o seu perfil.',
                    'O novo pacote entra como uma nova compra, respeitando a validade comercial do plano escolhido.'
                ]
            },
            {
                title: 'Indicadores do ciclo',
                bullets: [
                    'Ciclo semanal.',
                    '1 pacote por vez.'
                ]
            }
        ]
    }
];

const TermsPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0F0529] text-white selection:bg-fuchsia-500/30">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.22),transparent_42%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.12),transparent_38%)]" />

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
                <section className="mb-10 rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(34,10,88,0.92),rgba(14,5,40,0.97))] p-8 shadow-[0_30px_80px_rgba(12,4,28,0.34)] md:mb-14 md:p-12">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-2">
                        <FileText className="h-4 w-4 text-fuchsia-200" />
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100">Termos da plataforma</span>
                    </div>

                    <h1 className="max-w-5xl text-3xl font-black leading-tight md:text-5xl">
                        Documentos Oficiais da Plataforma
                    </h1>
                </section>

                <section className="grid gap-8">
                    {legalDocuments.map((document) => (
                        <article
                            key={document.id}
                            id={document.id}
                            className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(76,29,149,0.22),rgba(14,5,40,0.86))] p-6 shadow-[0_20px_50px_rgba(55,48,163,0.18)] md:p-8"
                        >
                            <div className="flex flex-col gap-4 border-b border-white/10 pb-6">
                                <span className="w-fit rounded-full border border-fuchsia-400/25 bg-fuchsia-500/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-100">
                                    {document.label}
                                </span>
                                <h2 className="text-2xl font-black leading-tight text-white md:text-4xl">
                                    {document.title}
                                </h2>
                            </div>

                            <div className="mt-6 grid gap-5">
                                {document.blocks.map((block) => (
                                    <section
                                        key={`${document.id}-${block.title}`}
                                        className="rounded-[28px] border border-white/10 bg-black/20 p-5 md:p-6"
                                    >
                                        <h3 className="text-xl font-black text-white md:text-2xl">
                                            {block.title}
                                        </h3>

                                        {block.paragraphs ? (
                                            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-100/95 md:text-base">
                                                {block.paragraphs.map((paragraph) => (
                                                    <p key={paragraph}>{paragraph}</p>
                                                ))}
                                            </div>
                                        ) : null}

                                        {block.bullets ? (
                                            <ul className="mt-4 grid gap-3">
                                                {block.bullets.map((item) => (
                                                    <li
                                                        key={item}
                                                        className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-slate-100 md:text-[15px]"
                                                    >
                                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </section>
                                ))}
                            </div>
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

export default TermsPage;
