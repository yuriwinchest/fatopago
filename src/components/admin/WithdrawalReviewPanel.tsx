import React, { useMemo, useState, useCallback } from 'react';
import {
    AlertTriangle,
    ArrowRightLeft,
    Banknote,
    CheckCircle2,
    Clock3,
    Copy,
    Eye,
    EyeOff,
    RefreshCw,
    ShieldBan,
    Wallet
} from 'lucide-react';
import { AdminPixWithdrawalRow } from '../../hooks/useAdminData';
import { formatBRL, formatDateTimeBR } from '../../utils/format';
import { getPixWithdrawalStatusLabel } from '../../lib/pixWithdrawals';

interface WithdrawalReviewPanelProps {
    withdrawals: AdminPixWithdrawalRow[];
    loading: boolean;
    error: string | null;
    resolvingId: string | null;
    onRefresh: () => Promise<void>;
    onApproveManualReview: (withdrawalId: string) => Promise<unknown>;
    onRejectManualReview: (withdrawalId: string, reason: string) => Promise<unknown>;
    onCompleteManually: (withdrawalId: string) => Promise<unknown>;
    onGetFullKey: (withdrawalId: string) => Promise<string | null>;
}

const MIN_REJECTION_REASON_LENGTH = 20;

const statusTone: Record<string, string> = {
    pending_manual_review: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    pending: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    processing: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
    completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    failed: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
    cancelled: 'border-slate-500/20 bg-slate-500/10 text-slate-200'
};

