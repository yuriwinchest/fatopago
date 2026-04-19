import { useCallback } from 'react';
import { Users, Trophy, Wallet, Copy, Loader2, CreditCard, Shield, Share2, Newspaper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { useDashboard } from '../hooks/useDashboard';
import {
    formatNewsCount,
    PLAN_LABELS,
    PLANS_CONFIG,
    getPlanConsumedCredit,
    getPlanPeriodLabel,
    getPlanProgressPercentage,
    getPlanRemainingCredit,
    isMonthlyPlanId
} from '../lib/planRules';
import { Card } from '../components/ui/Card';
import { useReferral } from '../hooks/useReferral';
import { WEEKLY_WINNER_PRIZE_BRL } from '../lib/cycleSchedule';

const Dashboard = () => {
    const navigate = useNavigate();
    const { profile, loading, activePlan, cyclePlans, totalNewsCount } = useDashboard();
    const { stats: referralStats } = useReferral();

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const referralLink = `https://fatopago.com/convite/${profile?.referral_code || ''}`;

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        alert("Link copiado!");
    }, []);

    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'FatoPago - Indique e Ganhe',
                    text: 'Valide notícias e ganhe dinheiro. Use meu link de convite:',
                    url: referralLink,
                });
            } catch {
                // User cancelled share or not supported
                copyToClipboard(referralLink);
            }
        } else {
            copyToClipboard(referralLink);
        }
    }, [referralLink, copyToClipboard]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    const reputationScore = profile?.reputation_score || 0;
    const compensatoryCreditBalance = profile?.compensatory_credit_balance || 0;
    const remainingPlanCredit = activePlan ? getPlanRemainingCredit(activePlan) : 0;
    const consumedPlanCredit = activePlan ? getPlanConsumedCredit(activePlan) : 0;
    const planProgressPct = activePlan ? getPlanProgressPercentage(activePlan) : 0;

    const cycleWinnerPrize = WEEKLY_WINNER_PRIZE_BRL;

    // O usuário pode comprar vários pacotes no mesmo ciclo (sequencialmente).
    // Mostramos quantos pacotes existem no ciclo e qual pacote está sendo consumido agora (ex: 2/3).
    const cyclePlanItems = (cyclePlans && cyclePlans.length > 0)
        ? cyclePlans
        : (activePlan ? [activePlan as any] : []);
    const cyclePlanCount = cyclePlanItems.length;
    const cycleTotalNewsQuota = cyclePlanItems.reduce((sum, p: any) => {
        const direct = Number(p?.validation_credit_total);
        if (Number.isFinite(direct) && direct > 0) return sum + direct;
        const planId = p?.plan_id as keyof typeof PLANS_CONFIG;
        return sum + (PLANS_CONFIG[planId]?.maxValidations || 0);
    }, 0);
    const cycleRemainingNewsQuota = cyclePlanItems.reduce((sum, p: any) => {
        const direct = Number(p?.validation_credit_remaining);
        if (Number.isFinite(direct) && direct >= 0) return sum + direct;

        const max = Number(p?.max_validations) || 0;
        const used = Number(p?.used_validations) || 0;
        const planId = p?.plan_id as keyof typeof PLANS_CONFIG;
        const total = PLANS_CONFIG[planId]?.maxValidations || 0;
        if (max <= 0) return sum;
        return sum + Math.max(total * ((max - used) / max), 0);
    }, 0);
    const cycleConsumedNewsQuota = Math.max(cycleTotalNewsQuota - cycleRemainingNewsQuota, 0);
    const cycleConsumePct = cycleTotalNewsQuota > 0
        ? Math.min(100, Math.round((cycleConsumedNewsQuota / cycleTotalNewsQuota) * 100))
        : 0;
    const activeCycleIndex = activePlan ? cyclePlanItems.findIndex((p: any) => p?.id === activePlan.id) : -1;
    const activeCyclePos = activeCycleIndex >= 0 ? `${activeCycleIndex + 1}/${Math.max(cyclePlanCount, 1)}` : null;
    const activePlanLabel = activePlan ? (PLAN_LABELS[activePlan.plan_id] || 'Pacote') : 'Sem pacote';
    const activePlanRuleLabel = activePlan
        ? 'Seu pacote permanece disponível até consumir todas as notícias liberadas.'
        : null;

    return (
        <AppLayout
            title="Meu Painel"
            subtitle="Resumo do seu ciclo e do seu pacote"
            showLogout={true}
        >
            <div className="space-y-8">
                <div className="space-y-8">
                    {/* Balance Card */}
                    <div
                        className="group relative cursor-pointer overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] p-8 shadow-2xl transition-all hover:scale-[1.01]"
                        onClick={() => navigate('/financeiro')}
                        >
                        <div className="relative z-10">
                            <div className="mb-6 flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Saldo Disponível</p>
                                    <h2 className="text-4xl font-black text-white">{formatCurrency(profile?.current_balance || 0)}</h2>
                                </div>
                                <button className="rounded-2xl bg-white px-5 py-2.5 text-[10px] font-black uppercase text-purple-900 shadow-lg">
                                    Sacar <Wallet className="ml-2 inline h-3 w-3" />
                                </button>
                            </div>

                            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                                {/* Linha 1: Resumo rápido (para o usuário entender em 2s) */}
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:text-left">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-purple-100/90">Comissões</p>
                                        <p className="mt-1 text-lg font-black text-emerald-200">{formatCurrency(referralStats?.totalCommissions || 0)}</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-slate-200/70">
                                            {referralStats?.referralCount || 0} indicados
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:text-left">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-purple-100/90">A Receber</p>
                                        <p className="mt-1 text-lg font-black text-amber-200">{formatCurrency(referralStats?.pendingCommissions || 0)}</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-slate-200/70">Comissões pendentes</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:text-left">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-purple-100/90">Prêmio (1º)</p>
                                        <p className="mt-1 text-lg font-black text-pink-100">{formatCurrency(cycleWinnerPrize)}</p>
                                            <p className="mt-0.5 text-[10px] font-bold text-slate-200/70">Prêmio semanal do 1º lugar</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center sm:text-left">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-purple-100/90">Notícias do ciclo</p>
                                        <p className="mt-1 text-lg font-black text-white">{cyclePlanCount > 0 ? formatNewsCount(cycleRemainingNewsQuota) : '—'}</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-slate-200/70">
                                            {cyclePlanCount > 0 ? `${cyclePlanCount} pacote${cyclePlanCount === 1 ? '' : 's'} no ciclo` : 'Sem pacote no ciclo'}
                                        </p>
                                        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-200/70">
                                            {activePlan ? `Consumindo: ${activePlanLabel}${activeCyclePos ? ` (${activeCyclePos})` : ''}` : 'Sem pacote ativo'}
                                        </p>
                                        {cyclePlanCount > 0 && (
                                            <p className="mt-0.5 truncate text-[10px] font-bold text-slate-300/80">
                                                Consumido: {formatNewsCount(cycleConsumedNewsQuota)} / {formatNewsCount(cycleTotalNewsQuota)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px w-full bg-white/10" />

                                {/* Detalhes */}
                                <div className="space-y-3">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                                        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-300 via-emerald-200 to-cyan-200 transition-all" style={{ width: `${cycleConsumePct}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-[80px]" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card
                            tone="default"
                            className="flex cursor-pointer flex-col gap-3 border-white/5 bg-[#1A1040] p-5 transition-colors hover:border-purple-500/30"
                            onClick={() => navigate('/ranking')}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10">
                                <Trophy className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{reputationScore}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Ranking XP</p>
                            </div>
                        </Card>

                        <Card
                            tone="default"
                            className="flex cursor-pointer flex-col gap-3 border-white/5 bg-[#1A1040] p-5 transition-colors hover:border-cyan-500/30"
                            onClick={() => navigate('/validation')}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10">
                                <Newspaper className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{totalNewsCount.toLocaleString('pt-BR')}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Notícias na plataforma</p>
                            </div>
                        </Card>

                        <Card tone="default" className="flex flex-col gap-4 border-white/5 bg-gradient-to-r from-[#1A1040] to-transparent p-5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                                    <Users className="h-6 w-6 text-purple-300" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white">Indique e Ganhe</p>
                                    <p className="text-[10px] text-slate-400">20% de comissão por indicação</p>
                                </div>
                                <button onClick={handleShare} className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-[10px] font-bold transition-colors hover:bg-purple-500">
                                    <Share2 className="h-3 w-3" /> CONVIDAR
                                </button>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-black/20 p-2 pl-4">
                                <span className="mr-2 truncate font-mono text-[10px] text-slate-500">fatopago.com/convite/{profile?.referral_code || '...'}</span>
                                <button onClick={() => copyToClipboard(referralLink)} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-[9px] font-black uppercase transition-colors hover:bg-white/10">
                                    COPIAR <Copy className="h-3 w-3" />
                                </button>
                            </div>
                        </Card>
                    </div>

                    {/* Plan Card */}
                    <Card tone="soft" className="space-y-4 p-5 md:p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-purple-400" />
                                <h3 className="text-lg font-bold">Seu Pacote do Ciclo</h3>
                            </div>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${activePlan ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                                {activePlan ? 'ATIVO' : 'SEM PACOTE'}
                            </span>
                        </div>

                        {activePlan ? (
                            <>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Plano</p>
                                        <p className="mt-1 text-xl font-black text-white">
                                            {PLAN_LABELS[activePlan.plan_id] || 'Pacote'}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {formatNewsCount(PLANS_CONFIG[activePlan.plan_id]?.maxValidations || 0)} / {getPlanPeriodLabel(activePlan.plan_id)}
                                        </p>
                                        <p className="mt-2 text-[11px] font-bold text-cyan-200/80">
                                            Regra de uso: até consumir todas as notícias liberadas
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notícias disponíveis</p>
                                        <div className="mt-1 flex items-end justify-between gap-4">
                                            <p className="text-3xl font-black text-white">{formatNewsCount(remainingPlanCredit)}</p>
                                            <p className="text-xs font-bold text-slate-400">
                                                {formatNewsCount(activePlan.used_validations)} validadas
                                            </p>
                                        </div>
                                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all"
                                                style={{ width: `${planProgressPct}%` }}
                                            />
                                        </div>
                                        <p className="mt-2 text-[11px] font-bold text-slate-500">
                                            Consumido: {formatNewsCount(consumedPlanCredit)} de {formatNewsCount(getPlanRemainingCredit(activePlan) + consumedPlanCredit)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                                            <Shield className="h-5 w-5 text-amber-300" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">IMPORTANTE</p>
                                            <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-100">
                                                {activePlanRuleLabel}
                                            </p>
                                            <p className="mt-2 text-[11px] leading-relaxed text-amber-50/85">
                                                {isMonthlyPlanId(activePlan.plan_id)
                                                    ? 'Se as notícias do pacote acabarem antes do vencimento, você pode comprar outro mensal, trocar para um semanal ou recomprar um básico imediatamente.'
                                                    : 'Quando as notícias do pacote acabarem, você pode comprar outro pacote do catálogo liberado para o seu perfil sem esperar o vencimento atual.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {compensatoryCreditBalance > 0 && (
                                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15">
                                                <Shield className="h-5 w-5 text-cyan-300" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">CRÉDITO COMPENSATÓRIO</p>
                                                <p className="mt-1 text-base font-black text-white">
                                                    {formatNewsCount(compensatoryCreditBalance)}
                                                </p>
                                                <p className="mt-2 text-[11px] leading-relaxed text-cyan-50/85">
                                                    Esse crédito vem de anulações administrativas. Ele é consumido antes do pacote pago e não depende de um plano ativo para ser usado.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <button
                                        onClick={() => navigate('/plans')}
                                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white/10 active:scale-[0.99]"
                                    >
                                        Gerenciar Plano
                                    </button>
                                    <button
                                        onClick={() => navigate('/validation')}
                                        className="rounded-2xl bg-purple-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-purple-600/25 transition-colors hover:bg-purple-500 active:scale-[0.99]"
                                    >
                                        Ir Para Validação
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <p className="text-sm font-bold text-white">Você ainda não tem um pacote ativo neste ciclo.</p>
                                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                                        Para validar notícias e aparecer no ranking, escolha um pacote com a quantidade de notícias que deseja usar.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
                                            <Shield className="h-5 w-5 text-amber-300" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">IMPORTANTE</p>
                                            <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-100">
                                                Cada pacote libera uma quantidade fixa de notícias e permanece disponível até consumir todas as unidades liberadas.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {compensatoryCreditBalance > 0 && (
                                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15">
                                                <Shield className="h-5 w-5 text-cyan-300" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">CRÉDITO COMPENSATÓRIO DISPONÍVEL</p>
                                                <p className="mt-1 text-base font-black text-white">{formatNewsCount(compensatoryCreditBalance)}</p>
                                                <p className="mt-2 text-[11px] leading-relaxed text-cyan-50/85">
                                                    Mesmo sem pacote ativo, esse crédito pode ser usado primeiro nas próximas validações até acabar.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => navigate('/plans')}
                                    className="w-full rounded-2xl bg-purple-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-purple-600/25 transition-colors hover:bg-purple-500 active:scale-[0.99]"
                                >
                                    Escolher Plano
                                </button>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
};

export default Dashboard;
