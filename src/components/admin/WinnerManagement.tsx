import React from 'react';
import { Trophy, Download, RefreshCw, Search, Mail, Copy, Phone, ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import { copyToClipboard } from '../../utils/format';
import { CycleWinnerRow } from '../../hooks/useAdminData';
import { WinnerFollowupFields, WinnerFollowupHistoryItem, WinnerFollowupSort } from '../../lib/winnerFollowups';

interface WinnerManagementProps {
    winners: CycleWinnerRow[];
    loading: boolean;
    onRefresh: () => Promise<void>;
    filterOptions: { id: string, label: string, count: number }[];
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    sortOrder: WinnerFollowupSort;
    setSortOrder: (v: any) => void;
    drafts: Record<number, WinnerFollowupFields>;
    onUpdateDraft: (cycle: number, data: any) => void;
    onSaveFollowup: (winner: CycleWinnerRow) => Promise<void>;
    isSaving: number | null;
    historyByCycle: Record<number, WinnerFollowupHistoryItem[]>;
    profiles: Map<string, any>;
}

const WinnerManagement: React.FC<WinnerManagementProps> = ({
    winners,
    loading,
    onRefresh,
    filterOptions,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    drafts,
    onUpdateDraft,
    onSaveFollowup,
    isSaving
}) => {
    const handleExport = () => {
        alert('Funcionalidade de exportação CSV será implementada em breve.');
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-3xl font-extrabold sm:text-4xl font-display tracking-[0.1em] text-glow-amber uppercase text-amber-400">Hall da Fama</h2>
                        <p className="mt-2 text-slate-400 max-w-2xl text-sm uppercase tracking-wider font-bold">
                            Gestão de vencedores e provas sociais dos ciclos de validação.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleExport}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 text-[10px] font-black uppercase tracking-widest text-cyan-400 transition-all hover:bg-cyan-500/20 active:scale-95 font-display"
                        >
                            <Download className="h-4 w-4" />
                            Exportar CSV
                        </button>
                        <button
                            onClick={onRefresh}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95 font-display"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-6">
                    <div className="flex flex-wrap gap-2">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setStatusFilter(opt.id)}
                                className={`h-10 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest transition-all font-display ${statusFilter === opt.id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                            >
                                {opt.label} ({opt.count})
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-amber-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nome, e-mail ou telefone..."
                            className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 pl-12 pr-4 text-sm text-white placeholder:text-slate-700 focus:border-amber-400/40 focus:outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 admin-glass-card border-dashed">
                    <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando Ranking Histórico...</p>
                </div>
            ) : winners.length === 0 ? (
                <div className="py-20 text-center admin-glass-card border-dashed">
                    <Trophy className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Nenhum vencedor encontrado</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {winners.map((winner) => {
                        const cycleKey = winner.cycle_number;
                        const draft = drafts[cycleKey] || {
                            contacted: winner.contacted,
                            prize_paid: winner.prize_paid,
                            image_received: winner.image_received,
                            notes: winner.notes || ''
                        };

                        const isContacted = draft.contacted;
                        const isPaid = draft.prize_paid;
                        const isImageRec = draft.image_received;
                        const currentNotes = draft.notes;
                        
                        const hasChanges = JSON.stringify(draft) !== JSON.stringify({
                            contacted: winner.contacted,
                            prize_paid: winner.prize_paid,
                            image_received: winner.image_received,
                            notes: winner.notes || ''
                        });

                        return (
                            <div key={cycleKey} className="admin-glass-card p-6 flex flex-col gap-6 group hover:border-amber-500/30 transition-all duration-300">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-amber-500/20 text-amber-200 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest font-display">Ciclo #{winner.cycle_number}</span>
                                            {isPaid ? (
                                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest font-display flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> Pago
                                                </span>
                                            ) : (
                                                <span className="bg-slate-500/20 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest font-display flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Pendente
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-black text-white uppercase font-display">
                                            {winner.winner_name} {winner.winner_lastname}
                                        </h3>
                                        <div className="mt-2 flex flex-col gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {winner.winner_email || '—'}</div>
                                            <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {winner.winner_phone || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-amber-500 font-display tabular-nums leading-none tracking-tighter">{winner.validations_count}</div>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Validações</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'contacted', label: 'Contato', state: isContacted },
                                        { id: 'prize_paid', label: 'Pago', state: isPaid },
                                        { id: 'image_received', label: 'Prova', state: isImageRec }
                                    ].map(check => (
                                        <button
                                            key={check.id}
                                            onClick={() => onUpdateDraft(winner.cycle_number, { [check.id]: !check.state })}
                                            className={`h-11 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${check.state ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-600 grayscale hover:grayscale-0'}`}
                                            title={check.label}
                                        >
                                            <span className="text-[8px] font-black uppercase tracking-widest">{check.label}</span>
                                            {check.state ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 font-display">Notas de Acompanhamento</label>
                                    <textarea
                                        value={currentNotes}
                                        onChange={(e) => onUpdateDraft(winner.cycle_number, { notes: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 placeholder:text-slate-800 focus:border-amber-500/30 focus:outline-none min-h-[80px] resize-none"
                                        placeholder="Ex: Pagamento via PIX realizado. Aguardando foto..."
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => void copyToClipboard(String(winner.winner_user_id))}
                                            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-500 hover:text-white transition-all"
                                            title="Copiar ID"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        {winner.winner_phone && (
                                            <a
                                                href={`https://wa.me/${winner.winner_phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                                                title="WhatsApp"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                    <button
                                        disabled={!hasChanges || isSaving === winner.cycle_number}
                                        onClick={() => onSaveFollowup(winner)}
                                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest transition-all ${hasChanges ? 'bg-white text-black shadow-lg shadow-white/10 hover:bg-slate-200' : 'bg-white/5 text-slate-600 opacity-50 cursor-not-allowed'}`}
                                        title="Salvar Alterações"
                                    >
                                        {isSaving === winner.cycle_number ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                        Salvar Alterações
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WinnerManagement;
