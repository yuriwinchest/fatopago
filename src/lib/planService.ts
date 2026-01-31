import { supabase } from './supabase';
import { PlanId, PlanStatus, PLAN_LIMITS, PlanPurchaseSummary } from './planRules';

export interface PlanPurchase extends PlanPurchaseSummary {
    id: string;
    user_id: string;
    created_at: string;
    updated_at?: string | null;
    last_validation_at?: string | null;
}

export type PlanAccessResult =
    | { status: 'ok'; userId: string; plan: PlanPurchase }
    | { status: 'no-session' }
    | { status: 'no-plan' }
    | { status: 'exhausted' }
    | { status: 'error'; message: string };

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

export const consumeActivePlanValidation = async (plan: PlanPurchase) => {
    const nextUsed = plan.used_validations + 1;
    const now = new Date().toISOString();
    const isComplete = nextUsed >= plan.max_validations;

    const updatePayload: Record<string, any> = {
        used_validations: nextUsed,
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

        const activePlan = await fetchActivePlan(userId);
        if (!activePlan) return { status: 'no-plan' };

        if (activePlan.used_validations >= activePlan.max_validations) {
            await markPlanCompleted(activePlan);
            return { status: 'exhausted' };
        }

        return { status: 'ok', userId, plan: activePlan };
    } catch (error: any) {
        return { status: 'error', message: error?.message || 'Erro ao verificar plano.' };
    }
};
