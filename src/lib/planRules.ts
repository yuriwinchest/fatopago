export type PlanId =
    | 'starter'
    | 'pro'
    | 'expert'
    | 'starter_weekly'
    | 'pro_weekly'
    | 'expert_weekly'
    | 'starter_monthly'
    | 'pro_monthly'
    | 'expert_monthly';

export type PlanStatus = 'active' | 'completed' | 'cancelled';

export interface PlanPurchaseSummary {
    plan_id: PlanId;
    status: PlanStatus;
    started_at: string;
    completed_at: string | null;
    used_validations: number;
    max_validations: number;
    validation_credit_total?: number;
    validation_credit_remaining?: number;
}

export type PlanAvailability = {
    locked: boolean;
    reason?: string;
};

export type CreditAwarePlan = Partial<Pick<
    PlanPurchaseSummary,
    'plan_id' | 'used_validations' | 'max_validations' | 'validation_credit_total' | 'validation_credit_remaining'
>>;

export const VALIDATION_UNIT_VALUE = 0.75;
export const PLAN_CREDIT_EPSILON = 0.009;

export const DAILY_PLAN_IDS: PlanId[] = ['starter', 'pro', 'expert'];
export const WEEKLY_PLAN_IDS: PlanId[] = ['starter_weekly', 'pro_weekly', 'expert_weekly'];
export const MONTHLY_PLAN_IDS: PlanId[] = ['starter_monthly', 'pro_monthly', 'expert_monthly'];
export const SELLER_EXCLUSIVE_PLAN_IDS: PlanId[] = [...WEEKLY_PLAN_IDS, ...MONTHLY_PLAN_IDS];
export const ALL_PLAN_IDS: PlanId[] = [...DAILY_PLAN_IDS, ...SELLER_EXCLUSIVE_PLAN_IDS];

type TierConfig = {
    tierLabel: string;
    price: number;
    rewardPerNews: number;
    commissionPercent: number;
};

type PlanPeriod = 'Diário' | 'Semanal' | 'Mensal';

const BASE_TIER_CONFIG: Record<'starter' | 'pro' | 'expert', TierConfig> = {
    starter: {
        tierLabel: 'Básico',
        price: 6.00,
        rewardPerNews: 1.00,
        commissionPercent: 20
    },
    pro: {
        tierLabel: 'Médio',
        price: 10.00,
        rewardPerNews: 1.00,
        commissionPercent: 20
    },
    expert: {
        tierLabel: 'Máximo',
        price: 20.00,
        rewardPerNews: 1.00,
        commissionPercent: 20
    }
};

const buildPlanConfig = (
    tier: TierConfig,
    period: PlanPeriod,
    price: number
) => ({
    name: period === 'Diário' ? `Pacote ${tier.tierLabel}` : `Pacote ${period} ${tier.tierLabel}`,
    price,
    maxValidations: Math.trunc(price),
    rewardPerNews: tier.rewardPerNews,
    commissionPercent: tier.commissionPercent
});

export const PLANS_CONFIG: Record<PlanId, {
    name: string;
    price: number;
    maxValidations: number;
    rewardPerNews: number;
    commissionPercent: number;
}> = {
    starter: buildPlanConfig(BASE_TIER_CONFIG.starter, 'Diário', 6.00),
    pro: buildPlanConfig(BASE_TIER_CONFIG.pro, 'Diário', 10.00),
    expert: buildPlanConfig(BASE_TIER_CONFIG.expert, 'Diário', 20.00),
    starter_weekly: buildPlanConfig(BASE_TIER_CONFIG.starter, 'Semanal', 42.00),
    pro_weekly: buildPlanConfig(BASE_TIER_CONFIG.pro, 'Semanal', 70.00),
    expert_weekly: buildPlanConfig(BASE_TIER_CONFIG.expert, 'Semanal', 140.00),
    starter_monthly: buildPlanConfig(BASE_TIER_CONFIG.starter, 'Mensal', 180.00),
    pro_monthly: buildPlanConfig(BASE_TIER_CONFIG.pro, 'Mensal', 300.00),
    expert_monthly: buildPlanConfig(BASE_TIER_CONFIG.expert, 'Mensal', 600.00)
};

