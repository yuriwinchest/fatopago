import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ReferralData {
    id: number;
    referrer_id: string;
    referred_id: string;
    created_at: string;
    referred_name?: string;
    referred_lastname?: string;
}

export interface CommissionData {
    id: number;
    referrer_id: string;
    referred_id: string;
    plan_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
}

export interface ReferralStats {
    totalCommissions: number;
    pendingCommissions: number;
    paidCommissions: number;
    referralCount: number;
}

export function useReferral() {
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [referralActive, setReferralActive] = useState(false);
    const [referrals, setReferrals] = useState<ReferralData[]>([]);
    const [commissions, setCommissions] = useState<CommissionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadReferralData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            const userId = session.user.id;

            // Buscar dados em paralelo
            const [profileResult, referralsResult, commissionsResult] = await Promise.all([
                // Profile (para referral_code e referral_active)
                supabase
                    .from('profiles')
                    .select('referral_code, referral_active')
                    .eq('id', userId)
                    .single(),

                // Indicados
                supabase
                    .from('referrals')
                    .select('*')
                    .eq('referrer_id', userId)
                    .order('created_at', { ascending: false }),

                // Comissoes
                supabase
                    .from('commissions')
                    .select('*')
                    .eq('referrer_id', userId)
                    .order('created_at', { ascending: false })
            ]);

            if (profileResult.data) {
                setReferralCode(profileResult.data.referral_code);
                setReferralActive(profileResult.data.referral_active ?? false);
            }

            // No Dashboard/ReferralPanel a gente só precisa da contagem, então não faz sentido
            // fazer N+1 queries para buscar nome/sobrenome dos indicados.
            setReferrals((referralsResult.data || []) as ReferralData[]);

            setCommissions((commissionsResult.data || []) as CommissionData[]);
        } catch (err: any) {
            console.error('Error loading referral data:', err);
            setError(err.message || 'Erro ao carregar dados de indicação');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReferralData();
    }, [loadReferralData]);

    const toNumber = (v: any) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    // Stats calculados
    const stats: ReferralStats = {
        totalCommissions: commissions.reduce((sum, c) => sum + toNumber((c as any).amount), 0),
        pendingCommissions: commissions
            .filter(c => c.status === 'pending')
            .reduce((sum, c) => sum + toNumber((c as any).amount), 0),
        paidCommissions: commissions
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + toNumber((c as any).amount), 0),
        referralCount: referrals.length
    };

    return {
        referralCode,
        referralActive,
        referrals,
        commissions,
        stats,
        loading,
        error,
        refresh: loadReferralData
    };
}
