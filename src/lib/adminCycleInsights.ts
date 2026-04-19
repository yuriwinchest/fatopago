import { toNumber } from '../utils/format';

export type CycleSellerDirectoryRow = {
    id: string;
    name: string | null;
    seller_code?: string | null;
};

export type CyclePixPaymentRow = {
    user_id: string | null;
    seller_id?: string | null;
    plan_id?: string | null;
    amount?: number | string | null;
    status?: string | null;
    created_at: string;
    plan_activated_at?: string | null;
};

export type CycleProfileCreatedRow = {
    id: string;
    created_at: string;
};

export type CycleSellerReferralRow = {
    seller_id: string | null;
    referred_user_id: string | null;
    created_at: string;
};

export type CycleSellerFunnelEventRow = {
    seller_id: string | null;
    event_type: string | null;
    created_at: string;
};

export type CycleSellerCommissionCreditRow = {
    seller_id: string | null;
    amount?: number | string | null;
    created_at: string;
};

export type CycleBundleInsightsInput = {
    start: string;
    end: string;
    profilesCreated: CycleProfileCreatedRow[];
    pixPayments: CyclePixPaymentRow[];
    sellerReferrals: CycleSellerReferralRow[];
    sellerFunnelEvents: CycleSellerFunnelEventRow[];
    sellerCommissionCredits: CycleSellerCommissionCreditRow[];
    sellerDirectory: CycleSellerDirectoryRow[];
};

export type CycleHighlightMetric = {
    label: string;
    count: number;
    sellerId: string | null;
    sellerName: string | null;
};

export type CyclePlanHighlight = {
    planId: string | null;
    planLabel: string;
    salesCount: number;
    sellerId: string | null;
    sellerName: string | null;
};

export type CycleSellerPerformance = {
    sellerId: string | null;
    sellerName: string | null;
    registrationsCount: number;
    paidUsersCount: number;
    unpaidUsersCount: number;
    salesCount: number;
    revenue: number;
    linkClicks: number;
    inviteVisits: number;
    sellerCommissionTotal: number;
};

export type CycleInsightSummary = {
    activeUsersCount: number;
    registrationsCount: number;
    paidUsersCount: number;
    unpaidUsersCount: number;
    revenue: number;
    sellerCommissionTotal: number;
    topLinkSeller: CycleHighlightMetric;
    topSeller: CycleHighlightMetric;
    topPlan: CyclePlanHighlight;
    topSellerDetails: CycleSellerPerformance;
};

export type CycleDayInsight = {
    date: string;
    activeUsersCount: number;
    registrationsCount: number;
    paidUsersCount: number;
    unpaidUsersCount: number;
    revenue: number;
    sellerCommissionTotal: number;
    linkClicks: number;
    inviteVisits: number;
    topLinkSeller: CycleHighlightMetric;
    topSeller: CycleHighlightMetric;
    topPlan: CyclePlanHighlight;
    topSellerDetails: CycleSellerPerformance;
};

export type CycleInsights = {
    summary: CycleInsightSummary;
    byDay: Record<string, CycleDayInsight>;
};

const APPROVED_PAYMENT_STATUSES = new Set(['approved', 'paid', 'completed', 'authorized', 'active']);
const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

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

const emptyHighlightMetric = (label: string): CycleHighlightMetric => ({
    label,
    count: 0,
    sellerId: null,
    sellerName: null
});

const emptyPlanHighlight = (): CyclePlanHighlight => ({
    planId: null,
    planLabel: '—',
    salesCount: 0,
    sellerId: null,
    sellerName: null
});

const emptySellerPerformance = (): CycleSellerPerformance => ({
    sellerId: null,
    sellerName: null,
    registrationsCount: 0,
    paidUsersCount: 0,
    unpaidUsersCount: 0,
    salesCount: 0,
    revenue: 0,
    linkClicks: 0,
    inviteVisits: 0,
    sellerCommissionTotal: 0
});

const toDayKey = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
};

