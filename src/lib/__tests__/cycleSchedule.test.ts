import { describe, expect, it } from 'vitest';
import {
    WEEKLY_CYCLE_BREAK_MS,
    WEEKLY_CYCLE_DURATION_MS,
    getWeeklyCycleSnapshot
} from '../cycleSchedule';

describe('getWeeklyCycleSnapshot', () => {
    it('returns the active weekly cycle for a friday afternoon in Sao Paulo time', () => {
        const snapshot = getWeeklyCycleSnapshot('2026-03-13T18:00:00.000Z');

        expect(snapshot.isBreak).toBe(false);
        expect(snapshot.cycleStartAt).toBe('2026-03-08T15:00:00.000Z');
        expect(snapshot.cycleEndAt).toBe('2026-03-15T14:00:00.000Z');
        expect(snapshot.nextCycleStartAt).toBe('2026-03-15T15:00:00.000Z');
        expect(snapshot.durationMs).toBe(WEEKLY_CYCLE_DURATION_MS);
        expect(snapshot.breakDurationMs).toBe(WEEKLY_CYCLE_BREAK_MS);
    });

    it('returns break mode between sunday 11:00 and 12:00', () => {
        const snapshot = getWeeklyCycleSnapshot('2026-03-15T14:30:00.000Z');

        expect(snapshot.isBreak).toBe(true);
        expect(snapshot.cycleStartAt).toBe('2026-03-08T15:00:00.000Z');
        expect(snapshot.cycleEndAt).toBe('2026-03-15T14:00:00.000Z');
        expect(snapshot.nextCycleStartAt).toBe('2026-03-15T15:00:00.000Z');
    });

    it('starts a new cycle every sunday at 12:00', () => {
        const snapshot = getWeeklyCycleSnapshot('2026-03-15T15:05:00.000Z');

        expect(snapshot.isBreak).toBe(false);
        expect(snapshot.cycleStartAt).toBe('2026-03-15T15:00:00.000Z');
        expect(snapshot.cycleEndAt).toBe('2026-03-22T14:00:00.000Z');
        expect(snapshot.nextCycleStartAt).toBe('2026-03-22T15:00:00.000Z');
    });
});
