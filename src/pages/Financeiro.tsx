
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    Wallet,
    Calendar,
    Download
} from 'lucide-react';
import WithdrawalModal from '../components/WithdrawalModal';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';

interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    status: 'completed' | 'pending' | 'failed';
}

const Financeiro = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchFinancialData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) return;

                // 1. Get Balance
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('current_balance')
                    .eq('id', user.id)
                    .single();

                if (profile) setBalance(profile.current_balance || 0);

                // 2. Get Transactions
                const { data: txs } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (txs) {
                    setTransactions(txs as any);
                } else {
                    // If no transactions found (new user), maybe show empty state
                    setTransactions([]);
                }

            } catch (error) {
                console.error('Error fetching finance:', error);
            }
        };

        fetchFinancialData();
    }, [refreshTrigger]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredTransactions = filter === 'all'
        ? transactions
        : transactions.filter(t => t.type === filter);

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans flex flex-col pb-24">
            {/* Header with Logo */}
            <AppHeader
                title="Minha Carteira"
                showBackButton={true}
            />

            <div className="flex-1 overflow-y-auto pb-safe-area-bottom p-6">

                {/* Balance Card */}
                <div className="bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] rounded-3xl p-6 relative overflow-hidden shadow-2xl mb-8 border border-white/10">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10" />

                    <div className="relative z-10">
                        <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                            <Wallet className="w-4 h-4" /> Saldo Disponível
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white">{formatCurrency(balance)}</span>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowWithdrawModal(true)}
                                className="flex-1 bg-white text-purple-900 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowDownLeft className="w-4 h-4" />
                                Sacar Pix
                            </button>
                            <button className="flex-1 bg-purple-700/50 text-white border border-white/20 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" />
                                Extrato
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transactions Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">Histórico</h3>
                        <div className="flex bg-[#1A1040] rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filter === 'all' ? 'bg-[#9D5CFF] text-white' : 'text-slate-400'}`}
                            >
                                Tudo
                            </button>
                            <button
                                onClick={() => setFilter('credit')}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filter === 'credit' ? 'bg-[#9D5CFF] text-white' : 'text-slate-400'}`}
                            >
                                Entradas
                            </button>
                            <button
                                onClick={() => setFilter('debit')}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${filter === 'debit' ? 'bg-[#9D5CFF] text-white' : 'text-slate-400'}`}
                            >
                                Saídas
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredTransactions.length > 0 ? (
                            filteredTransactions.map(tx => (
                                <div key={tx.id} className="bg-[#1A1040] rounded-2xl p-4 flex items-center justify-between border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${tx.type === 'credit'
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                            }`}>
                                            {tx.type === 'credit' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-white">{tx.description}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(tx.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-slate-200'}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </p>
                                        <p className="text-[10px] text-slate-500 capitalize">{tx.status}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 opacity-50">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Calendar className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-300">Nenhuma transação encontrada</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <WithdrawalModal
                isOpen={showWithdrawModal}
                onClose={() => setShowWithdrawModal(false)}
                currentBalance={balance}
                onSuccess={() => {
                    // Refresh data
                    setRefreshTrigger(prev => prev + 1);
                }}
            />
            <BottomNav />
        </div>
    );
}

export default Financeiro;
