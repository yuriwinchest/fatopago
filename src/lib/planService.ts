import { supabase } from './supabase';
import {
    PlanId,
    PLAN_CREDIT_EPSILON,
    PlanStatus,
    PLAN_LIMITS,
    PlanPurchaseSummary,
    PLANS_CONFIG,
    getPlanRemainingCredit,
    isPlanCreditExhausted
} from './planRules';
import {
    WEEKLY_CYCLE_BREAK_MS,
    getWeeklyCycleSnapshot
} from './cycleSchedule';
import { SellerCampaignSource } from './sellerCampaign';

export interface PlanPurchase extends PlanPurchaseSummary {
    id: string;
    user_id: string;
    created_at: string;
    updated_at?: string | null;
    last_validation_at?: string | null;
    validation_credit_total?: number;
    validation_credit_remaining?: number;
}

export type PlanAccessResult =
    | { status: 'ok'; userId: string; plan: PlanPurchase | null; creditSource: 'plan' | 'compensatory' }
    | { status: 'no-session' }
    | { status: 'no-plan' }
    | { status: 'exhausted' }
    | { status: 'cycle-break'; message: string }
    | { status: 'no-cycle'; message: string }
    | { status: 'error'; message: string };

interface CycleState {
    state: 'active' | 'break' | 'waiting-next' | 'no-cycle';
    canValidate: boolean;
    cycleStart?: number;
    cycleEnd?: number;
    nextCycleStart?: number;
}

export const getCurrentCycleState = async (): Promise<CycleState> => {
    const now = new Date().getTime();
    const fallback = getWeeklyCycleSnapshot(now);

    try {
        const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 });
        if (error) throw error;

        const row = (Array.isArray(data) ? data[0] : data) as
            | { cycle_start_at?: string | null; cycle_end_at?: string | null; is_active?: boolean | null }
            | null;

        const cycleStart = new Date(row?.cycle_start_at || fallback.cycleStartAt).getTime();
        const cycleEnd = new Date(row?.cycle_end_at || fallback.cycleEndAt).getTime();
        const nextCycleStart = cycleEnd + WEEKLY_CYCLE_BREAK_MS;

        if (now >= cycleStart && now < cycleEnd) {
            return { state: 'active', canValidate: true, cycleStart, cycleEnd };
        }

        if (now >= cycleEnd && now < nextCycleStart) {
            return { state: 'break', canValidate: false, cycleStart, cycleEnd, nextCycleStart };
        }

        return { state: 'waiting-next', canValidate: false, nextCycleStart };
    } catch (error) {
        console.warn('Falling back to local weekly cycle schedule:', error);

        const cycleStart = new Date(fallback.cycleStartAt).getTime();
        const cycleEnd = new Date(fallback.cycleEndAt).getTime();
        const nextCycleStart = new Date(fallback.nextCycleStartAt).getTime();

        if (fallback.isBreak) {
            return { state: 'break', canValidate: false, cycleStart, cycleEnd, nextCycleStart };
        }

        if (now >= cycleStart && now < cycleEnd) {
            return { state: 'active', canValidate: true, cycleStart, cycleEnd };
        }

        return { state: 'waiting-next', canValidate: false, nextCycleStart };
    }
};

export const getCurrentUserId = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session?.user?.id || null;
};

