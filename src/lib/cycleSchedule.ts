export const SAO_PAULO_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;
export const WEEKLY_CYCLE_DURATION_MS = ((6 * 24) + 23) * 60 * 60 * 1000;
export const WEEKLY_CYCLE_BREAK_MS = 60 * 60 * 1000;
export const WEEKLY_CYCLE_TOTAL_MS = WEEKLY_CYCLE_DURATION_MS + WEEKLY_CYCLE_BREAK_MS;
export const WEEKLY_CYCLE_ANCHOR_ISO = '2026-03-08T15:00:00.000Z';
export const WEEKLY_WINNER_PRIZE_BRL = 6000;

export interface WeeklyCycleSnapshot {
    cycleStartAt: string;
    cycleEndAt: string;
    nextCycleStartAt: string;
    isBreak: boolean;
    durationMs: number;
    breakDurationMs: number;
}

function toTimestamp(input: Date | string | number = new Date()): number {
    if (input instanceof Date) return input.getTime();
    if (typeof input === 'number') return input;

    const parsed = new Date(input).getTime();
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid date input: ${String(input)}`);
    }
    return parsed;
}

function toIsoString(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

export function getWeeklyCycleSnapshot(input: Date | string | number = new Date()): WeeklyCycleSnapshot {
    const nowMs = toTimestamp(input);
    const anchorMs = Date.parse(WEEKLY_CYCLE_ANCHOR_ISO);
    const cycleIndex = Math.max(0, Math.floor((nowMs - anchorMs) / WEEKLY_CYCLE_TOTAL_MS));

    const cycleStartMs = anchorMs + (cycleIndex * WEEKLY_CYCLE_TOTAL_MS);
    const cycleEndMs = cycleStartMs + WEEKLY_CYCLE_DURATION_MS;
    const nextCycleStartMs = cycleStartMs + WEEKLY_CYCLE_TOTAL_MS;

    return {
        cycleStartAt: toIsoString(cycleStartMs),
        cycleEndAt: toIsoString(cycleEndMs),
        nextCycleStartAt: toIsoString(nextCycleStartMs),
        isBreak: nowMs >= cycleEndMs && nowMs < nextCycleStartMs,
        durationMs: WEEKLY_CYCLE_DURATION_MS,
        breakDurationMs: WEEKLY_CYCLE_BREAK_MS
    };
}

export function getStartOfSaoPauloDay(input: Date | string | number = new Date()): number {
    const utcMs = toTimestamp(input);
    const local = new Date(utcMs + SAO_PAULO_UTC_OFFSET_MS);
    const localDayStartMs = Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
        0,
        0,
        0,
        0
    );

    return localDayStartMs - SAO_PAULO_UTC_OFFSET_MS;
}

export function getStartOfSaoPauloMonth(input: Date | string | number = new Date()): number {
    const utcMs = toTimestamp(input);
    const local = new Date(utcMs + SAO_PAULO_UTC_OFFSET_MS);
    const localMonthStartMs = Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        1,
        0,
        0,
        0,
        0
    );

    return localMonthStartMs - SAO_PAULO_UTC_OFFSET_MS;
}
