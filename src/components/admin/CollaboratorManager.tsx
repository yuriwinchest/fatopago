import React, { useState, useMemo } from 'react';
import { 
    Users, 
    Mail, 
    Trash2, 
    RefreshCw, 
    Search,
    UserPlus,
    ShieldCheck
} from 'lucide-react';

export type CollaboratorListItem = {
    id: string;
    name: string;
    email: string;
    created_at: string;
};

interface CollaboratorManagerProps {
    collaborators: CollaboratorListItem[];
    loading: boolean;
    error: string | null;
    onRefresh: () => Promise<void>;
    onSave: (email: string, pass: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isSaving: boolean;
}

const CollaboratorManager: React.FC<CollaboratorManagerProps> = ({
    collaborators,
    loading,
    error,
    onRefresh,
    onSave,
    onDelete,
    isSaving
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    const filteredCollaborators = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return collaborators;
        return collaborators.filter(c => 
            (c.name || '').toLowerCase().includes(query) || 
            (c.email || '').toLowerCase().includes(query)
        );
    }, [collaborators, searchTerm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!email.trim() || !password.trim()) {
            setLocalError('Preencha os campos de e-mail e senha.');
            return;
        }

        if (!email.includes('@')) {
            setLocalError('Informe um e-mail válido.');
            return;
        }

        if (password.length < 6) {
            setLocalError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        try {
            await onSave(email.trim().toLowerCase(), password);
            setEmail('');
            setPassword('');
        } catch (err: any) {
            setLocalError(err.message || 'Erro ao salvar colaborador.');
        }
    };

    return (
        <div className="grid w-full gap-6 lg:grid-cols-[380px_1fr]">
            {/* Formulário de Cadastro */}
            <section className="h-fit rounded-[24px] border border-white/10 bg-[#16082f] p-6">
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-500/70">Segurança</p>
                    <h2 className="mt-2 text-2xl font-black text-white uppercase tracking-tighter">Novo Colaborador</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        O colaborador terá acesso ao painel de notícias para publicar, editar e moderar conteúdos.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="col-email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail de Acesso</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                id="col-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="joao@exemplo.com"
                                className="h-12 w-full rounded-xl border border-white/10 bg-[#0F0521] pl-11 pr-4 text-sm text-white outline-none focus:border-fuchsia-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="col-pass" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Senha Provisória</label>
                        <input
                            id="col-pass"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#0F0521] px-4 text-sm text-white outline-none focus:border-fuchsia-500/50 transition-all"
                        />
                    </div>

                    {(localError || error) && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                            {localError || error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-fuchsia-600 px-6 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-fuchsia-500 disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                        {isSaving ? 'Salvando...' : 'Adicionar Acesso'}
                    </button>
                </form>
            </section>

            {/* Lista de Colaboradores */}
            <section className="rounded-[24px] border border-white/10 bg-[#16082f] p-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Equipe de Notícias</h2>
                        <p className="text-sm text-slate-400">{collaborators.length} acessos ativos</p>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar..."
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#0F0521] pl-10 pr-4 text-xs text-white outline-none focus:border-fuchsia-500/20 transition-all sm:w-64"
                            />
                        </div>
                        <button
                            onClick={() => onRefresh()}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="grid gap-3">
                    {loading ? (
                        <div className="flex py-12 justify-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-fuchsia-500/50" />
                        </div>
                    ) : filteredCollaborators.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Users className="h-12 w-12 text-slate-700 mb-4" />
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Nenhum colaborador encontrado</p>
                        </div>
                    ) : (
                        filteredCollaborators.map((c) => (
                            <div key={c.id} className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] hover:border-white/10">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-400">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{c.name}</h3>
                                        <p className="text-sm text-slate-500">{c.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Remover acesso de ${c.name}?`)) {
                                                onDelete(c.id);
                                            }
                                        }}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default CollaboratorManager;
