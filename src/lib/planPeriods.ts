import {
    DAILY_PLAN_IDS,
    MONTHLY_PLAN_IDS,
    PlanId,
    WEEKLY_PLAN_IDS
} from './planRules';

export type CommercialPlanPeriod = 'daily' | 'weekly' | 'monthly';

const DAILY_PLAN_ID_SET = new Set<PlanId>(DAILY_PLAN_IDS);
const WEEKLY_PLAN_ID_SET = new Set<PlanId>(WEEKLY_PLAN_IDS);
const MONTHLY_PLAN_ID_SET = new Set<PlanId>(MONTHLY_PLAN_IDS);

const normalizeDate = (input: Date | string | number) => (
    input instanceof Date ? new Date(input.getTime()) : new Date(input)
);

const addCalendarMonth = (input: Date) => {
    const result = new Date(input.getTime());
    result.setUTCMonth(result.getUTCMonth() + 1);
    return result;
};

export const getCommercialPlanPeriod = (planId: PlanId): CommercialPlanPeriod => {
    if (MONTHLY_PLAN_ID_SET.has(planId)) return 'monthly';
    if (WEEKLY_PLAN_ID_SET.has(planId)) return 'weekly';
    if (DAILY_PLAN_ID_SET.has(planId)) return 'daily';
    return 'daily';
};

export const getPlanDurationLabel = (planId: PlanId) => {
    switch (getCommercialPlanPeriod(planId)) {
        case 'monthly':
            return 'até consumir todas as notícias liberadas no pacote mensal';
        case 'weekly':
            return 'até consumir todas as notícias liberadas no pacote semanal';
        default:
            return 'até consumir todas as notícias liberadas no pacote';
    }
};

export const getPlanExpiryAtByStart = (
    planId: PlanId,
    startedAt: Date | string | number
) => {
    const startDate = normalizeDate(startedAt);

    if (Number.isNaN(startDate.getTime())) {
        return new Date().toISOString();
    }

    switch (getCommercialPlanPeriod(planId)) {
        case 'monthly':
            return addCalendarMonth(startDate).toISOString();
        case 'weekly':
            return new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
        default:
            return new Date(startDate.getTime() + (24 * 60 * 60 * 1000)).toISOString();
    }
};
