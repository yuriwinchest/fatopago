import React from 'react';
import { RefreshCw, Users, Trophy, CreditCard, Calendar, ArrowUpRight, TrendingUp, Search, UserCheck, MousePointerClick, Wallet, Package } from 'lucide-react';
import { ExtendedAdminUser } from '../../hooks/useAdminData';
import { formatBRL, formatDateTimeBR, toNumber } from '../../utils/format';
import { buildCycleInsights } from '../../lib/adminCycleInsights';

const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

const toBusinessDayKey = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return year && month && day ? `${year}-${month}-${day}` : '';
};

interface CycleManagementProps {
    cycleOptions: any[];
    selectedCycleOffset: number;
    setSelectedCycleOffset: (v: number) => void;
    cycleBundle: any;
    cycleLoading: boolean;
    cycleError: string | null;
    fetchCycleData: (offset: number) => Promise<void>;
    profileById: Map<string, ExtendedAdminUser>;
    handleUserClick: (user: ExtendedAdminUser) => void;
}

const CycleManagement: React.FC<CycleManagementProps> = ({
    cycleOptions,
    selectedCycleOffset,
    setSelectedCycleOffset,
    cycleBundle,
    cycleLoading,
    cycleError,
    fetchCycleData,
    profileById,
    handleUserClick
}) => {
    const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [currentActivityPage, setCurrentActivityPage] = React.useState(1);
    const activityPageSize = 10;

    const cycleDays = React.useMemo(() => {
        if (!cycleBundle?.start || !cycleBundle?.end) return [];
        const start = new Date(cycleBundle.start);
        const end = new Date(cycleBundle.end);
        const days: string[] = [];
        const curr = new Date(start);
        curr.setHours(0, 0, 0, 0);
        
        const stop = new Date(end);
        stop.setHours(23, 59, 59, 999);

        while (curr <= stop) {
            days.push(toBusinessDayKey(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return days;
    }, [cycleBundle?.start, cycleBundle?.end]);

    const cycleInsights = React.useMemo(() => {
        if (!cycleBundle) return null;

        return buildCycleInsights({
            start: cycleBundle.start,
            end: cycleBundle.end,
            profilesCreated: cycleBundle.profilesCreated || [],
            pixPayments: cycleBundle.pixPayments || [],
            sellerReferrals: cycleBundle.sellerReferrals || [],
            sellerFunnelEvents: cycleBundle.sellerFunnelEvents || [],
            sellerCommissionCredits: cycleBundle.sellerCommissionCredits || [],
            sellerDirectory: cycleBundle.sellerDirectory || []
        });
    }, [cycleBundle]);

    const dailyStats = cycleInsights?.byDay || {};
    const selectedDayInsight = selectedDay ? dailyStats[selectedDay] ?? null : null;
    const activeInsight = selectedDayInsight ?? cycleInsights?.summary ?? null;

    React.useEffect(() => {
        if (cycleBundle?.isActive) {
            const today = toBusinessDayKey(new Date());
            if (cycleDays.includes(today)) setSelectedDay(today);
        }
    }, [cycleBundle?.isActive, cycleDays]);

    React.useEffect(() => {
        setCurrentActivityPage(1);
    }, [selectedDay, searchTerm, selectedCycleOffset]);

    const filteredActivity = React.useMemo(() => {
        if (!cycleBundle) return null;
        
        let profiles = cycleBundle.profilesCreated || [];
        let pix = cycleBundle.pixPayments || [];

        if (selectedDay) {
            profiles = profiles.filter((p: any) => p.created_at.startsWith(selectedDay));
            pix = pix.filter((p: any) => p.created_at.startsWith(selectedDay));
        }

        const approvedPix = pix.filter((p: any) => {
            const status = String(p?.status || '').toLowerCase();
            return ['approved', 'paid', 'completed', 'authorized', 'active'].includes(status) || Boolean(p?.plan_activated_at);
        });

        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            profiles = profiles.filter((p: any) => 
                (p.name || '').toLowerCase().includes(s) || 
                (p.lastname || '').toLowerCase().includes(s) || 
                (p.email || '').toLowerCase().includes(s)
            );
        }

        return { profiles, approvedPix };
    }, [cycleBundle, selectedDay, searchTerm]);

    const activityProfiles = filteredActivity?.profiles || [];
    const activityTotalPages = Math.max(1, Math.ceil(activityProfiles.length / activityPageSize));
    const safeActivityPage = Math.min(currentActivityPage, activityTotalPages);
    const paginatedActivityProfiles = React.useMemo(() => {
        const startIndex = (safeActivityPage - 1) * activityPageSize;
        return activityProfiles.slice(startIndex, startIndex + activityPageSize);
    }, [activityProfiles, safeActivityPage]);

    const topSellerDetails = activeInsight?.topSellerDetails || null;

    React.useEffect(() => {
        if (currentActivityPage > activityTotalPages) {
            setCurrentActivityPage(activityTotalPages);
        }
    }, [currentActivityPage, activityTotalPages]);

    const getSellerName = (userId: string) => {
        const ref = cycleBundle?.sellerReferrals?.find((r: any) => String(r.referred_user_id) === userId);
        if (!ref) return null;
        const sellerFromDirectory = (cycleBundle?.sellerDirectory || []).find((seller: any) => String(seller.id) === String(ref.seller_id));
        if (sellerFromDirectory?.name) return sellerFromDirectory.name;
        const seller = profileById.get(String(ref.seller_id));
        return seller ? `${seller.name} ${seller.lastname}` : 'Vendedor';
    };

    if (cycleError) return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <p className="text-red-200 font-bold uppercase tracking-widest text-xs mb-4">{cycleError}</p>
            <button onClick={() => fetchCycleData(selectedCycleOffset)} className="text-white bg-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Tentar Novamente</button>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="px-1">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-8 w-1 bg-fuchsia-600 rounded-full shadow-[0_0_15px_rgba(192,38,211,0.5)]" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-[0.15em] font-display">Performance Pro Max</h2>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">
                            Entradas, pagantes e desempenho comercial do ciclo
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <select
                                value={selectedCycleOffset}
                                onChange={(e) => setSelectedCycleOffset(Number(e.target.value))}
                                className="relative h-11 min-w-[22rem] rounded-xl border border-white/10 bg-[#0F0529] px-4 text-[10px] font-black uppercase tracking-widest text-white focus:border-fuchsia-500/50 focus:outline-none transition-all cursor-pointer"
                            >
                                {cycleOptions.map((c) => (
                                    <option key={c.offset} value={c.offset}>
                                        {`Ciclo #${c.cycle_number} • ${formatDateTimeBR(c.cycle_start_at).split(',')[0]} → ${formatDateTimeBR(c.cycle_end_at).split(',')[0]}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => void fetchCycleData(selectedCycleOffset)}
                            disabled={cycleLoading}
                            title="Atualizar dados do Ciclo"
                            className={`p-3 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all active:scale-95 ${cycleLoading ? 'opacity-50' : ''}`}
                        >
                            <RefreshCw className={`w-5 h-5 ${cycleLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Ciclo', value: cycleBundle?.isActive ? 'Ativo' : 'Finalizado', sub: `Ciclo #${cycleBundle?.cycleNumber}`, icon: Calendar, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
                    { label: 'Entradas no Ciclo', value: cycleInsights?.summary.registrationsCount || 0, sub: 'Cadastros concluídos', icon: ArrowUpRight, color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
                    { label: 'Ativos no Ciclo', value: cycleInsights?.summary.activeUsersCount || 0, sub: 'Cadastro ou pagamento no período', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { label: 'Pagantes no Ciclo', value: cycleInsights?.summary.paidUsersCount || 0, sub: `${cycleBundle?.salesCount || 0} pagamentos aprovados`, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Arrecadação', value: formatBRL(cycleInsights?.summary.revenue || 0), sub: 'Receita confirmada', icon: TrendingUp, color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
                    { label: 'Comissão', value: formatBRL(cycleInsights?.summary.sellerCommissionTotal || 0), sub: 'Vendedores no ciclo', icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Link Líder', value: cycleInsights?.summary.topLinkSeller.sellerName || '—', sub: `${cycleInsights?.summary.topLinkSeller.count || 0} clique(s)`, icon: MousePointerClick, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                    { label: 'Vendedor Líder', value: cycleInsights?.summary.topSeller.sellerName || '—', sub: `${cycleInsights?.summary.topSeller.count || 0} venda(s)`, icon: UserCheck, color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
                    { label: 'Pacote Líder', value: cycleInsights?.summary.topPlan.planLabel || '—', sub: cycleInsights?.summary.topPlan.sellerName || 'Sem vendedor líder', icon: Package, color: 'text-amber-300', bg: 'bg-amber-500/10' },
                ].map((item, i) => (
                    <div key={i} className="admin-glass-card group overflow-hidden relative p-6">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${item.bg} blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity`} />
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${item.bg}`}>
                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">{item.label}</span>
                            </div>
                            <div className="text-3xl font-black text-white font-display tracking-tight mb-1">{item.value}</div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>{item.sub}</span>
                                {item.label === 'Arrecadação' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-4 space-y-6">
                    <div className="admin-glass-card p-6 h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white font-display">Calendário do Ciclo</h3>
                            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest">
                                <span className="flex items-center gap-1 text-cyan-300">
                                    <span className="w-2 h-2 rounded-sm bg-cyan-500/60" /> Entradas
                                </span>
                                <span className="flex items-center gap-1 text-emerald-300">
                                    <span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Pagantes
                                </span>
                            </div>
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-4">
                            Cada dia mostra <span className="text-cyan-300">entradas</span> / <span className="text-emerald-300">pagantes</span>. Clique para filtrar.
                        </p>

                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                <div key={i} className="text-center text-[9px] font-black text-slate-600 uppercase mb-2">{d}</div>
                            ))}
                            {cycleDays.map((day) => {
                                const stats = dailyStats[day];
                                const isSelected = selectedDay === day;
                                const isToday = day === new Date().toISOString().split('T')[0];
                                const regCount = stats?.registrationsCount || 0;
                                const paidCount = stats?.paidUsersCount || 0;
                                return (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        title={`${new Date(day + 'T12:00:00').toLocaleDateString('pt-BR')} — ${regCount} entrada(s), ${paidCount} pagante(s)`}
                                        className={`relative aspect-square rounded-xl border flex flex-col items-center justify-between py-1.5 transition-all duration-300 group
                                            ${isSelected
                                                ? 'bg-fuchsia-600 border-fuchsia-400 shadow-[0_0_20px_rgba(192,38,211,0.3)] text-white scale-105 z-10'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <span className={`text-[11px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                            {new Date(day + 'T12:00:00').getDate()}
                                        </span>
                                        <div className="flex items-center gap-0.5 leading-none">
                                            <span
                                                className={`min-w-[16px] px-1 rounded-md text-[9px] font-black tabular-nums
                                                    ${regCount > 0
                                                        ? (isSelected ? 'bg-white/25 text-white' : 'bg-cyan-500/20 text-cyan-300')
                                                        : (isSelected ? 'bg-white/10 text-white/60' : 'bg-white/5 text-slate-600')}`}
                                                title="Entradas (cadastros)"
                                            >
                                                {regCount}
                                            </span>
                                            <span
                                                className={`min-w-[16px] px-1 rounded-md text-[9px] font-black tabular-nums
                                                    ${paidCount > 0
                                                        ? (isSelected ? 'bg-white/25 text-white' : 'bg-emerald-500/20 text-emerald-300')
                                                        : (isSelected ? 'bg-white/10 text-white/60' : 'bg-white/5 text-slate-600')}`}
                                                title="Pagantes (pagamentos aprovados)"
                                            >
                                                {paidCount}
                                            </span>
                                        </div>
                                        {isToday && <div className="absolute -bottom-1 w-4 h-0.5 bg-fuchsia-500 rounded-full" />}
                                    </button>
                                );
                            })}
                        </div>

                        <button 
                            onClick={() => setSelectedDay(null)}
                            className={`w-full py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all
                                ${!selectedDay 
                                    ? 'bg-white/10 border-white/20 text-white' 
                                    : 'bg-transparent border-white/5 text-slate-500 hover:text-white'}`}
                        >
                            Ver Resumo Total do Ciclo
                        </button>

                        <div className="mt-8 space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-display">
                                        {selectedDay
                                            ? `Resumo de ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString('pt-BR')}`
                                            : 'Resumo total do ciclo'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Entradas, pagantes, comissão e vendedor líder do período
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Entraram', value: activeInsight?.registrationsCount || 0, icon: ArrowUpRight, color: 'text-sky-300', bg: 'bg-sky-500/10' },
                                        { label: 'Ativos', value: activeInsight?.activeUsersCount || 0, icon: Users, color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
                                        { label: 'Pagaram', value: activeInsight?.paidUsersCount || 0, icon: CreditCard, color: 'text-emerald-300', bg: 'bg-emerald-500/10' },
                                        { label: 'Não pagaram', value: activeInsight?.unpaidUsersCount || 0, icon: Search, color: 'text-rose-300', bg: 'bg-rose-500/10' },
                                        { label: 'Arrecadação', value: formatBRL(activeInsight?.revenue || 0), icon: TrendingUp, color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
                                        { label: 'Comissão', value: formatBRL(activeInsight?.sellerCommissionTotal || 0), icon: Wallet, color: 'text-amber-300', bg: 'bg-amber-500/10' }
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-xl border border-white/10 bg-[#12062b] p-4">
                                            <div className="mb-2 flex items-center gap-2">
                                                <div className={`rounded-lg border border-white/10 p-2 ${item.bg}`}>
                                                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</span>
                                            </div>
                                            <div className="text-lg font-black text-white font-display">{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#12062b] p-4">
                                    <div className="flex items-start gap-3">
                                        <MousePointerClick className="mt-0.5 h-4 w-4 text-sky-300" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Link mais acessado</p>
                                            <p className="text-sm font-black text-white font-display">
                                                {activeInsight?.topLinkSeller?.sellerName || 'Nenhum clique registrado'}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                {activeInsight?.topLinkSeller?.count || 0} clique(s)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <UserCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vendedor que mais vendeu</p>
                                            <p className="text-sm font-black text-white font-display">
                                                {activeInsight?.topSeller?.sellerName || 'Nenhuma venda aprovada'}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                {activeInsight?.topSeller?.count || 0} venda(s)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <Package className="mt-0.5 h-4 w-4 text-amber-300" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pacote que mais saiu</p>
                                            <p className="text-sm font-black text-white font-display">
                                                {activeInsight?.topPlan?.planLabel || '—'}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                {activeInsight?.topPlan?.salesCount || 0} venda(s)
                                                {activeInsight?.topPlan?.sellerName ? ` • ${activeInsight.topPlan.sellerName}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-white/10 bg-[#12062b] p-4">
                                    <div className="mb-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            {selectedDay ? 'Melhor vendedor do dia' : 'Melhor vendedor do ciclo'}
                                        </p>
                                        <p className="mt-1 text-sm font-black text-white font-display">
                                            {topSellerDetails?.sellerName || 'Nenhum vendedor com venda aprovada'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Entradas via link', value: topSellerDetails?.registrationsCount || 0 },
                                            { label: 'Pagaram', value: topSellerDetails?.paidUsersCount || 0 },
                                            { label: 'Não pagaram', value: topSellerDetails?.unpaidUsersCount || 0 },
                                            { label: 'Vendas aprovadas', value: topSellerDetails?.salesCount || 0 },
                                            { label: 'Cliques no link', value: topSellerDetails?.linkClicks || 0 },
                                            { label: 'Visitas no convite', value: topSellerDetails?.inviteVisits || 0 }
                                        ].map((item) => (
                                            <div key={item.label} className="rounded-xl border border-white/10 bg-[#160731] p-3">
                                                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                                                <div className="mt-1 text-lg font-black text-white font-display">{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-white/10 bg-[#160731] p-3">
                                            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Receita atribuída</div>
                                            <div className="mt-1 text-lg font-black text-emerald-300 font-display">{formatBRL(topSellerDetails?.revenue || 0)}</div>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-[#160731] p-3">
                                            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Comissão no período</div>
                                            <div className="mt-1 text-lg font-black text-amber-300 font-display">{formatBRL(topSellerDetails?.sellerCommissionTotal || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Conversão do Ciclo</span>
                                    <span className="text-xs font-black text-emerald-400 font-display">
                                        {cycleBundle && cycleBundle.profilesCreated?.length > 0
                                            ? `${((cycleBundle.salesCount / cycleBundle.profilesCreated.length) * 100).toFixed(1)}%`
                                            : '0%'}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-fuchsia-600 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(192,38,211,0.3)] transition-all duration-1000"
                                        style={{ width: `${cycleBundle && cycleBundle.profilesCreated?.length > 0 ? (cycleBundle.salesCount / cycleBundle.profilesCreated.length) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-8 flex flex-col gap-6">
                    <div className="admin-glass-card flex flex-col grow min-h-[500px]">
                        <div className="p-6 border-b border-white/5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/[0.01]">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white font-display">Cadastros do Ciclo</h3>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {selectedDay ? `Entradas de ${new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Entradas acumuladas do ciclo'}
                                </p>
                            </div>

                            <div className="relative group min-w-[15rem]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text"
                                    placeholder="BUSCAR NOME OU EMAIL..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#0F0529] border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-300 focus:border-fuchsia-500/50 focus:outline-none transition-all placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto relative scrollbar-hide">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-[#1A0B38] border-b border-white/10 backdrop-blur-md">
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">Timestamp</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">Identidade</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">Atribuição</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 font-display">Status</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 font-display text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {activityProfiles.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-30">
                                                    <Search className="w-8 h-8 text-slate-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nenhum evento encontrado</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedActivityProfiles.map((p: any) => {
                                            const isPaid = filteredActivity?.approvedPix?.some((px: any) => String(px.user_id) === String(p.id)) || false;
                                            const sellerName = getSellerName(p.id);
                                            return (
                                                <tr 
                                                    key={p.id} 
                                                    className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                                                    onClick={() => handleUserClick(profileById?.get(String(p.id)) || p)}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-[10px] font-bold text-slate-500 font-display uppercase tabular-nums">
                                                            {formatDateTimeBR(p.created_at).split(',')[1]}
                                                            <span className="block text-[8px] opacity-40 font-black">{formatDateTimeBR(p.created_at).split(',')[0]}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-black text-xs text-white uppercase tracking-tight font-display group-hover:text-fuchsia-400 transition-colors">
                                                            {`${p.name || ''} ${p.lastname || ''}`.trim() || 'Usuário'}
                                                        </div>
                                                        <div className="text-[9px] font-bold text-slate-500 tracking-widest lowercase">{p.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {sellerName ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                                                    <UserCheck className="w-3 h-3 text-cyan-400" />
                                                                </div>
                                                                <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest truncate max-w-[120px]">{sellerName}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Tráfego Orgânico</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest
                                                            ${isPaid 
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                                                : 'bg-white/5 text-slate-500 border border-white/10'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                                                            {isPaid ? 'Upgrade' : 'Cadastro'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            title="Ver Detalhes do Usuário"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUserClick(profileById?.get(String(p.id)) || p);
                                                            }}
                                                            className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-500 group-hover:text-white group-hover:bg-fuchsia-600 transition-all"
                                                        >
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {activityProfiles.length > 0 && (
                            <div className="border-t border-white/5 bg-white/[0.01] px-6 py-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                        Página {safeActivityPage} de {activityTotalPages} • {activityProfiles.length} cadastro(s)
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentActivityPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={safeActivityPage === 1}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => setCurrentActivityPage((prev) => Math.min(prev + 1, activityTotalPages))}
                                            disabled={safeActivityPage === activityTotalPages}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 <div className="admin-glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Trophy className="w-4 h-4 text-amber-400" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white font-display">Líderes de Validação</h3>
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tempo Real</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-white/5">
                                {(cycleBundle?.ranking || []).slice(0, 10).map((u: any, i: number) => (
                                    <tr key={u.id} className="group hover:bg-white/[0.02] cursor-pointer" onClick={() => handleUserClick(profileById.get(String(u.id))!)}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black font-display
                                                ${i === 0 ? 'bg-amber-400 text-amber-950 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 
                                                  i === 1 ? 'bg-slate-300 text-slate-900' :
                                                  i === 2 ? 'bg-orange-400 text-orange-950' : 'bg-white/5 text-slate-500'}`}>
                                                {i + 1}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-black text-white uppercase tracking-tight text-[11px] font-display">{u.name} {u.lastname}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{u.city} • {u.state}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-xl font-black text-amber-400 font-display">{u.validations_count}</div>
                                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Validações</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-white font-display">Atribuição de Vendedores</h3>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-white/5">
                                {(cycleBundle?.affiliates || []).slice(0, 10).map((a: any) => (
                                    <tr key={a.referrer_id} className="group hover:bg-white/[0.02]">
                                        <td className="px-6 py-4">
                                            <div className="font-black text-white uppercase tracking-tight text-[11px] font-display">{a.name}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest lowercase">{a.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-lg font-black text-cyan-400 font-display">{a.referrals}</div>
                                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Indicados</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-lg font-black text-emerald-400 font-display">{formatBRL(toNumber(a.revenue || 0))}</div>
                                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{a.paid} Vendas Pagas</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CycleManagement;