const WithdrawalReviewPanel: React.FC<WithdrawalReviewPanelProps> = ({
    withdrawals,
    loading,
    error,
    resolvingId,
    onRefresh,
    onApproveManualReview,
    onRejectManualReview,
    onCompleteManually,
    onGetFullKey
}) => {
    const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
    const [localMessage, setLocalMessage] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
    const [loadingKeyId, setLoadingKeyId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const metrics = useMemo(() => ({
        total: withdrawals.length,
        pendingReview: withdrawals.filter((withdrawal) => withdrawal.status === 'pending_manual_review').length,
        automaticQueue: withdrawals.filter((withdrawal) => withdrawal.status === 'pending').length,
        processing: withdrawals.filter((withdrawal) => withdrawal.status === 'processing').length,
        failed: withdrawals.filter((withdrawal) => withdrawal.status === 'failed').length,
        completed: withdrawals.filter((withdrawal) => withdrawal.status === 'completed').length
    }), [withdrawals]);

    const actionableCount = metrics.pendingReview + metrics.automaticQueue + metrics.processing;

    const handleRevealKey = useCallback(async (withdrawalId: string) => {
        if (revealedKeys[withdrawalId]) {
            setRevealedKeys((prev) => {
                const next = { ...prev };
                delete next[withdrawalId];
                return next;
            });
            return;
        }

        setLoadingKeyId(withdrawalId);
        try {
            const fullKey = await onGetFullKey(withdrawalId);
            if (fullKey) {
                setRevealedKeys((prev) => ({ ...prev, [withdrawalId]: fullKey }));
            } else {
                setLocalError('Nao foi possivel revelar a chave PIX.');
            }
        } catch {
            setLocalError('Erro ao buscar chave PIX completa.');
        } finally {
            setLoadingKeyId(null);
        }
    }, [revealedKeys, onGetFullKey]);

    const handleCopyKey = useCallback(async (withdrawalId: string, key: string) => {
        try {
            await navigator.clipboard.writeText(key);
            setCopiedId(withdrawalId);
            setTimeout(() => setCopiedId((current) => (current === withdrawalId ? null : current)), 2000);
        } catch {
            setLocalError('Nao foi possivel copiar para a area de transferencia.');
        }
    }, []);

    const handleCompleteManually = async (withdrawal: AdminPixWithdrawalRow) => {
        const confirmation = window.confirm(
            `CONFIRMAR: Voce JA transferiu ${formatBRL(withdrawal.amount)} via PIX para ${withdrawal.user_name} (${withdrawal.user_email})?\n\nEsta acao marca o saque como CONCLUIDO. So confirme se o PIX ja foi enviado pelo seu banco/app.`
        );
        if (!confirmation) return;

        setLocalError(null);
        setLocalMessage(null);

        try {
            await onCompleteManually(withdrawal.id);
            setLocalMessage(`Saque de ${formatBRL(withdrawal.amount)} para ${withdrawal.user_email} marcado como concluido.`);
        } catch (err: any) {
            setLocalError(err?.message || 'Nao foi possivel concluir o saque manualmente.');
        }
    };

    const handleApprove = async (withdrawal: AdminPixWithdrawalRow) => {
        const confirmation = window.confirm(
            `Liberar o saque de ${formatBRL(withdrawal.amount)} para ${withdrawal.user_email}?`
        );
        if (!confirmation) return;

        setLocalError(null);
        setLocalMessage(null);

        try {
            await onApproveManualReview(withdrawal.id);
            setLocalMessage('Saque liberado para o worker. O backend vai retomar a conciliacao automatica.');
        } catch (err: any) {
            setLocalError(err?.message || 'Nao foi possivel liberar o saque.');
        }
    };

    const handleReject = async (withdrawal: AdminPixWithdrawalRow) => {
        const note = String(decisionNotes[withdrawal.id] || '').trim();
        if (note.length < MIN_REJECTION_REASON_LENGTH) {
            setLocalError(`Informe uma justificativa com pelo menos ${MIN_REJECTION_REASON_LENGTH} caracteres para rejeitar o saque.`);
            return;
        }

        const confirmation = window.confirm(
            `Rejeitar o saque de ${formatBRL(withdrawal.amount)} e compensar o saldo do usuario?`
        );
        if (!confirmation) return;

        setLocalError(null);
        setLocalMessage(null);

        try {
            await onRejectManualReview(withdrawal.id, note);
            setDecisionNotes((prev) => ({
                ...prev,
                [withdrawal.id]: ''
            }));
            setLocalMessage('Saque rejeitado com compensacao registrada no ledger.');
        } catch (err: any) {
            setLocalError(err?.message || 'Nao foi possivel rejeitar o saque.');
        }
    };

    const isActionable = (status: string) =>
        status === 'pending_manual_review' ||
        status === 'pending' ||
        status === 'processing';

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] font-display ${actionableCount > 0 ? 'border-red-500/20 bg-red-500/10 text-red-300 animate-pulse' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'}`}>
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            {actionableCount > 0 ? `${actionableCount} saque${actionableCount > 1 ? 's' : ''} aguardando` : 'Conciliacao de saques'}
                        </div>
                        <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl font-display tracking-[0.08em] text-white uppercase">
                            Fila de Saques PIX
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                            Fonte de verdade do saque: status operacional, tentativas, retorno do provedor e revisao manual.
                        </p>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95 font-display"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar fila
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                        { label: 'Total', value: metrics.total, icon: Wallet, tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10' },
                        { label: 'Revisao Manual', value: metrics.pendingReview, icon: AlertTriangle, tone: metrics.pendingReview > 0 ? 'text-red-300 border-red-500/20 bg-red-500/10' : 'text-amber-300 border-amber-500/20 bg-amber-500/10' },
                        { label: 'Fila Automatica', value: metrics.automaticQueue, icon: Clock3, tone: 'text-slate-200 border-white/10 bg-white/5' },
                        { label: 'Processing', value: metrics.processing, icon: RefreshCw, tone: 'text-indigo-300 border-indigo-500/20 bg-indigo-500/10' },
                        { label: 'Falharam', value: metrics.failed, icon: ShieldBan, tone: 'text-rose-300 border-rose-500/20 bg-rose-500/10' }
                    ].map((metric) => (
                        <div key={metric.label} className={`rounded-2xl border p-4 ${metric.tone}`}>
                            <div className="flex items-center justify-between">
                                <metric.icon className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.28em]">{metric.label}</span>
                            </div>
                            <div className="mt-4 text-3xl font-black tracking-tight text-white font-display tabular-nums">
                                {metric.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {(error || localError || localMessage) && (
                <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${error || localError ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
                    {error || localError || localMessage}
                </div>
            )}

            {loading && withdrawals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#1A0B38] py-20">
                    <RefreshCw className="mb-4 h-10 w-10 animate-spin text-fuchsia-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando saques...</p>
                </div>
            ) : withdrawals.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-6 py-16 text-center">
                    <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-300" />
                    <p className="text-xl font-black uppercase tracking-[0.16em] text-white font-display">Nenhum saque na fila</p>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
                        O backend nao encontrou saques aguardando acompanhamento administrativo.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {withdrawals.map((withdrawal) => {
                        const note = decisionNotes[withdrawal.id] || '';
                        const isPendingReview = withdrawal.status === 'pending_manual_review';
                        const canComplete = isActionable(withdrawal.status);
                        const isResolving = resolvingId === withdrawal.id;
                        const revealedKey = revealedKeys[withdrawal.id];
                        const isLoadingKey = loadingKeyId === withdrawal.id;
                        const isCopied = copiedId === withdrawal.id;
                        const displayKey = revealedKey || withdrawal.pix_key_masked;

                        return (
                            <article
                                key={withdrawal.id}
                                className={`rounded-2xl border p-5 ${isPendingReview ? 'border-amber-500/20 bg-[#1A0B38]' : 'border-white/10 bg-[#160A32]'}`}
                            >
                                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] ${statusTone[withdrawal.status] || 'border-white/10 bg-white/5 text-slate-200'}`}>
                                                {getPixWithdrawalStatusLabel(withdrawal.status)}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                                                {withdrawal.pix_key_type}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                                                Tentativas: {withdrawal.payout_attempts}
                                            </span>
                                            {isPendingReview && (
                                                <span className="rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-red-300 animate-pulse">
                                                    Acao necessaria
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-2xl font-black uppercase tracking-[0.04em] text-white font-display">
                                                {formatBRL(withdrawal.amount)}
                                            </h3>
                                            <p className="mt-2 text-sm font-semibold text-slate-300">
                                                {withdrawal.user_name} {withdrawal.user_lastname || ''} - {withdrawal.user_email}
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Solicitado em</div>
                                                <div className="mt-2 text-sm font-bold text-slate-200">{formatDateTimeBR(withdrawal.created_at)}</div>
                                            </div>
                                            <div className={`rounded-2xl border px-4 py-3 ${canComplete ? 'border-fuchsia-500/20 bg-fuchsia-500/10' : 'border-white/10 bg-black/20'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className={`text-[9px] font-black uppercase tracking-[0.28em] ${canComplete ? 'text-fuchsia-300' : 'text-slate-500'}`}>
                                                        {revealedKey ? 'Chave PIX completa' : 'Chave mascarada'}
                                                    </div>
                                                    {canComplete && (
                                                        <div className="flex items-center gap-1">
                                                            {revealedKey && (
                                                                <button
                                                                    onClick={() => void handleCopyKey(withdrawal.id, revealedKey)}
                                                                    className="rounded-lg p-1 text-fuchsia-300 transition hover:bg-fuchsia-500/20"
                                                                    title="Copiar chave"
                                                                >
                                                                    <Copy className={`h-3.5 w-3.5 ${isCopied ? 'text-emerald-300' : ''}`} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => void handleRevealKey(withdrawal.id)}
                                                                disabled={isLoadingKey}
                                                                className="rounded-lg p-1 text-fuchsia-300 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
                                                                title={revealedKey ? 'Ocultar chave' : 'Revelar chave'}
                                                            >
                                                                {isLoadingKey ? (
                                                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                ) : revealedKey ? (
                                                                    <EyeOff className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`mt-2 text-sm font-bold ${revealedKey ? 'text-fuchsia-100 select-all' : 'text-slate-200'}`}>
                                                    {displayKey}
                                                    {isCopied && <span className="ml-2 text-[9px] font-bold text-emerald-300">Copiado!</span>}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Provider ID</div>
                                                <div className="mt-2 text-sm font-bold text-slate-200">{withdrawal.external_payout_id || 'Aguardando envio'}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Status externo</div>
                                                <div className="mt-2 text-sm font-bold text-slate-200">{withdrawal.external_status || 'Sem retorno ainda'}</div>
                                            </div>
                                        </div>

                                        {(withdrawal.review_reason || withdrawal.failed_reason) && (
                                            <div className="grid gap-3 xl:grid-cols-2">
                                                {withdrawal.review_reason && (
                                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300">Motivo da revisao</div>
                                                        <div className="mt-2 font-semibold">{withdrawal.review_reason}</div>
                                                    </div>
                                                )}
                                                {withdrawal.failed_reason && (
                                                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.28em] text-rose-300">Falha registrada</div>
                                                        <div className="mt-2 font-semibold">{withdrawal.failed_reason}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {canComplete && (
                                        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                                                {isPendingReview ? 'Decisao administrativa' : 'Acao manual'}
                                            </div>

                                            {/* Instrucoes para o admin */}
                                            <div className="mt-3 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/5 px-4 py-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Passo a passo</p>
                                                <ol className="mt-2 space-y-1 text-[12px] text-fuchsia-100/80">
                                                    <li>1. Clique no olho para revelar a chave PIX completa</li>
                                                    <li>2. Copie a chave e faca o PIX pelo seu banco/app</li>
                                                    <li>3. Apos confirmar o envio, clique em "Ja transferi"</li>
                                                </ol>
                                            </div>

                                            {isPendingReview && (
                                                <>
                                                    <textarea
                                                        value={note}
                                                        onChange={(event) => setDecisionNotes((prev) => ({
                                                            ...prev,
                                                            [withdrawal.id]: event.target.value
                                                        }))}
                                                        placeholder="Justifique aqui se precisar rejeitar o saque."
                                                        className="mt-4 min-h-[80px] w-full rounded-xl border border-white/10 bg-[#120a2a] px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-500/40"
                                                    />
                                                    <p className="mt-2 text-[11px] text-slate-500">
                                                        Para rejeitar, a justificativa precisa ter pelo menos {MIN_REJECTION_REASON_LENGTH} caracteres.
                                                    </p>
                                                </>
                                            )}

                                            <div className={`mt-4 grid gap-3 ${isPendingReview ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
                                                {/* Botao principal: Ja transferi manualmente */}
                                                <button
                                                    onClick={() => void handleCompleteManually(withdrawal)}
                                                    disabled={isResolving}
                                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {isResolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                                                    Ja transferi
                                                </button>

                                                {isPendingReview && (
                                                    <>
                                                        {/* Botao secundario: Liberar para worker automatico */}
                                                        <button
                                                            onClick={() => void handleApprove(withdrawal)}
                                                            disabled={isResolving}
                                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200 transition-all hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isResolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                            Liberar auto
                                                        </button>

                                                        {/* Rejeitar */}
                                                        <button
                                                            onClick={() => void handleReject(withdrawal)}
                                                            disabled={isResolving}
                                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 text-[10px] font-black uppercase tracking-[0.24em] text-rose-200 transition-all hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isResolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldBan className="h-4 w-4" />}
                                                            Rejeitar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WithdrawalReviewPanel;
