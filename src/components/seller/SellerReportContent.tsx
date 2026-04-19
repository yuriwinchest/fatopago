import { useMemo } from 'react';
import { Calendar, Mail, MessageCircleMore, Phone, TrendingUp, Trophy, User, Users, Zap } from 'lucide-react';
import { buildSellerMetrics, getSellerCommissionAmount } from '../../lib/sellerMetrics';
import { PLAN_LABELS, parsePlanId } from '../../lib/planRules';
import {
    SellerCampaignCustomerRow,
    getSellerCampaignSourceLabel
} from '../../lib/sellerCampaign';

export type SellerReferralRow = {
    id: string;
    created_at: string;
    name: string | null;
    lastname: string | null;
    email: string | null;
    phone?: string | null;
    city: string | null;
    state: string | null;
    source?: string | null;
    campaign_enabled_at?: string | null;
};

export type SellerReportSaleRow = {
    id: string;
    referred_name: string;
    referred_lastname: string;
    referred_email: string | null;
    plan_id: string;
    amount: number;
    status?: string | null;
    created_at: string;
};

export type SellerReportPayload = {
    seller?: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        cpf?: string | null;
        notes: string | null;
        seller_code: string;
        is_active: boolean;
        created_at: string;
        affiliate_link: string;
        avatar_url: string | null;
    };
    referred_users?: SellerReferralRow[];
    sales?: SellerReportSaleRow[];
    campaign_customers?: SellerCampaignCustomerRow[];
};

function toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTimeBR(value?: string | null): string {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPlanLabel(planId?: string | null): string {
    if (!planId) return 'Sem plano';
    const resolvedPlanId = parsePlanId(planId);
    if (resolvedPlanId) {
        return PLAN_LABELS[resolvedPlanId] || planId;
    }
    return planId;
}

function buildWhatsappHref(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${normalized}`;
}

export function SellerReportContent({ report }: { report: SellerReportPayload }) {
    const sales = useMemo(
        () => (Array.isArray(report.sales) ? report.sales : []).map((sale) => ({
            ...sale,
            amount: toNumber(sale.amount)
        })),
        [report.sales]
    );

    const referredUsers = useMemo(
        () => (Array.isArray(report.referred_users) ? report.referred_users : []),
        [report.referred_users]
    );

    const campaignCustomers = useMemo(
        () => (Array.isArray(report.campaign_customers) ? report.campaign_customers : []).map((customer) => ({
            ...customer,
            total_campaign_sales: toNumber(customer.total_campaign_sales),
            total_campaign_revenue: toNumber(customer.total_campaign_revenue),
            cycles_without_campaign_purchase:
                customer.cycles_without_campaign_purchase == null
                    ? null
                    : toNumber(customer.cycles_without_campaign_purchase)
        })),
        [report.campaign_customers]
    );

    const metrics = useMemo(() => buildSellerMetrics(sales.map((sale) => ({
        id: sale.id,
        planId: sale.plan_id,
        amount: toNumber(sale.amount),
        createdAt: sale.created_at
    }))), [sales]);

    const maxDailyRevenue = Math.max(...(metrics?.dailySeries.map((item) => item.revenue) || [0]), 1);
    const maxPlanSales = Math.max(...(metrics?.planBreakdown.map((item) => item.salesCount) || [0]), 1);

    return (
        <>
            <div className="mb-10 flex flex-wrap items-center gap-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#140b31] bg-white/5 shadow-2xl ring-1 ring-white/10">
                    {report.seller?.avatar_url ? (
                        <img src={report.seller.avatar_url} alt={report.seller.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                            <User className="h-10 w-10" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-3xl font-black text-white font-display uppercase tracking-tight">{report.seller?.name || 'Vendedor'}</h3>
                        <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ring-1 ring-inset ${
                            report.seller?.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 ring-rose-500/20'
                        }`}>
                            {report.seller?.is_active ? 'Conta Ativa' : 'Conta Inativa'}
                        </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-500 uppercase tracking-widest">{report.seller?.email}</p>
                    
                    <div className="mt-4 flex flex-wrap gap-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Código Identificador</span>
                            <span className="text-sm font-black text-cyan-400 font-display">{report.seller?.seller_code}</span>
                        </div>
                        <div className="h-8 w-px bg-white/5 hidden sm:block" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Membro desde</span>
                            <span className="text-sm font-black text-slate-300 font-display">{new Date(report.seller?.created_at || '').toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                {[
                    { label: 'Faturamento Hoje', value: metrics?.todayRevenue || 0, color: 'text-glow-amber', icon: <Zap className="h-4 w-4 text-amber-400" /> },
                    { label: 'Total Semana', value: metrics?.weekRevenue || 0, color: 'text-white', icon: <Calendar className="h-4 w-4 text-purple-400" /> },
                    { label: 'Comissão Semana', value: metrics?.weekCommission || 0, color: 'text-emerald-300', icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
                    { label: 'Total Mês', value: metrics?.monthRevenue || 0, color: 'text-white', icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
                    { label: 'Comissão Mês', value: metrics?.monthCommission || 0, color: 'text-emerald-300', icon: <TrendingUp className="h-4 w-4 text-lime-400" /> },
                    { label: 'Leads Ativos', value: referredUsers.length, color: 'text-white', isRaw: true, icon: <Users className="h-4 w-4 text-cyan-400" /> },
                    { label: 'Plano Líder', value: metrics?.bestPlanId, color: 'text-cyan-400', isPlan: true, icon: <Trophy className="h-4 w-4 text-blue-400" /> }
                ].map((stat, i) => (
                    <div key={i} className="admin-glass-card p-6 group transition-all duration-500 hover:bg-white/[0.05] border-white/5 relative overflow-hidden">
                        <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            {stat.icon && <div className="scale-[3]">{stat.icon}</div>}
                        </div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                                {stat.icon}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">{stat.label}</p>
                        </div>
                        <p className={`text-2xl font-black font-display tracking-tight ${stat.color}`}>
                            {stat.isRaw ? stat.value : stat.isPlan ? formatPlanLabel(String(stat.value)) : formatBRL(Number(stat.value))}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                <section className="admin-glass-card p-6 lg:p-8 xl:col-span-12">
                    <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-xl font-black text-white font-display uppercase tracking-widest italic">Performance do Ciclo</h4>
                            <p className="mt-1 text-[10px] text-slate-500 font-display font-medium uppercase tracking-[0.3em]">
                                <span className="text-cyan-400 font-black">{metrics?.salesCount || 0}</span> vendas atribuídas na rede
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-tech">Volume Diário</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-3 sm:gap-6">
                        {(metrics?.dailySeries || []).map((item) => (
                            <div key={item.label} className="flex flex-col items-center gap-4 group">
                                <div className="flex h-56 w-full items-end rounded-[24px] bg-white/[0.05] p-1.5 overflow-hidden border border-white/10 relative shadow-inner">
                                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div 
                                        className="w-full rounded-[18px] bg-gradient-to-t from-cyan-500 via-cyan-300 to-blue-300 transition-all duration-1000 shadow-[0_0_30px_rgba(34,211,238,0.6)] relative group-hover:shadow-[0_0_45px_rgba(34,211,238,0.8)]" 
                                        style={{ height: `${item.revenue > 0 ? Math.max((item.revenue / maxDailyRevenue) * 100, 10) : 6}%` }} 
                                    >
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-4 bg-white/20 rounded-full blur-[1px]" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <span className="block text-xs font-black text-white font-display uppercase group-hover:text-cyan-400 transition-colors tracking-tighter italic">{item.label}</span>
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-tech">{formatBRL(item.revenue)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="admin-glass-card p-6 lg:p-8 xl:col-span-5">
                    <h4 className="mb-8 text-xl font-black text-white font-display uppercase tracking-widest">Top Planos</h4>
                    <div className="space-y-5">
                        {(metrics?.planBreakdown || []).length === 0 ? (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-slate-500 font-display">Ainda não há vendas registradas.</div>
                        ) : (
                            (metrics?.planBreakdown || []).map((item) => (
                                <div key={item.planId} className="group">
                                    <div className="mb-3 flex items-end justify-between">
                                        <div>
                                            <p className="text-sm font-black text-white font-display uppercase tracking-widest group-hover:text-amber-400 transition-colors">{formatPlanLabel(item.planId)}</p>
                                            <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{formatBRL(item.revenue)} acumulado</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-black text-white font-display tracking-tight text-glow-amber">{item.salesCount}</span>
                                            <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest">vendas</span>
                                        </div>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden border border-white/5">
                                        <div 
                                            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,191,36,1),rgba(248,113,113,1))] shadow-[0_0_15px_rgba(251,191,36,0.5)] transition-all duration-1000" 
                                            style={{ width: `${Math.max((item.salesCount / maxPlanSales) * 100, 8)}%` }} 
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <section className="admin-glass-card p-6 lg:p-8">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-xl font-black text-white font-display uppercase tracking-widest">Leads Recentes</h4>
                            <p className="mt-1 text-xs text-slate-500 font-display font-medium uppercase tracking-widest">{referredUsers.length} vínculo(s) ativos</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {referredUsers.slice(0, 6).map((user) => (
                            <div key={user.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all group">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-black text-white font-display group-hover:text-cyan-400 transition-colors">
                                            {`${user.name || ''} ${user.lastname || ''}`.trim() || 'Usuário'}
                                        </p>
                                        <p className="truncate text-xs text-slate-400 font-medium">{user.email || 'E-mail não informado'}</p>
                                        <p className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-display">
                                            {user.city || '-'} / {user.state || '-'} • {formatDateTimeBR(user.created_at)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-300 font-display ring-1 ring-cyan-500/20">
                                        {getSellerCampaignSourceLabel(user.source)}
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {user.phone && (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 border border-white/5">
                                            <Phone className="h-3 w-3 text-cyan-400" />
                                            {user.phone}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 border border-white/5">
                                        Liberação: {formatDateTimeBR(user.campaign_enabled_at)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {referredUsers.length === 0 && (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-slate-500 font-display italic">Nenhum lead comercial atribuído ainda.</div>
                        )}
                    </div>
                </section>

                <section className="admin-glass-card p-6 lg:p-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h4 className="text-xl font-black text-white font-display uppercase tracking-widest">Vendas Recentes</h4>
                            <p className="mt-1 text-xs text-slate-500 font-display font-medium uppercase tracking-widest">Atividade da campanha</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {sales.slice(0, 6).map((sale) => (
                            <div key={sale.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-black text-white font-display group-hover:text-amber-400 transition-colors">
                                            {`${sale.referred_name || ''} ${sale.referred_lastname || ''}`.trim() || 'Usuário'}
                                        </p>
                                        <p className="truncate text-xs text-slate-400 font-medium">{sale.referred_email || 'E-mail não informado'}</p>
                                        <p className="mt-2 inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20 font-display">
                                            {formatPlanLabel(sale.plan_id)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-white font-display tracking-tight text-glow-amber">{formatBRL(sale.amount)}</p>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                                            Comissão 20%: {formatBRL(getSellerCommissionAmount(sale.amount))}
                                        </p>
                                        <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formatDateTimeBR(sale.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sales.length === 0 && (
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-slate-500 font-display italic">Nenhuma venda atribuída até agora.</div>
                        )}
                    </div>
                </section>
            </div>

            <section className="admin-glass-card p-6 lg:p-8">
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">CRM Operacional</p>
                        <h4 className="mt-2 text-2xl font-black text-white font-display uppercase tracking-tight">Gestão de Campanha</h4>
                    </div>
                    <p className="max-w-xl text-xs font-medium leading-relaxed text-slate-400 font-sans border-l-2 border-white/10 pl-4">
                        Acompanhamento centralizado de usuários via link ou habilitação manual. 
                        Compras diárias, semanais e mensais atribuídas ao vendedor aparecem neste CRM para controle comercial e reativação.
                    </p>
                </div>

                {campaignCustomers.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-sm text-slate-500 font-display italic">
                        Nenhum cliente de campanha disponível para acompanhamento no momento.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        {campaignCustomers.map((customer) => {
                            const whatsappHref = buildWhatsappHref(customer.phone);
                            return (
                                <article key={`${customer.user_id}-${customer.linked_at}`} className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-all group overflow-hidden relative">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 group-hover:bg-cyan-500 transition-colors" />
                                    
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-lg font-black text-white font-display group-hover:text-cyan-400 transition-colors">
                                                {[customer.name, customer.lastname].filter(Boolean).join(' ') || 'Usuário'}
                                            </p>
                                            <p className="truncate text-xs text-slate-400 font-medium">{customer.email || 'E-mail não informado'}</p>
                                            <p className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-display">
                                                {customer.city || '-'} / {customer.state || '-'} • Criado em {formatDateTimeBR(customer.linked_at)}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-300 font-display ring-1 ring-cyan-500/20">
                                                {getSellerCampaignSourceLabel(customer.source)}
                                            </span>
                                            {customer.needs_reactivation && (
                                                <span className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-200 font-display ring-1 ring-amber-500/20 animate-pulse">
                                                    Reativar
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Vendas', value: customer.total_campaign_sales, color: 'text-white' },
                                            { label: 'Receita', value: formatBRL(customer.total_campaign_revenue), color: 'text-emerald-400' },
                                            { label: 'Inatividade', value: customer.cycles_without_campaign_purchase == null ? '—' : `${customer.cycles_without_campaign_purchase}c`, color: 'text-white' }
                                        ].map((item, i) => (
                                            <div key={i} className="rounded-xl bg-black/20 p-3 border border-white/5">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 font-display">{item.label}</p>
                                                <p className={`mt-1.5 text-sm font-black font-display ${item.color}`}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 space-y-2.5 text-[11px] text-slate-400 border-t border-white/5 pt-5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold uppercase tracking-widest text-slate-600">Último Plano</span>
                                            <span className="font-black text-white font-display uppercase tracking-tight">{formatPlanLabel(customer.last_campaign_plan_id)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold uppercase tracking-widest text-slate-600">Última Compra</span>
                                            <span className="font-black text-slate-300 font-display">{formatDateTimeBR(customer.last_campaign_purchase_at)}</span>
                                        </div>
                                    </div>

                                    {customer.latest_contact_message && (
                                        <div className="mt-6 rounded-2xl bg-[#0d0724] p-5 border border-white/5 relative">
                                            <div className="absolute -top-2.5 left-4 px-2 bg-[#0d0724] text-[9px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                                                <MessageCircleMore className="h-3 w-3" />
                                                Mensagem Recente
                                            </div>
                                            <p className="text-xs leading-relaxed text-slate-300 font-medium italic">"{customer.latest_contact_message}"</p>
                                        </div>
                                    )}

                                    <div className="mt-6 flex flex-wrap gap-3">
                                        {customer.email && (
                                            <a
                                                href={`mailto:${customer.email}`}
                                                className="h-10 inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 text-[10px] font-black uppercase tracking-widest text-slate-100 hover:bg-white/10 transition-all font-display border border-white/10"
                                            >
                                                <Mail className="h-4 w-4" />
                                                Email
                                            </a>
                                        )}
                                        {whatsappHref && (
                                            <a
                                                href={whatsappHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="h-10 inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/20 transition-all font-display border border-emerald-500/20"
                                            >
                                                <Phone className="h-4 w-4" />
                                                WhatsApp
                                            </a>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </>
    );
}
