import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { fetchActivePlan, PlanPurchase } from '../lib/planService';
import {
    WEEKLY_CYCLE_BREAK_MS,
    getWeeklyCycleSnapshot
} from '../lib/cycleSchedule';

type CyclePlanPurchase = Pick<
    PlanPurchase,
    'id' | 'plan_id' | 'status' | 'started_at' | 'completed_at' | 'used_validations' | 'max_validations' | 'validation_credit_total' | 'validation_credit_remaining'
>;

export function useDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activePlan, setActivePlan] = useState<PlanPurchase | null>(null);
    const [cyclePlans, setCyclePlans] = useState<CyclePlanPurchase[]>([]);
    const [totalNewsCount, setTotalNewsCount] = useState<number>(0);

    const refreshActivePlan = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session?.user) return null;
            const next = await fetchActivePlan(session.user.id);
            setActivePlan(next);
            return next;
        } catch (err) {
            console.error('Error refreshing active plan:', err);
            return null;
        }
    };

    const loadDashboard = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session?.user) {
                navigate('/login');
                return;
            }

            const user = session.user;

            const [profileResult, activePlanResult, newsCountResult] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                fetchActivePlan(user.id),
                supabase.from('news_tasks').select('id', { count: 'exact', head: true })
            ]);

            setTotalNewsCount(newsCountResult.count || 0);

            if (profileResult.error) throw profileResult.error;

            const baseProfile: any = {
                name: '',
                lastname: '',
                current_balance: 0,
                compensatory_credit_balance: 0,
                reputation_score: 0,
                city: '',
                state: '',
                affiliate_code: '',
                referral_code: '',
                referral_active: false,
                plan_status: 'none',
                avatar_url: null,
                ...(profileResult.data || {})
            };

            if (!profileResult.data) {
                // Best-effort: create row so the UI never breaks for first-time users.
                try {
                    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });
                } catch (e) {
                    console.warn('Profile row missing and could not be created (best effort):', e);
                }
            }

            setProfile({
                ...baseProfile,
                email: (baseProfile as any)?.email || user.email
            });
            setActivePlan(activePlanResult);

            // Carrega os pacotes comprados no "ciclo atual" (inclui os 30min de intervalo antes do ciclo),
            // para o usuário entender quantos pacotes comprou no ciclo e qual está sendo consumido agora.
            try {
                const localCycle = getWeeklyCycleSnapshot(new Date());
                const cycleRes = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 });

                if (cycleRes.error) {
                    console.warn('Erro ao buscar ciclo (best effort):', cycleRes.error);
                    setCyclePlans([]);
                } else {
                    const row = (Array.isArray(cycleRes.data) ? cycleRes.data[0] : cycleRes.data) as
                        | { cycle_start_at?: string | null; cycle_end_at?: string | null; is_active?: boolean | null }
                        | null;

                    const currentCycleStartAt = new Date(row?.cycle_start_at || localCycle.cycleStartAt);
                    const currentCycleEndAt = new Date(row?.cycle_end_at || localCycle.cycleEndAt);
                    const effectiveStartAt =
                        localCycle.isBreak
                            ? new Date(currentCycleEndAt.getTime() + WEEKLY_CYCLE_BREAK_MS)
                            : currentCycleStartAt;
                    const effectiveEndAt = new Date(effectiveStartAt.getTime() + localCycle.durationMs);
                    const windowStartAt = new Date(effectiveStartAt.getTime() - WEEKLY_CYCLE_BREAK_MS);

                    const plansRes = await supabase
                        .from('plan_purchases')
                        .select('id, plan_id, status, started_at, completed_at, used_validations, max_validations, validation_credit_total, validation_credit_remaining')
                        .eq('user_id', user.id)
                        .gte('started_at', windowStartAt.toISOString())
                        .lt('started_at', effectiveEndAt.toISOString())
                        .order('started_at', { ascending: true });

                    if (plansRes.error) {
                        console.warn('Erro ao buscar pacotes do ciclo (best effort):', plansRes.error);
                        setCyclePlans([]);
                    } else {
                        setCyclePlans((plansRes.data || []) as any);
                    }
                }
            } catch (e) {
                console.warn('Falha ao carregar pacotes do ciclo (best effort):', e);
                setCyclePlans([]);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [navigate]);

    return {
        profile,
        loading,
        activePlan,
        cyclePlans,
        totalNewsCount,
        refreshActivePlan
    };
}