const resolveSellerName = (sellerId: string | null | undefined, sellersById: Map<string, CycleSellerDirectoryRow>) => {
    if (!sellerId) return null;
    const seller = sellersById.get(String(sellerId));
    return seller?.name?.trim() || 'Vendedor';
};

const resolvePlanLabel = (planId?: string | null) => {
    const normalized = String(planId || '').trim();
    if (!normalized) return '—';
    return PLAN_LABELS[normalized] || normalized;
};

const pickTopSellerMetric = (
    source: Map<string, { count: number; revenue: number }>,
    sellersById: Map<string, CycleSellerDirectoryRow>,
    label: string
): CycleHighlightMetric => {
    let bestSellerId: string | null = null;
    let bestCount = 0;
    let bestRevenue = 0;

    source.forEach((value, sellerId) => {
        if (value.count > bestCount || (value.count === bestCount && value.revenue > bestRevenue)) {
            bestSellerId = sellerId;
            bestCount = value.count;
            bestRevenue = value.revenue;
        }
    });

    return {
        label,
        count: bestCount,
        sellerId: bestSellerId,
        sellerName: resolveSellerName(bestSellerId, sellersById)
    };
};

const pickTopPlanHighlight = (
    source: Map<string, { salesCount: number; sellers: Map<string, number> }>,
    sellersById: Map<string, CycleSellerDirectoryRow>
): CyclePlanHighlight => {
    let bestPlanId: string | null = null;
    let bestSalesCount = 0;
    let bestSellerId: string | null = null;
    let bestSellerPlanCount = 0;

    source.forEach((value, planId) => {
        if (value.salesCount > bestSalesCount) {
            bestPlanId = planId;
            bestSalesCount = value.salesCount;
            bestSellerId = null;
            bestSellerPlanCount = 0;

            value.sellers.forEach((planCount, sellerId) => {
                if (planCount > bestSellerPlanCount) {
                    bestSellerPlanCount = planCount;
                    bestSellerId = sellerId;
                }
            });
        }
    });

    return {
        planId: bestPlanId,
        planLabel: resolvePlanLabel(bestPlanId),
        salesCount: bestSalesCount,
        sellerId: bestSellerId,
        sellerName: resolveSellerName(bestSellerId, sellersById)
    };
};

const ensureSellerSet = (
    source: Map<string, Set<string>>,
    sellerId: string,
    userId: string
) => {
    const current = source.get(sellerId) || new Set<string>();
    current.add(userId);
    source.set(sellerId, current);
};

const ensureNestedSellerSet = (
    source: Map<string, Map<string, Set<string>>>,
    day: string,
    sellerId: string,
    userId: string
) => {
    const currentDay = source.get(day) || new Map<string, Set<string>>();
    const currentSeller = currentDay.get(sellerId) || new Set<string>();
    currentSeller.add(userId);
    currentDay.set(sellerId, currentSeller);
    source.set(day, currentDay);
};

const ensureSellerCounter = (
    source: Map<string, { count: number; revenue: number }>,
    sellerId: string,
    revenue = 0
) => {
    const current = source.get(sellerId) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += revenue;
    source.set(sellerId, current);
};

const ensureNestedSellerCounter = (
    source: Map<string, Map<string, { count: number; revenue: number }>>,
    day: string,
    sellerId: string,
    revenue = 0
) => {
    const currentDay = source.get(day) || new Map<string, { count: number; revenue: number }>();
    const currentSeller = currentDay.get(sellerId) || { count: 0, revenue: 0 };
    currentSeller.count += 1;
    currentSeller.revenue += revenue;
    currentDay.set(sellerId, currentSeller);
    source.set(day, currentDay);
};