export const getCommissionValue = (planId: PlanId): number => {
    const plan = PLANS_CONFIG[planId];
    return plan.price * (plan.commissionPercent / 100);
};

export const PLAN_LIMITS: Record<PlanId, number> = {
    starter: PLANS_CONFIG.starter.maxValidations,
    pro: PLANS_CONFIG.pro.maxValidations,
    expert: PLANS_CONFIG.expert.maxValidations,
    starter_weekly: PLANS_CONFIG.starter_weekly.maxValidations,
    pro_weekly: PLANS_CONFIG.pro_weekly.maxValidations,
    expert_weekly: PLANS_CONFIG.expert_weekly.maxValidations,
    starter_monthly: PLANS_CONFIG.starter_monthly.maxValidations,
    pro_monthly: PLANS_CONFIG.pro_monthly.maxValidations,
    expert_monthly: PLANS_CONFIG.expert_monthly.maxValidations
};

export const CATEGORY_REWARDS: Record<string, number> = {
    'Política': 1.00,
    'Politic': 1.00,
    'Esporte': 0.70,
    'Esportes': 0.70,
    'Sports': 0.70,
    'Entretenimento/Famosos': 0.95,
    'Entretenimento': 0.95,
    'Famosos': 0.95,
    'Entertainment': 0.95,
    'Economia': 0.60,
    'Economy': 0.60,
    'Tecnologia': 0.75,
    'Ciência': 0.80,
    'Saúde': 0.85,
    'Mundo': 0.90,
    'Internacional': 0.90,
    'Brasil': 0.70,
    'Outros': 0.75
};

export const getRewardByCategory = (category: string): number => {
    const normalized = category.charAt(0).toUpperCase() + category.slice(1);
    if (CATEGORY_REWARDS[normalized]) return CATEGORY_REWARDS[normalized];
    if (CATEGORY_REWARDS[category]) return CATEGORY_REWARDS[category];

    if (category.toLowerCase().includes('política') || category.toLowerCase().includes('polític')) return CATEGORY_REWARDS['Política'];
    if (category.toLowerCase().includes('esport')) return CATEGORY_REWARDS['Esporte'];
    if (category.toLowerCase().includes('famos') || category.toLowerCase().includes('entretenimento')) return CATEGORY_REWARDS['Entretenimento'];
    if (category.toLowerCase().includes('econ')) return CATEGORY_REWARDS['Economia'];
    if (category.toLowerCase().includes('tecn')) return CATEGORY_REWARDS['Tecnologia'];
    if (category.toLowerCase().includes('saud')) return CATEGORY_REWARDS['Saúde'];
    if (category.toLowerCase().includes('internac') || category.toLowerCase().includes('mundo')) return CATEGORY_REWARDS['Internacional'];

    return VALIDATION_UNIT_VALUE;
};

export const getPlanCreditTotal = (plan: CreditAwarePlan | null | undefined): number => {
    if (!plan) return 0;

    const direct = Number(plan.validation_credit_total);
    if (Number.isFinite(direct) && direct > 0) {
        return direct;
    }

    const planId = plan.plan_id ? String(plan.plan_id) as PlanId : null;
    if (planId && PLANS_CONFIG[planId]) {
        return PLANS_CONFIG[planId].price;
    }

    return 0;
};

export const getPlanRemainingCredit = (plan: CreditAwarePlan | null | undefined): number => {
    if (!plan) return 0;

    const direct = Number(plan.validation_credit_remaining);
    if (Number.isFinite(direct)) {
        return Math.max(direct, 0);
    }

    const total = getPlanCreditTotal(plan);
    const max = Number(plan.max_validations || 0);
    const used = Number(plan.used_validations || 0);

    if (total <= 0 || max <= 0) {
        return 0;
    }

    return Math.max(total * ((max - used) / max), 0);
};

