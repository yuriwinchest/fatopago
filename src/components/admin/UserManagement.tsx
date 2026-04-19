import React, { useMemo } from 'react';
import { Search, User, Trash2, Users as UsersIcon, CheckCircle2, ShoppingBag, UserX } from 'lucide-react';
import { ExtendedAdminUser } from '../../hooks/useAdminData';
import { formatBRL, formatDateTimeBR } from '../../utils/format';

interface UserManagementProps {
    users: ExtendedAdminUser[];
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    registrationDateFilter: string;
    setRegistrationDateFilter: (v: string) => void;
    currentUsersPage: number;
    setCurrentUsersPage: (v: number) => void;
    handleDelete: (id: string) => void;
    handleUserClick: (user: ExtendedAdminUser) => void;
}

const USERS_PER_PAGE = 20;

const UserManagement: React.FC<UserManagementProps> = ({
    users,
    searchTerm,
    setSearchTerm,
    registrationDateFilter,
    setRegistrationDateFilter,
    currentUsersPage,
    setCurrentUsersPage,
    handleDelete,
    handleUserClick
}) => {
    // Stats agregadas sobre TODOS os users (nao apenas filtrados):
    // - Total cadastrados
    // - Com plano ativo agora (plan_status='active')
    // - Ja assinaram pelo menos 1 pacote (total_loaded > 0 = carregou saldo
    //   via compra de plano em algum momento)
    // - Nunca assinaram (total - ever_purchased, exclui deletados pra clareza)
    const stats = useMemo(() => {
        const total = users.length;
        const activeNow = users.filter(u => u.plan_status === 'active').length;
        const deletedCount = users.filter(u => u.plan_status === 'deleted').length;
        const everPurchased = users.filter(u => (u.total_loaded || 0) > 0).length;
        const neverPurchased = Math.max(0, total - everPurchased - deletedCount);
        return { total, activeNow, everPurchased, neverPurchased, deletedCount };
    }, [users]);

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (searchTerm.replace(/\D/g, '') &&
                user.cpf?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')));

        const matchesDate = !registrationDateFilter ||
            new Date(user.created_at).toISOString().split('T')[0] === registrationDateFilter;

        return matchesSearch && matchesDate;
    });

    const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
    const safeUsersPage = Math.min(currentUsersPage, totalUsersPages);
    const paginatedUsers = filteredUsers.slice(
        (safeUsersPage - 1) * USERS_PER_PAGE,
        safeUsersPage * USERS_PER_PAGE
    );
    const usersPageStart = filteredUsers.length === 0 ? 0 : ((safeUsersPage - 1) * USERS_PER_PAGE) + 1;
    const usersPageEnd = Math.min(safeUsersPage * USERS_PER_PAGE, filteredUsers.length);

    return (
        <>
            {/* Stats cards: visao agregada dos usuarios cadastrados */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <UsersIcon className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Total cadastrados</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                        {stats.total.toLocaleString('pt-BR')}
                    </div>
                    {stats.deletedCount > 0 && (
                        <div className="mt-1 text-[11px] text-slate-500">
                            inclui {stats.deletedCount} anonimizados
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Plano ativo agora</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                        {stats.activeNow.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                        {stats.total > 0 ? `${Math.round((stats.activeNow / stats.total) * 100)}% do total` : ''}
                    </div>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.08] p-4">
                    <div className="flex items-center gap-2 text-purple-300">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Já assinaram</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                        {stats.everPurchased.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                        histórico (qualquer pacote)
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-500/20 bg-slate-500/[0.06] p-4">
                    <div className="flex items-center gap-2 text-slate-300">
                        <UserX className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">Nunca assinaram</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                        {stats.neverPurchased.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                        {stats.total > 0 ? `${Math.round((stats.neverPurchased / stats.total) * 100)}% do total` : ''}
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                    <label className="relative block group">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-purple-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou cpf..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentUsersPage(1);
                            }}
                            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-12 pr-4 text-white placeholder:text-slate-500 transition-all focus:border-purple-500/40 focus:bg-white/[0.08] focus:outline-none sm:text-base ring-offset-background"
                        />
                    </label>
                </div>
                <div className="relative sm:w-64">
                    <input
                        type="date"
                        title="Filtrar por data de cadastro"
                        value={registrationDateFilter}
                        onChange={(e) => {
                            setRegistrationDateFilter(e.target.value);
                            setCurrentUsersPage(1);
                        }}
                        className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-white transition-all focus:border-purple-500/40 focus:bg-white/[0.08] focus:outline-none sm:text-base [color-scheme:dark]"
                    />
                    {!registrationDateFilter && (
                        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 sm:text-base">
                            Filtrar por data...
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-4 flex flex-col gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display sm:flex-row sm:items-center sm:justify-between">
                <span>
                    {filteredUsers.length === 0
                        ? 'Nenhum usuário encontrado.'
                        : `Mostrando ${usersPageStart} a ${usersPageEnd} de ${filteredUsers.length}`}
                </span>
                <span className="text-slate-400">
                    Página {safeUsersPage} / {totalUsersPages}
                </span>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 lg:hidden">
                {paginatedUsers.map((user) => (
                    <article key={user.id} className="admin-glass-card p-5 group transition-all">
                        <div className="flex items-start justify-between gap-3">
                            <button
                                onClick={() => handleUserClick(user)}
                                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                            >
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-purple-400/30 bg-purple-800/60 transition-colors group-hover:border-purple-300">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <User className="h-5 w-5 text-purple-300" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-base font-extrabold text-white font-display tracking-[0.05em] [word-spacing:0.2em]">
                                        {`${user.name || ''} ${user.lastname || ''}`.trim() || 'Usuário'}
                                    </p>
                                    <p className="truncate text-xs text-slate-400">{user.email || 'Email oculto'}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="h-1 w-1 rounded-full bg-slate-500" />
                                        <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">
                                            {user.city || '—'} / {user.state || '—'}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                title="Excluir Usuário"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(user.id);
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition-all hover:bg-red-500 hover:text-white"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">Saldo</p>
                                <p className={`mt-1 font-display text-base font-black ${user.current_balance > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {formatBRL(user.current_balance || 0)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">Comissão</p>
                                <p className={`mt-1 font-display text-base font-black ${user.total_commission > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                                    {formatBRL(user.total_commission || 0)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 font-display">
                                {user.referrals_count} indicados
                            </span>
                            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">
                                {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display" title={`Última validação: ${user.last_validation_at ? formatDateTimeBR(user.last_validation_at) : 'Nunca'}`}>
                                {user.last_validation_at ? `Valid: ${formatDateTimeBR(user.last_validation_at)}` : 'Nunca validou'}
                            </span>
                            {user.affiliate_code && (
                                <span className="inline-flex items-center rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-300 font-display">
                                    Cod: {user.affiliate_code}
                                </span>
                            )}
                        </div>
                    </article>
                ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/5 bg-[#1A0B38] lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Usuário</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Localização</th>
                                <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Indicados</th>
                                <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Comissão</th>
                                <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Saldo</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Cadastro</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Última Validação</th>
                                <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paginatedUsers.map((user) => (
                                <tr
                                    key={user.id}
                                    className="group cursor-pointer transition-colors hover:bg-white/5"
                                    onClick={() => handleUserClick(user)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-purple-500/20 bg-purple-900/50 transition-colors group-hover:border-purple-400">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-5 w-5 text-purple-300" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-white font-display uppercase tracking-tight">
                                                    {`${user.name || ''} ${user.lastname || ''}`.trim() || 'Usuário'}
                                                </p>
                                                <p className="truncate text-[10px] text-slate-500 font-display uppercase tracking-widest">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-display">
                                            {user.city || '—'} / {user.state || '—'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-display">
                                            {user.referrals_count}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-mono text-[11px] font-black text-amber-400">
                                            {formatBRL(user.total_commission || 0)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-mono text-[11px] font-black text-emerald-400">
                                            {formatBRL(user.current_balance || 0)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-display">
                                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest font-display ${user.last_validation_at ? 'text-purple-400' : 'text-slate-600 italic'}`}>
                                            {user.last_validation_at 
                                              ? formatDateTimeBR(user.last_validation_at) 
                                              : 'Nunca'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                title="Excluir Usuário"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(user.id);
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition-all hover:bg-red-500 hover:text-white"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalUsersPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                        title="Página anterior"
                        onClick={() => setCurrentUsersPage(Math.max(1, safeUsersPage - 1))}
                        disabled={safeUsersPage === 1}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-white/10 disabled:opacity-30"
                    >
                        Anterior
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalUsersPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalUsersPages || Math.abs(p - safeUsersPage) <= 1)
                            .map((p, i, arr) => (
                                <React.Fragment key={p}>
                                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-slate-600">...</span>}
                                    <button
                                        onClick={() => setCurrentUsersPage(p)}
                                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${safeUsersPage === p
                                            ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            ))}
                    </div>
                    <button
                        title="Próxima página"
                        onClick={() => setCurrentUsersPage(Math.min(totalUsersPages, safeUsersPage + 1))}
                        disabled={safeUsersPage === totalUsersPages}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-white/10 disabled:opacity-30"
                    >
                        Próxima
                    </button>
                </div>
            )}

        </>
    );
};

export default UserManagement;
