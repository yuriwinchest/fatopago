export type PlanId = 'starter' | 'pro' | 'expert';

export type PlanStatus = 'active' | 'completed' | 'cancelled';

export interface PlanPurchaseSummary {
    plan_id: PlanId;
    status: PlanStatus;
    started_at: string;
    completed_at: string | null;
    used_validations: number;
    max_validations: number;
}

export type PlanAvailability = {
    locked: boolean;
    reason?: string;
};

// --- CONFIGURAÇÃO CENTRALIZADA DOS PLANOS ---
export const PLANS_CONFIG: Record<PlanId, {
    name: string;
    price: number;
    maxValidations: number;
    rewardPerNews: number;
    commissionPercent: number;
}> = {
    starter: {
        name: 'Pacote Básico',
        price: 5.00,
        maxValidations: 10,
        rewardPerNews: 5.00, // Resulta em R$ 50,00
        commissionPercent: 20
    },
    pro: {
        name: 'Pacote Médio',
        price: 10.00,
        maxValidations: 20,
        rewardPerNews: 5.00, // Resulta em R$ 100,00
        commissionPercent: 20
    },
    expert: {
        name: 'Pacote Máximo',
        price: 20.00,
        maxValidations: 40,
        rewardPerNews: 5.00, // Resulta em R$ 200,00
        commissionPercent: 20
    }
};

export const PLAN_SEQUENCE: PlanId[] = ['starter', 'pro', 'expert'];

export const PLAN_LIMITS: Record<PlanId, number> = {
    starter: PLANS_CONFIG.starter.maxValidations,
    pro: PLANS_CONFIG.pro.maxValidations,
    expert: PLANS_CONFIG.expert.maxValidations
};

export const VALIDATION_UNIT_VALUE = 5.0; // Valor global por notícia

export const PLAN_LABELS: Record<PlanId, string> = {
    starter: PLANS_CONFIG.starter.name,
    pro: PLANS_CONFIG.pro.name,
    expert: PLANS_CONFIG.expert.name
};
// --- FIM DA CONFIGURAÇÃO ---

const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getHoursDiff = (fromIso: string, to: Date) => {
    const from = new Date(fromIso);
    return (to.getTime() - from.getTime()) / (1000 * 60 * 60);
};

const sortByCompletedDesc = (history: PlanPurchaseSummary[]) =>
    [...history].sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
    });

const hasCompletedAllPlansSameDay = (history: PlanPurchaseSummary[], now: Date) => {
    const todayKey = getLocalDateKey(now);
    const completedToday = new Set(
        history
            .filter((p) => p.status === 'completed' && p.completed_at)
            .filter((p) => getLocalDateKey(new Date(p.completed_at as string)) === todayKey)
            .map((p) => p.plan_id)
    );
    return PLAN_SEQUENCE.every((planId) => completedToday.has(planId));
};

export const getPlanAvailability = (
    planId: PlanId,
    history: PlanPurchaseSummary[],
    now: Date = new Date()
): PlanAvailability => {
    const completed = history.filter((p) => p.status === 'completed' && p.completed_at);
    if (completed.length === 0) {
        if (planId === 'starter') return { locked: false };
        return { locked: true, reason: 'Comece pelo Iniciante' };
    }

    if (hasCompletedAllPlansSameDay(completed, now)) {
        if (planId === 'expert') {
            return { locked: true, reason: 'Ciclo diário completo' };
        }
        return { locked: false };
    }

    const lastCompleted = sortByCompletedDesc(completed)[0];
    if (!lastCompleted) {
        return { locked: false };
    }

    if (lastCompleted.plan_id === 'starter') {
        if (planId === 'starter') {
            const hoursDiff = getHoursDiff(lastCompleted.completed_at as string, now);
            if (hoursDiff < 24) {
                return { locked: true, reason: 'Aguarde 24h para reativar o Iniciante' };
            }
            return { locked: false };
        }
        if (planId === 'pro') return { locked: false };
        return { locked: true, reason: 'Complete o Pro antes do Especialista' };
    }

    if (lastCompleted.plan_id === 'pro') {
        if (planId === 'expert') return { locked: false };
        if (planId === 'pro') return { locked: true, reason: 'Plano já utilizado' };
        return { locked: true, reason: 'Complete o Especialista antes de reiniciar' };
    }

    if (lastCompleted.plan_id === 'expert') {
        if (planId === 'starter') return { locked: false };
        return { locked: true, reason: 'Reinicie no Iniciante' };
    }

    return { locked: false };
};
