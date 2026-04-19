import React, { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    Clock,
    RefreshCw,
    Scale,
    ShieldBan,
    XCircle,
    Search,
    ChevronLeft,
    ChevronRight,
    ShieldAlert,
    Gavel,
    Clock3,
    AlertTriangle,
    Users
} from 'lucide-react';
import { formatBRL, toNumber } from '../../utils/format';
import {
    buildManualReviewMetrics,
    getManualReviewReasonLabel,
    getManualReviewWinningRatio,
    ManualReviewTaskRow,
    ManualReviewVoteRow
} from '../../lib/newsTaskManualReview';

interface ManualReviewQueuePanelProps {
    tasks: ManualReviewTaskRow[];
    loading: boolean;
    onRefresh: () => Promise<void>;
    votesByTask: Record<string, ManualReviewVoteRow[]>;
    fetchVotes: (taskId: string, options?: { force?: boolean }) => Promise<ManualReviewVoteRow[]>;
    settlingTaskId: string | null;
    onForceSettle: (taskId: string, correctVerdict: boolean, resolutionNote?: string) => Promise<any>;
    onVoidTask: (taskId: string, resolutionNote?: string) => Promise<any>;
    bulkLoading: boolean;
    onBulkSettle: (taskIds: string[], correctVerdict: boolean, resolutionNote?: string) => Promise<any>;
    onBulkVoid: (taskIds: string[], resolutionNote?: string) => Promise<any>;
}

const verdictLabel = (value: boolean) => (value ? 'Verdadeiro' : 'Falso');
const MIN_VOID_NOTE_LENGTH = 20;

