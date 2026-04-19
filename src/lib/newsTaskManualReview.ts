export type ManualReviewTaskRow = {
    id: string;
    created_at: string;
    cycle_start_at: string | null;
    cycle_number: number | null;
    title: string | null;
    category: string | null;
    source: string | null;
    reward_cents: number | null;
    settlement_total_votes: number | null;
    settlement_true_votes: number | null;
    settlement_false_votes: number | null;
    settlement_eligible_vote_count: number | null;
    settlement_quarantined_vote_count: number | null;
    settlement_true_weight: number | null;
    settlement_false_weight: number | null;
    settlement_total_weight: number | null;
    settlement_threshold_ratio: number | null;
    settlement_min_reputation: number | null;
    settlement_review_reason: string | null;
    consensus_closed_at: string | null;
};

export type ManualReviewVoteRow = {
    validation_id: string;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    plan_purchase_id: string | null;
    verdict: boolean;
    validation_cost: number | null;
    reputation_score_snapshot: number | null;
    eligible_for_consensus: boolean;
    validation_created_at: string;
    justification: string | null;
    proof_link: string | null;
    proof_image_url: string | null;
};

export interface ManualReviewMetrics {
    total: number;
    totalRewardCents: number;
    eligibleVotes: number;
    quarantinedVotes: number;
    reasonCounts: Record<string, number>;
}

export const MANUAL_REVIEW_REASON_LABELS: Record<string, string> = {
    pending_min_votes: 'Sem votos mínimos',
    insufficient_weight_quorum: 'Sem quórum ponderado',
    weighted_tie: 'Empate ponderado',
    weighted_threshold_not_met: 'Margem ponderada insuficiente'
};

export const MANUAL_REVIEW_REASON_DESCRIPTIONS: Record<string, string> = {
    pending_min_votes: 'A tarefa encerrou a janela sem atingir o número mínimo bruto de votos.',
    insufficient_weight_quorum: 'Houve votos, mas faltou peso reputacional elegível para liquidação automática.',
    weighted_tie: 'Os lados ficaram empatados no peso reputacional considerado confiável.',
    weighted_threshold_not_met: 'Houve vencedor ponderado, mas abaixo da margem mínima de segurança para liquidação automática.'
};

const toNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const getManualReviewReasonLabel = (reason?: string | null) =>
    (reason && MANUAL_REVIEW_REASON_LABELS[reason]) || 'Revisão administrativa';

export const getManualReviewReasonDescription = (reason?: string | null) =>
    (reason && MANUAL_REVIEW_REASON_DESCRIPTIONS[reason]) || 'A tarefa precisa de decisão administrativa antes de distribuir recompensa.';

export const getManualReviewWinningRatio = (task: Pick<ManualReviewTaskRow, 'settlement_true_weight' | 'settlement_false_weight' | 'settlement_total_weight'>) => {
    const trueWeight = toNumber(task.settlement_true_weight);
    const falseWeight = toNumber(task.settlement_false_weight);
    const totalWeight = toNumber(task.settlement_total_weight);

    if (totalWeight <= 0) return 0;
    return Math.max(trueWeight, falseWeight) / totalWeight;
};

export const buildManualReviewMetrics = (tasks: ManualReviewTaskRow[]): ManualReviewMetrics => {
    return tasks.reduce(
        (acc, task) => {
            const reason = task.settlement_review_reason || 'unknown';

            acc.total += 1;
            acc.totalRewardCents += Math.max(toNumber(task.reward_cents), 0);
            acc.eligibleVotes += toNumber(task.settlement_eligible_vote_count);
            acc.quarantinedVotes += toNumber(task.settlement_quarantined_vote_count);
            acc.reasonCounts[reason] = (acc.reasonCounts[reason] || 0) + 1;

            return acc;
        },
        {
            total: 0,
            totalRewardCents: 0,
            eligibleVotes: 0,
            quarantinedVotes: 0,
            reasonCounts: {} as Record<string, number>
        }
    );
};
