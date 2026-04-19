import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, Copy, RefreshCw, User, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SellerHeader } from '../components/seller/SellerHeader';
import MonthlySellerLinksGrid from '../components/seller/MonthlySellerLinksGrid';
import { SellerReportContent, type SellerReportPayload } from '../components/seller/SellerReportContent';
import ContactRequestList from '../components/contact/ContactRequestList';
import WithdrawalModal from '../components/WithdrawalModal';
import { useFinancial } from '../hooks/useFinancial';
import { formatCpf, isValidCpf, normalizeCpf } from '../lib/cpf';
import { getPixWithdrawalStatusLabel } from '../lib/pixWithdrawals';
import {
    enableSellerCampaignForContactMessage,
    SellerContactMessageRow,
    listMySellerContactMessages
} from '../lib/sellerContactMessages';

type SellerReportState = {
    report: SellerReportPayload | null;
    loading: boolean;
    error: string | null;
};

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        window.prompt('Copie manualmente:', text);
    }
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

const SellerDashboard = () => {
    const [state, setState] = useState<SellerReportState>({
        report: null,
        loading: true,
        error: null
    });
    const [contactMessages, setContactMessages] = useState<SellerContactMessageRow[]>([]);
    const [contactMessagesLoading, setContactMessagesLoading] = useState(true);
    const [contactMessagesError, setContactMessagesError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [activatingMessageId, setActivatingMessageId] = useState<string | null>(null);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [cpfValue, setCpfValue] = useState('');
    const [savingCpf, setSavingCpf] = useState(false);
    const { balance, withdrawals, triggerRefresh, pendingWithdrawalsCount } = useFinancial();

    const fetchReport = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const { data, error } = await supabase.rpc('seller_get_my_report');
        if (error) {
            setState({ report: null, loading: false, error: error.message || 'Não foi possível carregar seu painel.' });
            return;
        }

        setState({
            report: (data || {}) as SellerReportPayload,
            loading: false,
            error: null
        });
    };

    const fetchContactMessages = async () => {
        try {
            setContactMessagesLoading(true);
            setContactMessagesError(null);
            const rows = await listMySellerContactMessages(20);
            setContactMessages(rows);
        } catch (error: any) {
            console.error('Falha ao carregar mensagens comerciais do vendedor:', error);
            setContactMessages([]);
            setContactMessagesError(error?.message || 'Não foi possível carregar as mensagens comerciais.');
        } finally {
            setContactMessagesLoading(false);
        }
    };

    useEffect(() => {
        void fetchReport();
        void fetchContactMessages();
    }, []);

    useEffect(() => {
        setCpfValue(state.report?.seller?.cpf || '');
    }, [state.report?.seller?.cpf]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    const seller = state.report?.seller;
    const affiliateLink = seller?.affiliate_link || '';
    const canRequestWithdrawal = balance >= 10;
    const sellerCpf = normalizeCpf(seller?.cpf || '');
    const sellerNeedsCpf = !sellerCpf;
    const latestWithdrawal = withdrawals[0] || null;

    const handleSaveCpf = async () => {
        const normalizedCpf = normalizeCpf(cpfValue);

        if (!normalizedCpf) {
            setFeedback('Informe o CPF para continuar.');
            return;
        }

        if (!isValidCpf(normalizedCpf)) {
            setFeedback('Informe um CPF válido para regularizar o cadastro.');
            return;
        }

        try {
            setSavingCpf(true);
            setFeedback(null);

            const { data, error } = await supabase.rpc('seller_update_my_cpf', {
                p_cpf: normalizedCpf
            });

            if (error) throw error;
            if ((data as any)?.status !== 'ok') {
                throw new Error('Não foi possível atualizar o CPF do vendedor.');
            }

            await fetchReport();
            setFeedback('CPF atualizado com sucesso.');
        } catch (error: any) {
            setFeedback(error?.message || 'Não foi possível atualizar o CPF agora.');
        } finally {
            setSavingCpf(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020108] bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.15),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.1),_transparent_40%),radial-gradient(circle_at_center,_rgba(45,10,105,0.05),_transparent_60%)] font-sans text-white antialiased selection:bg-purple-500/30">
            <SellerHeader onLogout={handleLogout} />

            <main className="mx-auto mt-8 w-full max-w-[1200px] px-6 pb-16 lg:px-8">
                {feedback && (
                    <div className="admin-glass-card mb-6 border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-sm text-emerald-100 font-display">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {feedback}
                        </div>
                    </div>
                )}
                {state.loading ? (
                    <div className="admin-glass-card p-12 text-center text-slate-400 font-display uppercase tracking-widest text-[10px] font-bold">Carregando painel do vendedor...</div>
                ) : state.error ? (
                    <div className="admin-glass-card p-12 text-center text-red-400 border-red-500/20 font-display uppercase tracking-widest text-[10px] font-bold">{state.error}</div>
                ) : !state.report ? (
                    <div className="admin-glass-card p-12 text-center text-slate-500 font-display uppercase tracking-widest text-[10px] font-bold">Nenhum dado disponível.</div>
                ) : (
                    <div className="space-y-8">
                        <section className="admin-glass-card p-6 lg:p-8">
                            <div className="flex flex-col gap-8 md:flex-row md:items-center">
                                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#140b31] bg-white/5 shadow-2xl ring-1 ring-white/10">
                                    {seller?.avatar_url ? (
                                        <img src={seller.avatar_url} alt={seller.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                                            <User className="h-10 w-10" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-1 w-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 font-display">Seu Acesso Comercial</p>
                                    </div>
                                    <h2 className="mt-2 truncate text-3xl font-extrabold text-white font-display tracking-tight text-glow-amber uppercase [word-spacing:0.2em]">{seller?.name || 'Vendedor'}</h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <p className="truncate text-sm text-slate-400 font-display font-medium">{seller?.email || 'E-mail não informado'}</p>
                                        <div className="h-1 w-1 rounded-full bg-slate-700 hidden sm:block" />
                                        <p className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300 font-display">
                                            Cod: {seller?.seller_code || '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={() => seller?.seller_code && void copyToClipboard(seller.seller_code)}
                                        className="h-11 inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/12 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-500/20 transition-all font-display"
                                    >
                                        <Copy className="h-4 w-4" />
                                        Copiar Código
                                    </button>
                                    <button
                                        onClick={() => {
                                            void fetchReport();
                                            void fetchContactMessages();
                                        }}
                                        className="h-11 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-100 hover:bg-white/10 transition-all font-display"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
                                        Atualizar
                                    </button>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em]">
                                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                                    CPF: {sellerCpf ? formatCpf(sellerCpf) : 'Pendente'}
                                </span>
                            </div>
                            {affiliateLink && (
                                <div className="mt-8 overflow-hidden rounded-2xl border border-white/5 bg-black/20 group">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display shrink-0">Link do Vendedor:</span>
                                        <code className="truncate text-sm font-mono text-slate-300 select-all group-hover:text-cyan-300 transition-colors">
                                            {affiliateLink}
                                        </code>
                                    </div>
                                </div>
                            )}
                            {affiliateLink && (
                                <div className="mt-6 border-t border-white/5 pt-6">
                                    <MonthlySellerLinksGrid affiliateLink={affiliateLink} />
                                </div>
                            )}
                        </section>

                        {sellerNeedsCpf && (
                            <section className="admin-glass-card border-amber-500/20 bg-amber-500/5 p-6 lg:p-8">
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
                                            <AlertTriangle className="h-4 w-4" />
                                            Cadastro incompleto
                                        </p>
                                        <h3 className="mt-3 text-2xl font-black uppercase tracking-tight text-white font-display">
                                            Informe seu CPF para regularizar o cadastro comercial
                                        </h3>
                                        <p className="mt-3 text-sm leading-relaxed text-amber-100/85">
                                            O CPF passou a ser obrigatório para vendedores. Complete este dado no seu painel para manter o cadastro comercial consistente.
                                        </p>
                                    </div>

                                    <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0f0524] p-4">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                            CPF do vendedor
                                        </label>
                                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                            <input
                                                type="text"
                                                value={cpfValue}
                                                onChange={(event) => setCpfValue(event.target.value)}
                                                className="h-12 flex-1 rounded-2xl border border-white/10 bg-[#16082f] px-4 text-sm text-white outline-none transition focus:border-amber-400/40"
                                                placeholder="Digite seu CPF"
                                                autoComplete="off"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void handleSaveCpf()}
                                                disabled={savingCpf}
                                                className="inline-flex h-12 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 text-xs font-black uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {savingCpf ? 'Salvando...' : 'Salvar CPF'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="admin-glass-card p-6 lg:p-8">
                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-500 font-display">
                                        Carteira comercial
                                    </p>
                                    <h3 className="mt-3 text-2xl font-black uppercase tracking-tight text-white font-display">
                                        Saque de comissão do vendedor
                                    </h3>
                                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                                        O saldo abaixo representa apenas comissões comerciais já creditadas sobre vendas
                                        atribuídas ao seu painel. O saque usa o mesmo motor PIX seguro da plataforma e a
                                        chave PIX é informada no momento da solicitação.
                                    </p>
                                </div>

                                <div className="overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(8,47,73,0.12))] p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
                                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                                        <Wallet className="h-4 w-4" />
                                        Comissão disponível
                                    </p>
                                    <p className="mt-3 text-4xl font-black leading-none text-white">
                                        {formatCurrency(balance)}
                                    </p>
                                    <p className="mt-3 text-xs leading-relaxed text-emerald-100/80">
                                        Saque minimo de R$ 10,00. O status real do saque fica visivel no painel conforme o backend recebe as confirmacoes do provedor.
                                    </p>

                                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70">
                                            Acompanhamento
                                        </p>
                                        <p className="mt-2 text-sm font-bold text-white">
                                            {pendingWithdrawalsCount > 0
                                                ? `${pendingWithdrawalsCount} saque(s) em andamento`
                                                : 'Nenhum saque em andamento'}
                                        </p>
                                        {latestWithdrawal && (
                                            <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">
                                                Ultimo status: {getPixWithdrawalStatusLabel(latestWithdrawal.status)} em {new Date(latestWithdrawal.created_at).toLocaleString('pt-BR')}.
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowWithdrawModal(true)}
                                        disabled={!canRequestWithdrawal}
                                        className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white text-sm font-black uppercase tracking-[0.18em] text-emerald-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                                    >
                                        <ArrowDownLeft className="h-4 w-4" />
                                        Sacar comissão via PIX
                                    </button>
                                </div>
                            </div>
                        </section>

                        <ContactRequestList
                            title="Mensagens recebidas dos usuários"
                            subtitle="Quando alguém pedir ajuda comercial, você recebe a solicitação aqui. Ao habilitar a campanha para a conta do usuário, as próximas compras diárias, semanais e mensais passam a entrar no seu CRM e na sua receita atribuída."
                            emptyMessage={contactMessagesError || 'Nenhum usuário pediu atendimento comercial para este vendedor ainda.'}
                            messages={contactMessages}
                            loading={contactMessagesLoading}
                            renderActions={(message) => (
                                message.can_enable_campaign ? (
                                    <button
                                        type="button"
                                        onClick={() => void (async () => {
                                            try {
                                                setActivatingMessageId(message.id);
                                                setFeedback(null);
                                                await enableSellerCampaignForContactMessage(message.id);
                                                await Promise.all([fetchContactMessages(), fetchReport()]);
                                                setFeedback(`Campanha liberada para ${message.user_name}. As compras diárias, semanais e mensais feitas a partir de agora passam a contar no seu painel.`);
                                            } catch (error: any) {
                                                console.error('Falha ao habilitar planos para o usuário:', error);
                                                setFeedback(error?.message || 'Não foi possível habilitar os planos agora.');
                                            } finally {
                                                setActivatingMessageId(null);
                                            }
                                        })()}
                                        disabled={activatingMessageId === message.id}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                                    >
                                        {activatingMessageId === message.id ? 'Habilitando...' : 'Habilitar planos'}
                                    </button>
                                ) : (
                                    <span className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                                        {message.campaign_access_status === 'enabled_for_this_seller'
                                            ? 'Planos já liberados'
                                            : 'Usuário já vinculado'}
                                    </span>
                                )
                            )}
                        />

                        <SellerReportContent report={state.report} />
                    </div>
                )}
            </main>

            <WithdrawalModal
                isOpen={showWithdrawModal}
                onClose={() => setShowWithdrawModal(false)}
                currentBalance={balance}
                onSuccess={() => {
                    triggerRefresh();
                    void fetchReport();
                    setFeedback('Solicitacao de saque registrada. O painel vai atualizar o status conforme o backend receber o retorno do provedor.');
                }}
            />
        </div>
    );
};

export default SellerDashboard;