const ManualReviewQueuePanel: React.FC<ManualReviewQueuePanelProps> = ({
    tasks,
    loading,
    onRefresh,
    votesByTask,
    fetchVotes,
    settlingTaskId,
    onForceSettle,
    onVoidTask,
    bulkLoading,
    onBulkSettle,
    onBulkVoid
}) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');
    const [localMessage, setLocalMessage] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    const pageSize = 20;

    useEffect(() => {
        if (tasks.length === 0) {
            setSelectedTaskId(null);
        }
    }, [tasks]);

    useEffect(() => {
        if (!selectedTaskId) return;
        void fetchVotes(selectedTaskId).catch(() => undefined);
    }, [selectedTaskId, fetchVotes]);

    const handleBulkOperation = async (type: 'true' | 'false' | 'void') => {
        if (tasks.length === 0) return;

        const count = tasks.length;
        const labels: Record<string, string> = {
            true: 'como VERDADEIRAS',
            false: 'como FALSAS',
            void: 'como ANULADAS'
        };

        const confirmation = window.confirm(
            `ATENÇÃO: Você está prestes a processar ${count} notícias de uma vez ${labels[type]}.\n\nDeseja continuar com a operação em massa?`
        );

        if (!confirmation) return;

        setLocalMessage(null);
        setLocalError(null);

        try {
            const taskIds = tasks.map(t => t.id);
            if (type === 'void') {
                await onBulkVoid(taskIds, 'Processamento administrativo em massa.');
                setLocalMessage(`${count} notícias foram anuladas e os usuários compensados.`);
            } else {
                const verdict = type === 'true';
                await onBulkSettle(taskIds, verdict, 'Liquidação administrativa em massa.');
                setLocalMessage(`${count} notícias foram liquidadas como ${verdictLabel(verdict).toLowerCase()}.`);
            }
            setSelectedTaskId(null);
            setCurrentPage(1);
        } catch (err: any) {
            setLocalError(err?.message || 'Erro ao realizar processamento em massa.');
        }
    };

    const filteredTasks = tasks.filter(t => 
        !search || 
        t.title?.toLowerCase().includes(search.toLowerCase()) || 
        t.id.includes(search)
    );

    const totalPages = Math.ceil(filteredTasks.length / pageSize);
    const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;
    const selectedVotes = selectedTaskId ? (votesByTask[selectedTaskId] || []) : [];
    const metrics = useMemo(() => buildManualReviewMetrics(tasks), [tasks]);
    
    const resolutionNote = selectedTaskId ? (resolutionNotes[selectedTaskId] || '') : '';
    const isResolvingSelectedTask = settlingTaskId === selectedTaskId;

    const handleSettle = async (correctVerdict: boolean) => {
        if (!selectedTask) return;

        const confirmation = window.confirm(
            `Confirmar liquidação manual da notícia "${selectedTask.title || 'Sem título'}" como ${verdictLabel(correctVerdict).toLowerCase()}?`
        );

        if (!confirmation) return;

        setLocalMessage(null);
        setLocalError(null);

        try {
            const result = await onForceSettle(selectedTask.id, correctVerdict, resolutionNote);
            setLocalMessage(
                `Liquidação manual concluída. Vencedores elegíveis: ${toNumber(result?.winner_count)}. Valor distribuído: ${formatBRL(toNumber(result?.distributed_cents) / 100)}.`
            );
            setResolutionNotes((prev) => ({
                ...prev,
                [selectedTask.id]: ''
            }));
            setSelectedTaskId(null);
        } catch (err: any) {
            setLocalError(err?.message || 'Não foi possível concluir a liquidação manual.');
        }
    };

    const handleVoidTask = async () => {
        if (!selectedTask) return;

        const note = resolutionNote.trim();
        if (note.length < MIN_VOID_NOTE_LENGTH) {
            setLocalError(`Para anular a tarefa, informe uma justificativa administrativa com pelo menos ${MIN_VOID_NOTE_LENGTH} caracteres.`);
            return;
        }

        const confirmation = window.confirm(
            `Confirmar a anulação da notícia "${selectedTask.title || 'Sem título'}" e emitir crédito compensatório para os usuários afetados?`
        );

        if (!confirmation) return;

        setLocalMessage(null);
        setLocalError(null);

        try {
            const result = await onVoidTask(selectedTask.id, note);
            setLocalMessage(
                `Tarefa anulada. Usuários compensados: ${toNumber(result?.compensated_users)}. Crédito total emitido: ${formatBRL(toNumber(result?.compensated_credit))}.`
            );
            setResolutionNotes((prev) => ({
                ...prev,
                [selectedTask.id]: ''
            }));
            setSelectedTaskId(null);
        } catch (err: any) {
            setLocalError(err?.message || 'Não foi possível anular a tarefa.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-8">
                {!selectedTask ? (
                    <>
                        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight font-display">
                                    Fila de Revisão Manual
                                </h2>
                                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-400">
                                    {tasks.length} {tasks.length === 1 ? 'notícia aguardando' : 'notícias aguardando'} decisão administrativa
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5">
                                    <button
                                        onClick={() => void handleBulkOperation('true')}
                                        disabled={bulkLoading || loading || tasks.length === 0}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 text-[9px] font-black uppercase tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-30"
                                        title="Liquidar todas como Verdadeiro"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Tudo V
                                    </button>
                                    <button
                                        onClick={() => void handleBulkOperation('false')}
                                        disabled={bulkLoading || loading || tasks.length === 0}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-500/10 px-4 text-[9px] font-black uppercase tracking-widest text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-30"
                                        title="Liquidar todas como Falso"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Tudo F
                                    </button>
                                    <button
                                        onClick={() => void handleBulkOperation('void')}
                                        disabled={bulkLoading || loading || tasks.length === 0}
                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-500/10 px-4 text-[9px] font-black uppercase tracking-widest text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-30"
                                        title="Anular todas e compensar"
                                    >
                                        <ShieldBan className="h-3.5 w-3.5" />
                                        Anular Tudo
                                    </button>
                                </div>

                                <button
                                    onClick={onRefresh}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95 font-display"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading || bulkLoading ? 'animate-spin' : ''}`} />
                                    Atualizar fila
                                </button>
                            </div>
                        </div>

                        <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
                            {[
                                { label: 'Em revisão', value: metrics.total, icon: Gavel, tone: 'text-amber-300 border-amber-500/20 bg-amber-500/10' },
                                { label: 'Peso elegível', value: metrics.eligibleVotes, icon: Users, tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10' },
                                { label: 'Quarentena', value: metrics.quarantinedVotes, icon: ShieldBan, tone: 'text-purple-300 border-purple-500/20 bg-purple-500/10' },
                                { label: 'Empates', value: metrics.reasonCounts.weighted_tie || 0, icon: AlertTriangle, tone: 'text-orange-300 border-orange-500/20 bg-orange-500/10' },
                                { label: 'Prêmio acumulado', value: formatBRL(metrics.totalRewardCents / 100), icon: Clock3, tone: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' }
                            ].map((metric) => (
                                <div key={metric.label} className={`rounded-2xl border p-4 ${metric.tone}`}>
                                    <div className="flex items-center justify-between">
                                        <metric.icon className="h-4 w-4 shrink-0" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{metric.label}</span>
                                    </div>
                                    <div className="mt-4 text-xl font-black tabular-nums">{metric.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mb-8 relative group">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Filtrar por título ou ID..."
                                className="w-full h-14 rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-sm text-white placeholder-slate-600 transition-all focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500"
                            />
                            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 group-focus-within:text-fuchsia-500 transition-colors" />
                        </div>
                    </>
                ) : (
                    <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <button
                            onClick={() => setSelectedTaskId(null)}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/5 pl-4 pr-6 text-[10px] font-black uppercase tracking-widest text-fuchsia-400 transition-all hover:bg-white/10"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Voltar para fila
                        </button>
                        <div className="text-right">
                            <h3 className="line-clamp-1 text-sm font-black uppercase tracking-tight text-white max-w-lg">
                                {selectedTask.title || 'Sem título'}
                            </h3>
                            <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                ID: {selectedTask.id}
                            </p>
                        </div>
                    </div>
                )}

                {(localMessage || localError) && (
                    <div className={`mb-10 flex items-center gap-3 rounded-xl border p-4 ${localError ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
                        {localError ? <ShieldAlert className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                        <p className="text-[11px] font-bold uppercase tracking-wider">{localError || localMessage}</p>
                    </div>
                )}

                {!selectedTask ? (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {paginatedTasks.map((task) => {
                                const winningRatio = getManualReviewWinningRatio(task);
                                return (
                                    <button
                                        key={task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-left transition-all hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.03] hover:translate-y-[-2px]"
                                    >
                                        <div className="mb-4 flex items-start justify-between">
                                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-400 group-hover:bg-fuchsia-500/20 transition-colors">
                                                <Clock className="h-5 w-5" />
                                            </div>
                                            <div className="rounded-lg bg-black/20 px-2 py-1 text-[9px] font-black text-slate-400">
                                                Margem: {(winningRatio * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        <h4 className="line-clamp-2 min-h-[2.5rem] text-sm font-black uppercase tracking-tight text-white group-hover:text-fuchsia-300 transition-colors">
                                            {task.title || 'Sem título'}
                                        </h4>
                                        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                            <span className="text-[9px] font-black uppercase text-slate-500">
                                                ID: {task.id.slice(0, 8)}
                                            </span>
                                            <span className="text-[9px] font-black uppercase text-fuchsia-400/80">
                                                {toNumber(task.settlement_total_votes)} VOTOS
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {filteredTasks.length === 0 && !loading && (
                            <div className="py-20 text-center">
                                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-slate-700">
                                    <Scale className="h-10 w-10" />
                                </div>
                                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
                                    Nenhuma tarefa encontrada.
                                </p>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="mt-10 flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    title="Página Anterior"
                                    aria-label="Página Anterior"
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-500">
                                    Pág {currentPage} {`//`} {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    title="Próxima Página"
                                    aria-label="Próxima Página"
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
                            <div className="space-y-6">
                                <div className="rounded-2xl border border-white/5 bg-black/40 p-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-fuchsia-400 mb-6">
                                        Snapshot dos Votos
                                    </h4>
                                    <div className="space-y-4">
                                        {selectedVotes.map((vote) => (
                                            <div key={vote.validation_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-black text-white">{vote.user_name}</span>
                                                    <span className={`rounded px-2 py-0.5 text-[9px] font-black ${vote.verdict ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {verdictLabel(vote.verdict)}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                    "{vote.justification || 'Nenhuma justificativa.'}"
                                                </p>
                                                {(vote.proof_link || vote.proof_image_url) && (
                                                    <div className="mt-3 space-y-2">
                                                        {vote.proof_image_url && (
                                                            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                                                                <img
                                                                    src={vote.proof_image_url}
                                                                    alt="Foto da prova enviada pelo usuário"
                                                                    className="max-h-56 w-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            </div>
                                                        )}
                                                        {vote.proof_link && (
                                                            <a
                                                                href={vote.proof_link}
                                                                target="_blank"
                                                                rel="noreferrer noopener"
                                                                className="inline-flex text-[10px] font-black uppercase tracking-widest text-fuchsia-400 hover:text-fuchsia-300"
                                                            >
                                                                Abrir link da prova
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {selectedVotes.length === 0 && (
                                            <div className="py-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Carregando histórico de votos...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-fuchsia-400 mb-6">
                                        Nota de Auditoria
                                    </h4>
                                    <textarea
                                        value={resolutionNote}
                                        onChange={(e) => {
                                            if (!selectedTaskId) return;
                                            setResolutionNotes(prev => ({ ...prev, [selectedTaskId]: e.target.value }));
                                        }}
                                        placeholder="Descreva o motivo da sua decisão..."
                                        className="w-full h-40 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white placeholder-slate-700 focus:border-fuchsia-500/50 outline-none transition-all"
                                    />
                                    
                                    <div className="mt-6 space-y-3">
                                        <button
                                            onClick={() => void handleSettle(true)}
                                            disabled={isResolvingSelectedTask}
                                            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-emerald-500 text-[11px] font-black uppercase tracking-widest text-white hover:bg-emerald-600 transition-all disabled:opacity-50"
                                        >
                                            {isResolvingSelectedTask ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                            Fechar como Verdadeiro
                                        </button>
                                        <button
                                            onClick={() => void handleSettle(false)}
                                            disabled={isResolvingSelectedTask}
                                            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-rose-500 text-[11px] font-black uppercase tracking-widest text-white hover:bg-rose-600 transition-all disabled:opacity-50"
                                        >
                                            {isResolvingSelectedTask ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                            Fechar como Falso
                                        </button>
                                        <button
                                            onClick={() => void handleVoidTask()}
                                            disabled={isResolvingSelectedTask}
                                            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-[11px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                        >
                                            <ShieldBan className="h-4 w-4" />
                                            Anular Tarefa
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                                        Detalhes da Tarefa
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Motivo:</span>
                                            <span className="text-[10px] font-black text-white uppercase">{getManualReviewReasonLabel(selectedTask.settlement_review_reason)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Votos Totais:</span>
                                            <span className="text-[10px] font-black text-white">{toNumber(selectedTask.settlement_total_votes)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Prêmio:</span>
                                            <span className="text-[10px] font-black text-emerald-400">{formatBRL(toNumber(selectedTask.reward_cents) / 100)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualReviewQueuePanel;
