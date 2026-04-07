import React, { useCallback, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    DollarSign,
    RefreshCw,
    Search,
    ShoppingCart,
    TrendingUp,
    User,
    Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSellerCommissionAmount, SELLER_COMMISSION_RATE } from '../../lib/sellerMetrics';

type SellerListItem = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf?: string | null;
    seller_code: string;
    affiliate_link: string;
    is_active: boolean;
    signup_count: number;
    paid_customers: number;
    total_revenue: number;
    today_revenue: number;
    week_revenue: number;
    month_revenue: number;
    created_at: string;
    last_signup_at: string | null;
    last_sale_at: string | null;
    avatar_url?: string | null;
};

interface ReportReferral {
    id: string;
    created_at: string;
    affiliate_code: string;
    referred_user_id: string;
    name: string | null;
    lastname: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    avatar_url: string | null;
}

interface ReportSale {
    id: string;
    user_id: string;
    referred_name: string;
    referred_lastname: string;
    referred_email: string | null;
    referred_avatar_url: string | null;
    plan_id: string;
    amount: number;
    status: string;
    created_at: string;
}

interface SellerReport {
    seller: Record<string, unknown>;
    referred_users: ReportReferral[];
    sales: ReportSale[];
}

interface SellerSalesReportProps {
    sellers: SellerListItem[];
    sellersLoading: boolean;
    sellersError: string | null;
    loadSellers: () => Promise<void>;
}

const PLAN_LABELS: Record<string, string> = {
    starter: 'Starter',
    starter_weekly: 'Starter Semanal',
    starter_monthly: 'Starter Mensal',
    pro: 'Pro',
    pro_weekly: 'Pro Semanal',
    pro_monthly: 'Pro Mensal',
    expert: 'Expert',
    expert_weekly: 'Expert Semanal',
    expert_monthly: 'Expert Mensal'
};

const formatCurrency = (value: number | string | null | undefined) =>
    Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
};