const buildSellerPerformance = (
    sellerId: string | null,
    sellersById: Map<string, CycleSellerDirectoryRow>,
    registrationsBySeller: Map<string, Set<string>>,
    paidUsersBySeller: Map<string, Set<string>>,
    approvedSalesBySeller: Map<string, { count: number; revenue: number }>,
    linkClicksBySeller: Map<string, { count: number; revenue: number }>,
    inviteVisitsBySeller: Map<string, { count: number; revenue: number }>,
    commissionsBySeller: Map<string, number>
): CycleSellerPerformance => {
    if (!sellerId) return emptySellerPerformance();

    const registrations = registrationsBySeller.get(sellerId)?.size || 0;
    const paidUsers = paidUsersBySeller.get(sellerId)?.size || 0;
    const approvedSales = approvedSalesBySeller.get(sellerId) || { count: 0, revenue: 0 };
    const linkClicks = linkClicksBySeller.get(sellerId)?.count || 0;
    const inviteVisits = inviteVisitsBySeller.get(sellerId)?.count || 0;
    const sellerCommissionTotal = commissionsBySeller.get(sellerId) || 0;

    return {
        sellerId,
        sellerName: resolveSellerName(sellerId, sellersById),
        registrationsCount: registrations,
        paidUsersCount: paidUsers,
        unpaidUsersCount: Math.max(registrations - paidUsers, 0),
        salesCount: approvedSales.count,
        revenue: approvedSales.revenue,
        linkClicks,
        inviteVisits,
        sellerCommissionTotal
    };
};

const buildInsightDay = (date: string): CycleDayInsight => ({
    date,
    activeUsersCount: 0,
    registrationsCount: 0,
    paidUsersCount: 0,
    unpaidUsersCount: 0,
    revenue: 0,
    sellerCommissionTotal: 0,
    linkClicks: 0,
    inviteVisits: 0,
    topLinkSeller: emptyHighlightMetric('Link mais acessado'),
    topSeller: emptyHighlightMetric('Vendedor líder'),
    topPlan: emptyPlanHighlight(),
    topSellerDetails: emptySellerPerformance()
});

