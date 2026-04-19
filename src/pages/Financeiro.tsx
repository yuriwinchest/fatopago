import { useMemo, useState } from 'react';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    Wallet,
    Download,
    FileText
} from 'lucide-react';
import WithdrawalModal from '../components/WithdrawalModal';
import ReferralPanel from '../components/ReferralPanel';
import { AppLayout } from '../layouts/AppLayout';
import { useFinancial } from '../hooks/useFinancial';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/classNames';
import { getPixWithdrawalStatusLabel, maskPixKey } from '../lib/pixWithdrawals';

const Financeiro = () => {
    const {
        balance,
        transactions,
        withdrawals,
        filteredTransactions,
        filter,
        setFilter,
        triggerRefresh,
        pendingWithdrawalsCount
    } = useFinancial();

    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const stats = useMemo(() => {
        const credits = transactions.filter(tx => tx.type === 'credit');
        const debits = transactions.filter(tx => tx.type === 'debit');

        const totalCredits = credits.reduce((sum, tx) => sum + tx.amount, 0);
        const totalDebits = debits.reduce((sum, tx) => sum + tx.amount, 0);

        return {
            creditCount: credits.length,
            debitCount: debits.length,
            pendingCount: pendingWithdrawalsCount,
            totalCredits,
            totalDebits
        };
    }, [pendingWithdrawalsCount, transactions]);

    const exportStatement = () => {
        if (filteredTransactions.length === 0) return;

        const header = ['Data', 'Descricao', 'Tipo', 'Valor', 'Status'];
        const rows = filteredTransactions.map(tx => [
            formatDate(tx.created_at),
            tx.description,
            tx.type === 'credit' ? 'Entrada' : 'Saída',
            tx.amount.toFixed(2).replace('.', ','),
            tx.status
        ]);

        const csvContent = [header, ...rows]
            .map(line => line.map(value => `"${value.replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.setAttribute('download', `extrato-fatopago-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const statusLabel = (status: string) => {
        if (status === 'completed') return 'Concluído';
        if (status === 'pending') return 'Pendente';
        return 'Falhou';
    };

    const filterOptions: Array<{ value: 'all' | 'credit' | 'debit'; label: string }> = [
        { value: 'all', label: 'Tudo' },
        { value: 'credit', label: 'Entradas' },
        { value: 'debit', label: 'Saídas' }
    ];

    return (
        <AppLayout
            title="Minha Carteira"
            showBackButton={true}
        >
            <div className="space-y-6 pb-2 lg:space-y-8">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                    <div className="space-y-4 xl:col-span-4">
                        <Card tone="elevated" className="relative overflow-hidden border-purple-400/20 bg-gradient-to-br from-[#6D28D9] via-[#5B21B6] to-[#1E1B4B] p-6">
                            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
                            <div className="relative z-10">
                                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-200">
                                    <Wallet className="h-4 w-4" />
                                    Saldo Disponível
                                </p>
                                <p className="text-4xl font-black leading-none text-white">{formatCurrency(balance)}</p>
                                <p className="mt-2 text-[11px] text-purple-200">Saldo de comissões por indicações</p>

                                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                    <Button
                                        onClick={() => setShowWithdrawModal(true)}
                                        className="bg-white text-purple-900 hover:bg-white/90"
                                        leftIcon={<ArrowDownLeft className="h-4 w-4" />}
                                    >
                                        Sacar Pix
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={exportStatement}
                                        disabled={filteredTransactions.length === 0}
                                        className="border-white/20 bg-purple-700/40 text-white hover:bg-purple-700/55"
                                        leftIcon={<Download className="h-4 w-4" />}
                                    >
                                        Extrato
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        <Card tone="soft" className="border-purple-400/15 bg-purple-500/5 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-2">Regras de saque</p>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                                <li>Valor mínimo para saque: <span className="font-bold text-white">R$ 10,00</span></li>
                                <li>Status real do saque: <span className="font-bold text-white">acompanhe pela fila abaixo</span></li>
                                <li>Saldo gerado por <span className="font-bold text-white">comissões de indicações</span></li>
                            </ul>
                        </Card>

                        <div className="grid grid-cols-2 gap-3">
                            <Card tone="soft" className="space-y-2 border-green-400/20 bg-green-500/5 p-4">
                                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-green-300">
                                    <ArrowUpRight className="h-4 w-4" />
                                    Entradas
                                </p>
                                <p className="text-lg font-black text-white">{formatCurrency(stats.totalCredits)}</p>
                                <p className="text-xs text-green-200/80">{stats.creditCount} transações</p>
                            </Card>

                            <Card tone="soft" className="space-y-2 border-red-400/20 bg-red-500/5 p-4">
                                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-red-300">
                                    <ArrowDownLeft className="h-4 w-4" />
                                    Saídas
                                </p>
                                <p className="text-lg font-black text-white">{formatCurrency(stats.totalDebits)}</p>
                                <p className="text-xs text-red-200/80">{stats.debitCount} transações</p>
                            </Card>

                            <Card tone="soft" className="col-span-2 flex items-center justify-between border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">Pendentes</p>
                                    <p className="text-sm text-yellow-100">Aguardando processamento</p>
                                </div>
                                <p className="text-2xl font-black text-white">{stats.pendingCount}</p>
                            </Card>
                        </div>
                    </div>

                    <div className="space-y-4 xl:col-span-8">
                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Saques PIX</h3>
                                    <p className="text-xs text-slate-400">
                                        {withdrawals.length} solicitações registradas. O saldo debitado só deve ser considerado liquidado quando o saque concluir.
                                    </p>
                                </div>
                                <div className="text-xs font-semibold text-slate-400">
                                    Em andamento: <span className="font-bold text-white">{pendingWithdrawalsCount}</span>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                {withdrawals.length > 0 ? (
                                    withdrawals.slice(0, 8).map((withdrawal) => (
                                        <div
                                            key={withdrawal.id}
                                            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#120a2a] p-4 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-bold text-white">{formatCurrency(withdrawal.amount)}</p>
                                                    <span className={cn(
                                                        'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                                                        withdrawal.status === 'completed' && 'bg-green-500/10 text-green-300',
                                                        withdrawal.status === 'pending' && 'bg-cyan-500/10 text-cyan-300',
                                                        withdrawal.status === 'pending_manual_review' && 'bg-amber-500/10 text-amber-300',
                                                        withdrawal.status === 'processing' && 'bg-indigo-500/10 text-indigo-300',
                                                        withdrawal.status === 'failed' && 'bg-red-500/10 text-red-300',
                                                        withdrawal.status === 'cancelled' && 'bg-slate-500/10 text-slate-300'
                                                    )}>
                                                        {getPixWithdrawalStatusLabel(withdrawal.status)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                                    <span>{formatDate(withdrawal.created_at)}</span>
                                                    <span>Chave: {maskPixKey(withdrawal.pix_key)}</span>
                                                    {withdrawal.external_status && <span>Provider: {withdrawal.external_status}</span>}
                                                </div>
                                                {(withdrawal.review_reason || withdrawal.failed_reason) && (
                                                    <p className="mt-2 text-xs text-slate-300">
                                                        {withdrawal.failed_reason || withdrawal.review_reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-white/10 bg-[#120a2a] px-4 py-8 text-center text-sm text-slate-400">
                                        Nenhum saque PIX solicitado ainda.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Histórico financeiro</h3>
                                    <p className="text-xs text-slate-400">{filteredTransactions.length} transações exibidas</p>
                                </div>

                                <div className="inline-flex w-full rounded-xl border border-white/10 bg-[#120a2a] p-1 md:w-auto">
                                    {filterOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFilter(option.value)}
                                            className={cn(
                                                'flex-1 rounded-lg px-3 py-2 text-[11px] font-bold transition-all md:flex-none',
                                                filter === option.value
                                                    ? 'bg-[hsl(var(--primary))] text-white shadow-[var(--platform-surface-shadow)]'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        <Card tone="default" className="animate-in fade-in slide-in-from-bottom-4 border-white/10 bg-[#1A1040] p-5 duration-500">
                            <div className="space-y-3 xl:max-h-[620px] xl:overflow-y-auto xl:pr-1">
                                {filteredTransactions.length > 0 ? (
                                    filteredTransactions.map(tx => (
                                        <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#120a2a] p-4 transition-colors hover:border-purple-500/30">
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${tx.type === 'credit'
                                                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                                        : 'border-red-500/30 bg-red-500/10 text-red-400'
                                                    }`}>
                                                    {tx.type === 'credit' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{tx.description}</p>
                                                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDate(tx.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-slate-200'}`}>
                                                    {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                </p>
                                                <p className={cn(
                                                    'mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                                                    tx.status === 'completed' && 'bg-green-500/10 text-green-300',
                                                    tx.status === 'pending' && 'bg-yellow-500/10 text-yellow-300',
                                                    tx.status === 'failed' && 'bg-red-500/10 text-red-300'
                                                )}>
                                                    {statusLabel(tx.status)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center opacity-50">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                            <FileText className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-300">Nenhuma transação encontrada</p>
                                        <p className="mt-1 text-xs text-slate-500">Altere o filtro ou aguarde novas movimentações.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Secao de Indicacoes */}
                <ReferralPanel />
            </div>

            <WithdrawalModal
                isOpen={showWithdrawModal}
                onClose={() => setShowWithdrawModal(false)}
                currentBalance={balance}
                onSuccess={triggerRefresh}
            />
        </AppLayout>
    );
}

export default Financeiro;
