import React from 'react';
import { User, X, Trash2, Mail } from 'lucide-react';
import { ExtendedAdminUser, UserPurchase, UserTransaction } from '../../hooks/useAdminData';
import { formatBRL, formatDateTimeBR } from '../../utils/format';

interface UserDetailModalProps {
    show: boolean;
    onClose: () => void;
    user: ExtendedAdminUser | null;
    history: { purchases: UserPurchase[]; transactions: UserTransaction[] };
    loading: boolean;
    onDelete: (id: string) => void;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({
    show,
    onClose,
    user,
    history,
    loading,
    onDelete
}) => {
    if (!show || !user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#1A0B38] shadow-2xl sm:rounded-2xl custom-scrollbar" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-white/5 bg-[#2A1B54] p-4 sm:p-6 sticky top-0 z-10">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-purple-500 bg-purple-900 sm:h-16 sm:w-16">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="h-7 w-7 text-purple-300 sm:h-8 sm:w-8" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-lg font-bold sm:text-xl">{user.name} {user.lastname}</h2>
                            <p className="truncate text-sm text-slate-400">{user.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] sm:text-xs text-slate-300">ID: {user.id}</span>
                                <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-bold">Criado: {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${user.last_validation_at ? 'text-purple-400' : 'text-slate-600'}`}>
                                    Última Validação: {user.last_validation_at ? formatDateTimeBR(user.last_validation_at) : 'Nunca'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        title="Fechar"
                        className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display">Financeiro</h3>
                        <div className="space-y-3 rounded-xl border border-white/5 bg-[#0F0529] p-4 shadow-inner">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs text-[10px] font-bold uppercase tracking-widest">Saldo Atual</span>
                                <span className="font-mono font-bold text-white text-lg">{formatBRL(user.current_balance || 0)}</span>
                            </div>
                            <div className="w-full h-px bg-white/5"></div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Carregado</span>
                                <span className="font-mono text-green-400/80 font-bold">+ {formatBRL(user.total_loaded || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Gasto</span>
                                <span className="font-mono text-red-400/80 font-bold">- {formatBRL(user.total_spent || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display">Rede de Afiliados</h3>
                        <div className="space-y-3 rounded-xl border border-white/5 bg-[#0F0529] p-4 shadow-inner">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Indicados Diretos</span>
                                <span className="font-bold text-white text-sm">{user.referrals_count} pessoas</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Comissão Total</span>
                                <span className="font-mono text-yellow-400 font-bold">{formatBRL(user.total_commission || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-display uppercase tracking-wider font-bold">Convidado Por</span>
                                <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded italic">{user.affiliate_code || 'Orgânico'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 md:col-span-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display">Informações de Contato</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/5 bg-[#0F0529] p-3">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-display block mb-1">Telefone</span>
                                <span className="text-white text-sm font-medium">{user.phone || 'Não informado'}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0F0529] p-3">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-display block mb-1">Localização</span>
                                <span className="text-white text-sm font-medium">{user.city || '—'} / {user.state || '—'}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0F0529] p-3 theme-cpf">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-display block mb-1">CPF</span>
                                <span className="text-white text-sm font-medium">{user.cpf || 'Não informado'}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-[#0F0529] p-3">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-display block mb-1">Nascimento</span>
                                <span className="text-white text-sm font-medium">{user.birth_date ? new Date(user.birth_date).toLocaleDateString('pt-BR') : 'Não informado'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 md:col-span-2 border-t border-white/5 pt-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-display">Histórico de Atividade (Anti-Fraude)</h3>
                        
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3 rounded-2xl border border-white/5 bg-[#0F0529]">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent shadow-[0_0_15px_rgba(168,85,247,0.3)]"></div>
                                <p className="text-[10px] text-slate-400 animate-pulse font-display uppercase tracking-widest">Auditorando histórico financeiro...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Purchases History */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-display pl-1">Compras de Ciclos</h4>
                                    <div className="max-h-[350px] overflow-y-auto space-y-2 rounded-xl border border-white/5 bg-[#0F0529] p-2 custom-scrollbar">
                                        {history.purchases.length === 0 ? (
                                            <div className="py-8 text-center bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                                                <p className="text-[10px] text-slate-600 font-display uppercase italic">Nenhuma compra realizada</p>
                                            </div>
                                        ) : (
                                            history.purchases.map((purchase) => (
                                                <div key={purchase.id} className="group flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06] hover:border-purple-500/30">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <span className="truncate text-xs font-bold text-slate-200">Plano: {purchase.plan_id || 'ID Desconhecido'}</span>
                                                            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase">{formatDateTimeBR(purchase.created_at)}</span>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-xs font-mono font-bold text-purple-400">{formatBRL(purchase.amount)}</div>
                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter font-bold ${
                                                                purchase.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'
                                                            }`}>
                                                                {purchase.status === 'completed' ? 'Pago' : 'Pendente'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {purchase.mp_payment_id && (
                                                        <div className="mt-1 flex items-center gap-2 border-t border-white/5 pt-1">
                                                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">ID MP:</span>
                                                            <span className="text-[8px] font-mono text-slate-400 truncate select-all">{purchase.mp_payment_id}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Transactions History */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 font-display pl-1">Movimentações de Saldo</h4>
                                    <div className="max-h-[250px] overflow-y-auto space-y-2 rounded-xl border border-white/5 bg-[#0F0529] p-2 custom-scrollbar">
                                        {history.transactions.length === 0 ? (
                                            <div className="py-8 text-center bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                                                <p className="text-[10px] text-slate-600 font-display uppercase italic">Sem movimentações</p>
                                            </div>
                                        ) : (
                                            history.transactions.map((tx) => (
                                                <div key={tx.id} className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-all hover:bg-white/[0.06] hover:border-blue-500/30">
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <span className="truncate text-[10px] font-medium text-slate-300 leading-tight">{tx.description}</span>
                                                        <span className="text-[9px] text-slate-500 font-mono italic">{formatDateTimeBR(tx.created_at)}</span>
                                                    </div>
                                                    <div className={`text-xs font-mono font-bold shrink-0 ml-2 ${
                                                        tx.type === 'credit' ? 'text-green-400' : 'text-red-400'
                                                    }`}>
                                                        {tx.type === 'credit' ? '+' : '-'} {formatBRL(tx.amount)}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-col-reverse gap-3 border-t border-white/5 pt-6 md:col-span-2 sm:flex-row sm:justify-end">
                        <button
                            onClick={() => {
                                if (window.confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) {
                                    onDelete(user.id);
                                    onClose();
                                }
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-2 text-red-400 transition-colors hover:bg-red-500 hover:text-white sm:w-auto text-[10px] font-black uppercase tracking-widest font-display"
                        >
                            <Trash2 className="w-4 h-4" />
                            Excluir Usuário
                        </button>
                        {user.email && (
                            <a
                                href={`mailto:${user.email}`}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-6 py-2 text-purple-100 transition-colors hover:bg-purple-500/20 sm:w-auto text-[10px] font-black uppercase tracking-widest font-display"
                            >
                                <Mail className="h-4 w-4" />
                                Enviar E-mail
                            </a>
                        )}
                        <button onClick={onClose} className="w-full rounded-xl bg-white/10 px-6 py-2 text-white transition-colors hover:bg-white/20 sm:w-auto font-black uppercase tracking-widest text-[10px] font-display">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailModal;
