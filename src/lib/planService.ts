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
    const { data } = await supabase
        .from('news_tasks')
        .select('cycle_start_at')
        .order('cycle_start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data?.cycle_start_at) {
        return { state: 'no-cycle', canValidate: false };
    }

    const now = new Date().getTime();
    const cycleStart = new Date(data.cycle_start_at).getTime();
    const cycleEnd = cycleStart + (24 * 60 * 60 * 1000); // +24h
    const nextCycleStart = cycleEnd + (30 * 60 * 1000); // +30min

    if (now >= cycleStart && now < cycleEnd) {
        return { state: 'active', canValidate: true, cycleStart, cycleEnd };
    }

    if (now >= cycleEnd && now < nextCycleStart) {
        return { state: 'break', canValidate: false, nextCycleStart };
    }

    return { state: 'waiting-next', canValidate: false };
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

        const activePlan = await fetchActivePlan(userId);
        if (!activePlan) return { status: 'no-plan' };

        // Check if plan started before current cycle (expired)
        if (cycleState.cycleStart) {
            const planStart = new Date(activePlan.started_at).getTime();
            if (planStart < cycleState.cycleStart) {
                await markPlanCompleted(activePlan); 
                return { status: 'exhausted', message: 'Seu plano expirou com o fim do ciclo anterior.' } as any;
            }
        }

        if (activePlan.used_validations >= activePlan.max_validations) {
            await markPlanCompleted(activePlan);
            return { status: 'exhausted' };
        }

        return { status: 'ok', userId, plan: activePlan };
    } catch (error: any) {
        return { status: 'error', message: error?.message || 'Erro ao verificar plano.' };
    }
};