export const buildCycleInsights = (input: CycleBundleInsightsInput): CycleInsights => {
    const sellersById = new Map<string, CycleSellerDirectoryRow>(
        (input.sellerDirectory || []).map((seller) => [String(seller.id), seller])
    );

    const byDay: Record<string, CycleDayInsight> = {};
    const activeUsersByDay = new Map<string, Set<string>>();
    const paidUsersByDay = new Map<string, Set<string>>();
    const linkClicksBySeller = new Map<string, { count: number; revenue: number }>();
    const inviteVisitsBySeller = new Map<string, { count: number; revenue: number }>();
    const approvedSalesBySeller = new Map<string, { count: number; revenue: number }>();
    const planSales = new Map<string, { salesCount: number; sellers: Map<string, number> }>();
    const registrationsBySeller = new Map<string, Set<string>>();
    const paidReferralUsersBySeller = new Map<string, Set<string>>();
    const commissionsBySeller = new Map<string, number>();
    const totalActiveUsers = new Set<string>();
    const totalPaidUsers = new Set<string>();
    let totalRevenue = 0;
    let totalCommission = 0;

    const dayRegistrationsBySeller = new Map<string, Map<string, Set<string>>>();
    const dayPaidUsersBySeller = new Map<string, Map<string, Set<string>>>();
    const dayInviteVisitsBySeller = new Map<string, Map<string, { count: number; revenue: number }>>();
    const dayCommissionsBySeller = new Map<string, Map<string, number>>();

    const ensureDay = (day: string) => {
        if (!byDay[day]) {
            byDay[day] = buildInsightDay(day);
        }
        return byDay[day];
    };

    (input.profilesCreated || []).forEach((profile) => {
        const day = toDayKey(profile.created_at);
        if (!day) return;

        const insightDay = ensureDay(day);
        insightDay.registrationsCount += 1;

        const userId = String(profile.id || '');
        if (userId) {
            totalActiveUsers.add(userId);
            const dailyActiveUsers = activeUsersByDay.get(day) || new Set<string>();
            dailyActiveUsers.add(userId);
            activeUsersByDay.set(day, dailyActiveUsers);
        }
    });

    (input.sellerReferrals || []).forEach((referral) => {
        const day = toDayKey(referral.created_at);
        const sellerId = referral.seller_id ? String(referral.seller_id) : null;
        const userId = referral.referred_user_id ? String(referral.referred_user_id) : null;
        if (!day || !sellerId || !userId) return;

        ensureDay(day);
        ensureSellerSet(registrationsBySeller, sellerId, userId);
        ensureNestedSellerSet(dayRegistrationsBySeller, day, sellerId, userId);
    });

    (input.pixPayments || []).forEach((payment) => {
        const day = toDayKey(payment.created_at);
        if (!day) return;

        const userId = String(payment.user_id || '');
        if (userId) {
            totalActiveUsers.add(userId);
            const dailyActiveUsers = activeUsersByDay.get(day) || new Set<string>();
            dailyActiveUsers.add(userId);
            activeUsersByDay.set(day, dailyActiveUsers);
        }

        const status = String(payment.status || '').toLowerCase();
        const approved = APPROVED_PAYMENT_STATUSES.has(status) || Boolean(payment.plan_activated_at);
        if (!approved) return;

        const insightDay = ensureDay(day);
        const amount = toNumber(payment.amount);
        insightDay.revenue += amount;
        totalRevenue += amount;

        if (userId) {
            totalPaidUsers.add(userId);
            const dailyPaidUsers = paidUsersByDay.get(day) || new Set<string>();
            dailyPaidUsers.add(userId);
            paidUsersByDay.set(day, dailyPaidUsers);
        }

        const sellerId = payment.seller_id ? String(payment.seller_id) : null;
        if (sellerId) {
            ensureSellerCounter(approvedSalesBySeller, sellerId, amount);
            if (userId) {
                ensureSellerSet(paidReferralUsersBySeller, sellerId, userId);
                ensureNestedSellerSet(dayPaidUsersBySeller, day, sellerId, userId);
            }
        }

        const planId = String(payment.plan_id || '').trim();
        if (planId) {
            const currentPlan = planSales.get(planId) || { salesCount: 0, sellers: new Map<string, number>() };
            currentPlan.salesCount += 1;
            if (sellerId) {
                currentPlan.sellers.set(sellerId, (currentPlan.sellers.get(sellerId) || 0) + 1);
            }
            planSales.set(planId, currentPlan);
        }
    });

    const daySalesBySeller = new Map<string, Map<string, { count: number; revenue: number }>>();
    const dayPlanSales = new Map<string, Map<string, { salesCount: number; sellers: Map<string, number> }>>();

    (input.pixPayments || []).forEach((payment) => {
        const day = toDayKey(payment.created_at);
        if (!day) return;
        const status = String(payment.status || '').toLowerCase();
        const approved = APPROVED_PAYMENT_STATUSES.has(status) || Boolean(payment.plan_activated_at);
        if (!approved) return;

        const sellerId = payment.seller_id ? String(payment.seller_id) : null;
        const amount = toNumber(payment.amount);
        if (sellerId) {
            const daySellerMap = daySalesBySeller.get(day) || new Map<string, { count: number; revenue: number }>();
            const sellerState = daySellerMap.get(sellerId) || { count: 0, revenue: 0 };
            sellerState.count += 1;
            sellerState.revenue += amount;
            daySellerMap.set(sellerId, sellerState);
            daySalesBySeller.set(day, daySellerMap);
        }

        const planId = String(payment.plan_id || '').trim();
        if (planId) {
            const dayPlanMap = dayPlanSales.get(day) || new Map<string, { salesCount: number; sellers: Map<string, number> }>();
            const planState = dayPlanMap.get(planId) || { salesCount: 0, sellers: new Map<string, number>() };
            planState.salesCount += 1;
            if (sellerId) {
                planState.sellers.set(sellerId, (planState.sellers.get(sellerId) || 0) + 1);
            }
            dayPlanMap.set(planId, planState);
            dayPlanSales.set(day, dayPlanMap);
        }
    });

    (input.sellerCommissionCredits || []).forEach((credit) => {
        const day = toDayKey(credit.created_at);
        if (!day) return;
        const insightDay = ensureDay(day);
        const amount = toNumber(credit.amount);
        insightDay.sellerCommissionTotal += amount;
        totalCommission += amount;
        const sellerId = credit.seller_id ? String(credit.seller_id) : null;
        if (sellerId) {
            commissionsBySeller.set(sellerId, (commissionsBySeller.get(sellerId) || 0) + amount);
            const currentDay = dayCommissionsBySeller.get(day) || new Map<string, number>();
            currentDay.set(sellerId, (currentDay.get(sellerId) || 0) + amount);
            dayCommissionsBySeller.set(day, currentDay);
        }
    });

    const dayLinkClicksBySeller = new Map<string, Map<string, { count: number; revenue: number }>>();

    (input.sellerFunnelEvents || []).forEach((event) => {
        const day = toDayKey(event.created_at);
        if (!day) return;
        const sellerId = event.seller_id ? String(event.seller_id) : null;
        if (!sellerId) return;

        const insightDay = ensureDay(day);
        const eventType = String(event.event_type || '').toLowerCase();

        if (eventType === 'link_click') {
            insightDay.linkClicks += 1;
            ensureNestedSellerCounter(dayLinkClicksBySeller, day, sellerId);
            ensureSellerCounter(linkClicksBySeller, sellerId);
        }

        if (eventType === 'invite_visit') {
            insightDay.inviteVisits += 1;
            ensureNestedSellerCounter(dayInviteVisitsBySeller, day, sellerId);
            ensureSellerCounter(inviteVisitsBySeller, sellerId);
        }
    });

    Object.entries(byDay).forEach(([day, insight]) => {
        insight.activeUsersCount = (activeUsersByDay.get(day) || new Set<string>()).size;
        insight.paidUsersCount = (paidUsersByDay.get(day) || new Set<string>()).size;
        insight.unpaidUsersCount = Math.max(insight.registrationsCount - insight.paidUsersCount, 0);
        insight.topLinkSeller = pickTopSellerMetric(dayLinkClicksBySeller.get(day) || new Map(), sellersById, 'Link mais acessado');
        insight.topSeller = pickTopSellerMetric(daySalesBySeller.get(day) || new Map(), sellersById, 'Vendedor líder');
        insight.topPlan = pickTopPlanHighlight(dayPlanSales.get(day) || new Map(), sellersById);
        insight.topSellerDetails = buildSellerPerformance(
            insight.topSeller.sellerId,
            sellersById,
            dayRegistrationsBySeller.get(day) || new Map(),
            dayPaidUsersBySeller.get(day) || new Map(),
            daySalesBySeller.get(day) || new Map(),
            dayLinkClicksBySeller.get(day) || new Map(),
            dayInviteVisitsBySeller.get(day) || new Map(),
            dayCommissionsBySeller.get(day) || new Map()
        );
    });

    const topSeller = pickTopSellerMetric(approvedSalesBySeller, sellersById, 'Vendedor líder');
    const summary: CycleInsightSummary = {
        activeUsersCount: totalActiveUsers.size,
        registrationsCount: input.profilesCreated?.length || 0,
        paidUsersCount: totalPaidUsers.size,
        unpaidUsersCount: Math.max((input.profilesCreated?.length || 0) - totalPaidUsers.size, 0),
        revenue: totalRevenue,
        sellerCommissionTotal: totalCommission,
        topLinkSeller: pickTopSellerMetric(linkClicksBySeller, sellersById, 'Link mais acessado'),
        topSeller,
        topPlan: pickTopPlanHighlight(planSales, sellersById),
        topSellerDetails: buildSellerPerformance(
            topSeller.sellerId,
            sellersById,
            registrationsBySeller,
            paidReferralUsersBySeller,
            approvedSalesBySeller,
            linkClicksBySeller,
            inviteVisitsBySeller,
            commissionsBySeller
        )
    };

    return { summary, byDay };
};
