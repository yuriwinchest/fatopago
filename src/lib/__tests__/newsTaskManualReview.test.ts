import { describe, expect, it } from 'vitest';
import {
    buildManualReviewMetrics,
    getManualReviewReasonDescription,
    getManualReviewReasonLabel,
    getManualReviewWinningRatio,
    ManualReviewTaskRow
} from '../newsTaskManualReview';

const buildTask = (overrides: Partial<ManualReviewTaskRow> = {}): ManualReviewTaskRow => ({
    id: 'task-1',
    created_at: '2026-04-01T10:00:00.000Z',
    cycle_start_at: '2026-03-29T12:00:00.000Z',
    cycle_number: 4,
    title: 'Notícia em revisão',
    category: 'Política',
    source: 'Admin',
    reward_cents: 6000,
    settlement_total_votes: 8,
    settlement_true_votes: 3,
    settlement_false_votes: 5,
    settlement_eligible_vote_count: 4,
    settlement_quarantined_vote_count: 4,
    settlement_true_weight: 35,
    settlement_false_weight: 65,
    settlement_total_weight: 100,
    settlement_threshold_ratio: 0.7,
    settlement_min_reputation: 20,
    settlement_review_reason: 'weighted_threshold_not_met',
    consensus_closed_at: '2026-04-01T11:00:00.000Z',
    ...overrides
});

describe('newsTaskManualReview', () => {
    it('mapeia labels e descrições conhecidas', () => {
        expect(getManualReviewReasonLabel('weighted_tie')).toBe('Empate ponderado');
        expect(getManualReviewReasonDescription('pending_min_votes')).toContain('número mínimo bruto de votos');
    });

    it('retorna fallback para motivos desconhecidos', () => {
        expect(getManualReviewReasonLabel('motivo-inexistente')).toBe('Revisão administrativa');
        expect(getManualReviewReasonDescription(null)).toContain('decisão administrativa');
    });

    it('calcula a razão ponderada vencedora corretamente', () => {
        expect(getManualReviewWinningRatio(buildTask())).toBe(0.65);
        expect(getManualReviewWinningRatio(buildTask({ settlement_total_weight: 0 }))).toBe(0);
    });

    it('agrega métricas da fila de revisão manual', () => {
        const metrics = buildManualReviewMetrics([
            buildTask(),
            buildTask({
                id: 'task-2',
                reward_cents: 12000,
                settlement_eligible_vote_count: 6,
                settlement_quarantined_vote_count: 2,
                settlement_review_reason: 'weighted_tie'
            })
        ]);

        expect(metrics.total).toBe(2);
        expect(metrics.totalRewardCents).toBe(18000);
        expect(metrics.eligibleVotes).toBe(10);
        expect(metrics.quarantinedVotes).toBe(6);
        expect(metrics.reasonCounts.weighted_threshold_not_met).toBe(1);
        expect(metrics.reasonCounts.weighted_tie).toBe(1);
    });
});