const SellerSalesReport: React.FC<SellerSalesReportProps> = ({
    sellers,
    sellersLoading,
    sellersError,
    loadSellers
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
    const [reports, setReports] = useState<Record<string, SellerReport>>({});
    const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
    const [reportErrors, setReportErrors] = useState<Record<string, string>>({});

    const filteredSellers = [...(sellers || [])]
        .sort((a, b) => {
            const aRev = Number(a.total_revenue || 0);
            const bRev = Number(b.total_revenue || 0);
            if (bRev !== aRev) return bRev - aRev;
            return (a.name || '').localeCompare(b.name || '');
        })
        .filter((seller) => {
            const query = searchTerm.trim().toLowerCase();
            if (!query) return true;
            return [seller.name, seller.email, seller.phone, seller.cpf, seller.seller_code]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(query));
        });

    const loadReport = useCallback(async (sellerId: string) => {
        setLoadingReportId(sellerId);
        setReportErrors((prev) => {
            const next = { ...prev };
            delete next[sellerId];
            return next;
        });

        try {
            const { data, error } = await supabase.rpc('admin_get_seller_report', {
                p_seller_id: sellerId
            });

            if (error) throw error;

            const report = (data || {}) as SellerReport;
            setReports((prev) => ({
                ...prev,
                [sellerId]: {
                    seller: report.seller || {},
                    referred_users: Array.isArray(report.referred_users) ? report.referred_users : [],
                    sales: Array.isArray(report.sales) ? report.sales : []
                }
            }));
        } catch (err: any) {
            setReportErrors((prev) => ({
                ...prev,
                [sellerId]: err?.message || 'Erro ao carregar relatório.'
            }));
        } finally {
            setLoadingReportId(null);
        }
    }, []);

    const handleToggleSeller = (sellerId: string) => {
        if (selectedSellerId === sellerId) {
            setSelectedSellerId(null);
            return;
        }

        setSelectedSellerId(sellerId);

        if (!reports[sellerId]) {
            void loadReport(sellerId);
        }
    };

    const totalPlatformRevenue = (sellers || []).reduce(
        (sum, s) => sum + Number(s.total_revenue || 0),
        0
    );
    const totalCommissions = getSellerCommissionAmount(totalPlatformRevenue);
    const totalPaidCustomers = (sellers || []).reduce(
        (sum, s) => sum + Number(s.paid_customers || 0),
        0
    );
    const activeSellers = (sellers || []).filter((s) => s.is_active).length;

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Global summary - Only show if NO seller is selected */}
            {!selectedSellerId && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[24px] border border-white/10 bg-[#16082f] p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                    Receita total via vendedores
                                </p>
                                <p className="mt-1 text-2xl font-black text-white">
                                    {formatCurrency(totalPlatformRevenue)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-emerald-500/15 bg-[#16082f] p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                    Comissões pagas ({(SELLER_COMMISSION_RATE * 100).toFixed(0)}%)
                                </p>
                                <p className="mt-1 text-2xl font-black text-emerald-200">
                                    {formatCurrency(totalCommissions)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-[#16082f] p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
                                <ShoppingCart className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                    Compradores via link
                                </p>
                                <p className="mt-1 text-2xl font-black text-white">
                                    {totalPaidCustomers}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-[#16082f] p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                    Vendedores ativos
                                </p>
                                <p className="mt-1 text-2xl font-black text-white">
                                    {activeSellers}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search + refresh */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/70">
                        {selectedSellerId ? 'Auditória de Performance' : 'Resultados comerciais'}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                        {selectedSellerId ? 'Relatório de Vendedor' : 'Vendas por vendedor'}
                    </h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {selectedSellerId ? (
                        <button
                            type="button"
                            onClick={() => setSelectedSellerId(null)}
                            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-cyan-500/10 px-6 text-sm font-black uppercase tracking-widest text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                            <ChevronDown className="h-4 w-4 rotate-90" />
                            Exibir todos os vendedores
                        </button>
                    ) : (
                        <>
                            <label className="relative block w-full min-w-0 sm:w-[380px]">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f0524] pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/40"
                                    placeholder="Buscar vendedor..."
                                    autoComplete="off"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => void loadSellers()}
                                className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                                title="Atualizar"
                            >
                                <RefreshCw className={`h-5 w-5 ${sellersLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {sellersError && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {sellersError}
                </div>
            )}

            {sellersLoading && (
                <div className="flex min-h-[220px] items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <RefreshCw className="h-7 w-7 animate-spin" />
                        <span className="text-[11px] font-black uppercase tracking-[0.24em]">
                            Carregando vendedores
                        </span>
                    </div>
                </div>
            )}

            {!sellersLoading && filteredSellers.length === 0 && (
                <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-[#120726] text-sm text-slate-400">
                    Nenhum vendedor encontrado.
                </div>
            )}

            {/* Seller cards */}
            <div className="space-y-4">
                {!sellersLoading &&
                    (selectedSellerId
                        ? filteredSellers.filter((s) => s.id === selectedSellerId)
                        : filteredSellers
                    ).map((seller) => {
                        const isExpanded = selectedSellerId === seller.id;
                        const report = reports[seller.id];
                        const isLoadingReport = loadingReportId === seller.id;
                        const reportError = reportErrors[seller.id];
                        const sellerInitial = seller.name?.trim()?.charAt(0)?.toUpperCase() || 'V';
                        const weekCommission = getSellerCommissionAmount(Number(seller.week_revenue || 0));
                        const totalCommission = getSellerCommissionAmount(Number(seller.total_revenue || 0));

                        return (
                            <article
                                key={seller.id}
                                className="overflow-hidden rounded-[24px] border border-white/10 bg-[#120726]"
                            >
                                {/* Header row */}
                                <button
                                    type="button"
                                    onClick={() => handleToggleSeller(seller.id)}
                                    className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:gap-4 sm:px-5"
                                >
                                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                        {seller.avatar_url ? (
                                            <img
                                                src={seller.avatar_url}
                                                alt={seller.name}
                                                className="h-12 w-12 flex-shrink-0 rounded-2xl border border-white/10 object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-cyan-200">
                                                {sellerInitial}
                                            </div>
                                        )}

                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-black text-white sm:text-xl">
                                                {seller.name}
                                            </h3>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                                <span>
                                                    <strong className="text-cyan-200">{seller.paid_customers || 0}</strong> compradores
                                                </span>
                                                <span>
                                                    Receita: <strong className="text-white">{formatCurrency(seller.total_revenue)}</strong>
                                                </span>
                                                <span>
                                                    Comissão: <strong className="text-emerald-200">{formatCurrency(totalCommission)}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-shrink-0 items-center gap-2">
                                        <span
                                            className={`hidden rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] sm:inline-flex ${
                                                seller.is_active
                                                    ? 'bg-emerald-500/15 text-emerald-200'
                                                    : 'bg-slate-500/20 text-slate-300'
                                            }`}
                                        >
                                            {seller.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                                            {isExpanded ? (
                                                <ChevronUp className="h-5 w-5" />
                                            ) : (
                                                <ChevronDown className="h-5 w-5" />
                                            )}
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="border-t border-white/10 px-4 py-5 sm:px-5">
                                        {/* Quick metrics */}
                                        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                    Semana
                                                </p>
                                                <p className="mt-2 text-xl font-black text-white">
                                                    {formatCurrency(seller.week_revenue)}
                                                </p>
                                                <p className="mt-1 text-xs text-emerald-300">
                                                    Comissão: {formatCurrency(weekCommission)}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                    Mês
                                                </p>
                                                <p className="mt-2 text-xl font-black text-white">
                                                    {formatCurrency(seller.month_revenue)}
                                                </p>
                                                <p className="mt-1 text-xs text-emerald-300">
                                                    Comissão: {formatCurrency(getSellerCommissionAmount(Number(seller.month_revenue || 0)))}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                    Cadastros via link
                                                </p>
                                                <p className="mt-2 text-xl font-black text-white">
                                                    {seller.signup_count || 0}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                    Link de vendas
                                                </p>
                                                <p className="mt-2 break-all text-xs font-bold text-cyan-200">
                                                    {seller.affiliate_link}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Loading state */}
                                        {isLoadingReport && (
                                            <div className="flex min-h-[120px] items-center justify-center">
                                                <div className="flex items-center gap-3 text-slate-400">
                                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                                    <span className="text-sm">Carregando detalhes das vendas...</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Error */}
                                        {reportError && (
                                            <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                                                {reportError}
                                                <button
                                                    type="button"
                                                    onClick={() => void loadReport(seller.id)}
                                                    className="ml-3 underline"
                                                >
                                                    Tentar novamente
                                                </button>
                                            </div>
                                        )}

                                        {/* Report loaded */}
                                        {report && !isLoadingReport && (
                                            <div className="space-y-5">
                                                {/* Sales table */}
                                                <div>
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300/80">
                                                            Vendas realizadas ({report.sales.length})
                                                        </h4>
                                                        <button
                                                            type="button"
                                                            onClick={() => void loadReport(seller.id)}
                                                            className="text-xs text-slate-400 underline hover:text-white"
                                                        >
                                                            Atualizar
                                                        </button>
                                                    </div>

                                                    {report.sales.length === 0 ? (
                                                        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f0524] px-4 py-8 text-center text-sm text-slate-400">
                                                            Nenhuma venda registrada via link deste vendedor.
                                                            <p className="mt-2 text-xs text-slate-500">
                                                                As vendas aparecem quando um usuario se cadastra usando o link do vendedor e depois compra um plano.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-2xl border border-white/10">
                                                            <table className="w-full min-w-[640px] text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-white/10 bg-white/[0.03]">
                                                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Comprador
                                                                        </th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Plano
                                                                        </th>
                                                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Valor
                                                                        </th>
                                                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Comissão ({(SELLER_COMMISSION_RATE * 100).toFixed(0)}%)
                                                                        </th>
                                                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Data
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {report.sales.map((sale) => {
                                                                        const amount = Number(sale.amount || 0);
                                                                        const commission = getSellerCommissionAmount(amount);
                                                                        const buyerName = [sale.referred_name, sale.referred_lastname]
                                                                            .filter(Boolean)
                                                                            .join(' ')
                                                                            .trim() || 'Usuário';

                                                                        return (
                                                                            <tr
                                                                                key={sale.id}
                                                                                className="border-b border-white/5 transition hover:bg-white/[0.02]"
                                                                            >
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {sale.referred_avatar_url ? (
                                                                                            <img
                                                                                                src={sale.referred_avatar_url}
                                                                                                alt=""
                                                                                                className="h-7 w-7 rounded-full object-cover"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
                                                                                                <User className="h-3.5 w-3.5" />
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate font-bold text-white">
                                                                                                {buyerName}
                                                                                            </p>
                                                                                            {sale.referred_email && (
                                                                                                <p className="truncate text-xs text-slate-400">
                                                                                                    {sale.referred_email}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3">
                                                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-200">
                                                                                        {PLAN_LABELS[sale.plan_id] || sale.plan_id}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-bold text-white">
                                                                                    {formatCurrency(amount)}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-bold text-emerald-300">
                                                                                    {formatCurrency(commission)}
                                                                                </td>
                                                                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">
                                                                                    {formatDateTime(sale.created_at)}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr className="border-t border-white/10 bg-white/[0.03]">
                                                                        <td
                                                                            colSpan={2}
                                                                            className="px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400"
                                                                        >
                                                                            Total ({report.sales.length} vendas)
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-base font-black text-white">
                                                                            {formatCurrency(
                                                                                report.sales.reduce(
                                                                                    (sum, s) => sum + Number(s.amount || 0),
                                                                                    0
                                                                                )
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-base font-black text-emerald-300">
                                                                            {formatCurrency(
                                                                                getSellerCommissionAmount(
                                                                                    report.sales.reduce(
                                                                                        (sum, s) => sum + Number(s.amount || 0),
                                                                                        0
                                                                                    )
                                                                                )
                                                                            )}
                                                                        </td>
                                                                        <td />
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Referred users */}
                                                {report.referred_users.length > 0 && (
                                                    <div>
                                                        <h4 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                                                            Cadastros via link ({report.referred_users.length})
                                                        </h4>
                                                        <div className="overflow-x-auto rounded-2xl border border-white/10">
                                                            <table className="w-full min-w-[480px] text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-white/10 bg-white/[0.03]">
                                                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Usuario
                                                                        </th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Cidade / Estado
                                                                        </th>
                                                                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                                                            Data de cadastro
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {report.referred_users.map((ref) => {
                                                                        const refName = [ref.name, ref.lastname]
                                                                            .filter(Boolean)
                                                                            .join(' ')
                                                                            .trim() || 'Usuário';
                                                                        const hasSale = report.sales.some(
                                                                            (s) => s.user_id === ref.referred_user_id
                                                                        );

                                                                        return (
                                                                            <tr
                                                                                key={ref.id}
                                                                                className="border-b border-white/5 transition hover:bg-white/[0.02]"
                                                                            >
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {ref.avatar_url ? (
                                                                                            <img
                                                                                                src={ref.avatar_url}
                                                                                                alt=""
                                                                                                className="h-7 w-7 rounded-full object-cover"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
                                                                                                <User className="h-3.5 w-3.5" />
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate font-bold text-white">
                                                                                                {refName}
                                                                                            </p>
                                                                                            {ref.email && (
                                                                                                <p className="truncate text-xs text-slate-400">
                                                                                                    {ref.email}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                        {hasSale && (
                                                                                            <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                                                                                Pagante
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-slate-300">
                                                                                    {[ref.city, ref.state].filter(Boolean).join(', ') || '—'}
                                                                                </td>
                                                                                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">
                                                                                    {formatDateTime(ref.created_at)}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Empty state - no referrals at all */}
                                                {report.referred_users.length === 0 && report.sales.length === 0 && (
                                                    <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center">
                                                        <p className="text-sm font-bold text-amber-200">
                                                            Nenhum usuario se cadastrou usando o link deste vendedor.
                                                        </p>
                                                        <p className="mt-2 text-xs text-slate-400">
                                                            Verifique se o vendedor esta divulgando o link correto:{' '}
                                                            <span className="font-bold text-cyan-300">{seller.affiliate_link}</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
            </div>
        </div>
    );
};

export default SellerSalesReport;