export const fetchActivePlan = async (userId: string) => {
    const { data, error } = await supabase
        .from('plan_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw error;
    return (data as PlanPurchase | null) || null;
};

export const fetchPlanHistory = async (userId: string, limit = 30) => {
    const { data, error } = await supabase
        .from('plan_purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data as PlanPurchase[]) || [];
};

export const createPlanPurchase = async (userId: string, planId: PlanId) => {
    const payload = {
        user_id: userId,
        plan_id: planId,
        status: 'active' as PlanStatus,
        max_validations: PLAN_LIMITS[planId],
        used_validations: 0,
        validation_credit_total: PLANS_CONFIG[planId].maxValidations,
        validation_credit_remaining: PLANS_CONFIG[planId].maxValidations,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('plan_purchases')
        .insert(payload)
        .select('*')
        .single();

    if (error) throw error;
    return data as PlanPurchase;
};

export const markPlanCompleted = async (plan: PlanPurchase) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('plan_purchases')
        .update({
            status: 'completed',
            completed_at: now,
            updated_at: now
        })
        .eq('id', plan.id)
        .eq('user_id', plan.user_id)
        .select('*')
        .single();

    if (error) throw error;
    return data as PlanPurchase;
};

export const isPlanExhausted = (plan: PlanPurchase | null | undefined) => (
    isPlanCreditExhausted(plan)
);

export const shouldAutoCompletePlan = (
    plan: PlanPurchase | null | undefined
) => {
    if (!plan) return false;
    return isPlanExhausted(plan);
};

export const consumeActivePlanValidation = async (plan: PlanPurchase, validationCost = 0) => {
    const nextUsed = Number(plan.used_validations || 0) + 1;
    const now = new Date().toISOString();
    const nextRemaining = Math.max(getPlanRemainingCredit(plan) - Math.max(Number(validationCost || 0), 0), 0);
    const isComplete = nextRemaining <= 0.009;

    const updatePayload: Record<string, any> = {
        used_validations: nextUsed,
        validation_credit_remaining: nextRemaining,
        last_validation_at: now,
        updated_at: now
    };

    if (isComplete) {
        updatePayload.status = 'completed';
        updatePayload.completed_at = now;
    }

    const { data, error } = await supabase
        .from('plan_purchases')
        .update(updatePayload)
        .eq('id', plan.id)
        .eq('user_id', plan.user_id)
        .select('*')
        .single();

    if (error) throw error;
    return data as PlanPurchase;
};

export const getPlanAccessForCurrentUser = async (): Promise<PlanAccessResult> => {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return { status: 'no-session' };

        // Check cycle state FIRST - prevent validation during break
        const cycleState = await getCurrentCycleState();
        if (!cycleState.canValidate) {
            if (cycleState.state === 'break' && cycleState.nextCycleStart) {
                const nextStart = new Date(cycleState.nextCycleStart);
                const hours = nextStart.getHours().toString().padStart(2, '0');
                const minutes = nextStart.getMinutes().toString().padStart(2, '0');
                return { 
                    status: 'cycle-break', 
                    message: `Intervalo entre ciclos. O próximo ciclo começa às ${hours}:${minutes}.` 
                };
            }
            if (cycleState.state === 'break') {
                return { 
                    status: 'cycle-break', 
                    message: 'Intervalo entre ciclos. Aguarde o próximo ciclo iniciar para validar.' 
                };
            }
            return { 
                status: 'no-cycle', 
                message: 'Nenhum ciclo ativo no momento. Aguarde o próximo ciclo.' 
            };
        }

        let activePlan = await fetchActivePlan(userId);
        let exhaustedPlanDetected = false;
        if (activePlan && isPlanExhausted(activePlan)) {
            exhaustedPlanDetected = true;
            await markPlanCompleted(activePlan);
            activePlan = null;
        }

        if (activePlan) {
            return { status: 'ok', userId, plan: activePlan, creditSource: 'plan' };
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('compensatory_credit_balance')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        const compensatoryBalance = Math.max(Number(profile?.compensatory_credit_balance || 0), 0);
        if (compensatoryBalance > PLAN_CREDIT_EPSILON) {
            return { status: 'ok', userId, plan: null, creditSource: 'compensatory' };
        }

        return exhaustedPlanDetected ? { status: 'exhausted' } : { status: 'no-plan' };
    } catch (error: any) {
        return { status: 'error', message: error?.message || 'Erro ao verificar plano.' };
    }
};

export const hasActiveSellerLink = async (userId: string): Promise<boolean> => {
    void userId;
    const { data, error } = await supabase.rpc('user_has_active_seller_link');

    if (error) throw error;
    return data === true;
};

export type SellerCampaignAccess = {
    has_access: boolean;
    seller_id: string | null;
    seller_name: string | null;
    seller_code: string | null;
    seller_referral_id: number | null;
    source: SellerCampaignSource | null;
    campaign_enabled_at: string | null;
    affiliate_link: string | null;
};

export const getMySellerCampaignAccess = async (): Promise<SellerCampaignAccess> => {
    const { data, error } = await supabase.rpc('get_my_seller_campaign_access');
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
        has_access: row?.has_access === true,
        seller_id: row?.seller_id || null,
        seller_name: row?.seller_name || null,
        seller_code: row?.seller_code || null,
        seller_referral_id: row?.seller_referral_id ?? null,
        source: row?.source || null,
        campaign_enabled_at: row?.campaign_enabled_at || null,
        affiliate_link: row?.affiliate_link || null
    };
};

