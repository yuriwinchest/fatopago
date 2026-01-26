import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    status: 'completed' | 'pending' | 'failed';
}

export function useFinancial() {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchFinancialData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) return;

                // Parallel fetch
                const [profileRes, txRes] = await Promise.all([
                    supabase.from('profiles').select('current_balance').eq('id', user.id).single(),
                    supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
                ]);

                if (profileRes.data) setBalance(profileRes.data.current_balance || 0);

                if (txRes.data) {
                    setTransactions(txRes.data as any);
                } else {
                    setTransactions([]);
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

    return {
        balance,
        transactions,
        filteredTransactions,
        filter,
        setFilter,
        triggerRefresh
    };
}
