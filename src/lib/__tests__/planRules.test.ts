import {
    DAILY_PLAN_IDS,
    MONTHLY_PLAN_IDS,
    PLANS_CONFIG,
    WEEKLY_PLAN_IDS,
    formatNewsCount,
    getEstimatedValidationCapacity,
    getPlanProgressPercentage,
    getPlanRemainingCredit,
    isPlanCreditExhausted,
    parsePlanId
} from '../planRules';

describe('planRules', () => {
    it('parsePlanId reconhece ids validos do catalogo diario, semanal e mensal', () => {
        expect(parsePlanId('starter')).toBe('starter');
        expect(parsePlanId('pro')).toBe('pro');
        expect(parsePlanId('expert')).toBe('expert');
        expect(parsePlanId('starter_weekly')).toBe('starter_weekly');
        expect(parsePlanId('pro_weekly')).toBe('pro_weekly');
        expect(parsePlanId('expert_weekly')).toBe('expert_weekly');
        expect(parsePlanId('starter_monthly')).toBe('starter_monthly');
        expect(parsePlanId('pro_monthly')).toBe('pro_monthly');
        expect(parsePlanId('expert_monthly')).toBe('expert_monthly');
        expect(parsePlanId('invalido')).toBeNull();
        expect(parsePlanId(null)).toBeNull();
    });

    it('mantem os pacotes diarios abertos e os fechados do vendedor com a nova tabela comercial', () => {
        expect(DAILY_PLAN_IDS).toEqual(['starter', 'pro', 'expert']);
        expect(WEEKLY_PLAN_IDS).toEqual(['starter_weekly', 'pro_weekly', 'expert_weekly']);
        expect(MONTHLY_PLAN_IDS).toEqual(['starter_monthly', 'pro_monthly', 'expert_monthly']);

        expect(PLANS_CONFIG.starter.price).toBe(6);
        expect(PLANS_CONFIG.pro.price).toBe(10);
        expect(PLANS_CONFIG.expert.price).toBe(20);

        expect(PLANS_CONFIG.starter_weekly.price).toBe(42);
        expect(PLANS_CONFIG.pro_weekly.price).toBe(70);
        expect(PLANS_CONFIG.expert_weekly.price).toBe(140);

        expect(PLANS_CONFIG.starter_monthly.price).toBe(180);
        expect(PLANS_CONFIG.pro_monthly.price).toBe(300);
        expect(PLANS_CONFIG.expert_monthly.price).toBe(600);

        expect(PLANS_CONFIG.starter.maxValidations).toBe(6);
        expect(PLANS_CONFIG.pro.maxValidations).toBe(10);
        expect(PLANS_CONFIG.expert.maxValidations).toBe(20);
        expect(PLANS_CONFIG.starter_weekly.maxValidations).toBe(42);
        expect(PLANS_CONFIG.pro_weekly.maxValidations).toBe(70);
        expect(PLANS_CONFIG.expert_weekly.maxValidations).toBe(140);
        expect(PLANS_CONFIG.starter_monthly.maxValidations).toBe(180);
        expect(PLANS_CONFIG.pro_monthly.maxValidations).toBe(300);
        expect(PLANS_CONFIG.expert_monthly.maxValidations).toBe(600);
    });

    it('considera exaustao do pacote pelo saldo restante', () => {
        const plan = {
            plan_id: 'starter_monthly',
            used_validations: 40,
            max_validations: 300,
            validation_credit_total: 180,
            validation_credit_remaining: 0
        } as const;

        expect(getPlanRemainingCredit(plan)).toBe(0);
        expect(isPlanCreditExhausted(plan)).toBe(true);
        expect(getPlanProgressPercentage(plan)).toBe(100);
    });

    it('mantem compatibilidade com planos antigos sem saldo salvo', () => {
        const legacyPlan = {
            plan_id: 'starter',
            used_validations: 10,
            max_validations: 10
        } as const;

        expect(getPlanRemainingCredit(legacyPlan)).toBe(0);
        expect(isPlanCreditExhausted(legacyPlan)).toBe(true);
    });

    it('usa a quantidade total de noticias como capacidade estimada do pacote', () => {
        expect(getEstimatedValidationCapacity('starter')).toBe(6);
        expect(getEstimatedValidationCapacity('pro_weekly')).toBe(70);
        expect(getEstimatedValidationCapacity('expert_monthly')).toBe(600);
    });

    it('formata quantidade de noticias no singular e plural', () => {
        expect(formatNewsCount(1)).toBe('1 notícia');
        expect(formatNewsCount(6)).toBe('6 notícias');
    });
});
