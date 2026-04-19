import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { isOpenPixWithdrawalStatus, PixWithdrawalStatus } from '../lib/pixWithdrawals';

interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    status: 'completed' | 'pending' | 'failed';
}

export interface PixWithdrawal {
    id: string;
    amount: number;
    pix_key: string;
    pix_key_type: string;
    status: PixWithdrawalStatus;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    failed_at: string | null;
    failed_reason: string | null;
    review_reason: string | null;
    external_status: string | null;
}

export function useFinancial() {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [withdrawals, setWithdrawals] = useState<PixWithdrawal[]>([]);
    const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchFinancialData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) return;

                // Parallel fetch
                const [profileRes, txRes, withdrawalsRes] = await Promise.all([
                    supabase.from('profiles').select('current_balance').eq('id', user.id).maybeSingle(),
                    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                    supabase
                        .from('pix_withdrawals')
                        .select('id, amount, pix_key, pix_key_type, status, created_at, updated_at, completed_at, failed_at, failed_reason, review_reason, external_status')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                ]);

                if (profileRes.error) {
                    throw profileRes.error;
                }

                setBalance(profileRes.data?.current_balance || 0);

                if (txRes.data) {
                    setTransactions(txRes.data as any);
                } else {
                    setTransactions([]);
                }

                if (withdrawalsRes.error) {
                    throw withdrawalsRes.error;
                }

                if (withdrawalsRes.data) {
                    setWithdrawals(withdrawalsRes.data as PixWithdrawal[]);
                } else {
                    setWithdrawals([]);
                }

            } catch (error) {
                console.error('Error fetching finance:', error);
            }
        };

        fetchFinancialData();
    }, [refreshTrigger]);

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    const filteredTransactions = filter === 'all'
        ? transactions
        : transactions.filter(t => t.type === filter);

    const openWithdrawals = useMemo(
        () => withdrawals.filter((withdrawal) => isOpenPixWithdrawalStatus(withdrawal.status)),
        [withdrawals]
    );

    return {
        balance,
        transactions,
        withdrawals,
        openWithdrawals,
        pendingWithdrawalsCount: openWithdrawals.length,
        filteredTransactions,
        filter,
        setFilter,
        triggerRefresh
    };
}