export const getPlanConsumedCredit = (plan: CreditAwarePlan | null | undefined): number => {
    const total = getPlanCreditTotal(plan);
    const remaining = getPlanRemainingCredit(plan);
    return Math.max(total - remaining, 0);
};

export const isPlanCreditExhausted = (plan: CreditAwarePlan | null | undefined): boolean => {
    if (!plan) return true;

    const remaining = getPlanRemainingCredit(plan);
    if (remaining <= PLAN_CREDIT_EPSILON) {
        return true;
    }

    const directRemaining = Number(plan.validation_credit_remaining);
    if (!Number.isFinite(directRemaining)) {
        const max = Number(plan.max_validations || 0);
        const used = Number(plan.used_validations || 0);
        return max > 0 && used >= max;
    }

    return false;
};

export const getPlanProgressPercentage = (plan: CreditAwarePlan | null | undefined): number => {
    const total = getPlanCreditTotal(plan);
    if (total <= 0) return 0;

    const consumed = getPlanConsumedCredit(plan);
    return Math.min(100, Math.max(0, Math.round((consumed / total) * 100)));
};

export const getEstimatedValidationCapacity = (planId: PlanId): number => {
    return PLANS_CONFIG[planId]?.maxValidations || 0;
};

export const formatNewsCount = (value: number) => {
    const normalized = Math.max(0, Math.trunc(Number(value) || 0));
    return `${normalized} ${normalized === 1 ? 'notícia' : 'notícias'}`;
};

export const formatValidationQuota = (value: number) => formatNewsCount(value);

export const PLAN_LABELS: Record<PlanId, string> = {
    starter: PLANS_CONFIG.starter.name,
    pro: PLANS_CONFIG.pro.name,
    expert: PLANS_CONFIG.expert.name,
    starter_weekly: PLANS_CONFIG.starter_weekly.name,
    pro_weekly: PLANS_CONFIG.pro_weekly.name,
    expert_weekly: PLANS_CONFIG.expert_weekly.name,
    starter_monthly: PLANS_CONFIG.starter_monthly.name,
    pro_monthly: PLANS_CONFIG.pro_monthly.name,
    expert_monthly: PLANS_CONFIG.expert_monthly.name
};

export const isPlanId = (value?: string | null): value is PlanId =>
    Boolean(value && ALL_PLAN_IDS.includes(value as PlanId));

export const parsePlanId = (value?: string | null): PlanId | null => {
    const normalized = String(value || '').trim();
    return isPlanId(normalized) ? (normalized as PlanId) : null;
};

export const isDailyPlanId = (planId?: string | null): planId is PlanId =>
    Boolean(planId && DAILY_PLAN_IDS.includes(planId as PlanId));

export const isWeeklyPlanId = (planId?: string | null): planId is PlanId =>
    Boolean(planId && WEEKLY_PLAN_IDS.includes(planId as PlanId));

export const isMonthlyPlanId = (planId?: string | null): planId is PlanId =>
    Boolean(planId && MONTHLY_PLAN_IDS.includes(planId as PlanId));

export const isSellerExclusivePlanId = (planId?: string | null): planId is PlanId =>
    Boolean(planId && SELLER_EXCLUSIVE_PLAN_IDS.includes(planId as PlanId));

export const getPlanPeriodLabel = (planId?: string | null) => {
    if (isMonthlyPlanId(planId)) return 'mensal';
    if (isWeeklyPlanId(planId)) return 'semanal';
    if (isDailyPlanId(planId)) return 'básico';
    return 'plano';
};

export const getPlanBadgeLabel = (planId?: string | null) => {
    if (isMonthlyPlanId(planId)) return 'Plano mensal';
    if (isWeeklyPlanId(planId)) return 'Plano semanal';
    if (isDailyPlanId(planId)) return 'Pacote básico';
    return 'Plano';
};

export const getPlanAvailability = (
    _planId: PlanId,
    _history: PlanPurchaseSummary[],
    _now: Date = new Date()
): PlanAvailability => {
    return { locked: false };
};
