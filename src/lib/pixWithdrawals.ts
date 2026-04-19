export type PixWithdrawalStatus =
    | 'pending'
    | 'pending_manual_review'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

const OPEN_PIX_WITHDRAWAL_STATUSES = new Set<PixWithdrawalStatus>([
    'pending',
    'pending_manual_review',
    'processing'
]);

const STATUS_LABELS: Record<PixWithdrawalStatus, string> = {
    pending: 'Na fila',
    pending_manual_review: 'Em revisão manual',
    processing: 'Em processamento',
    completed: 'Concluído',
    failed: 'Falhou',
    cancelled: 'Cancelado'
};

export const normalizePixWithdrawalStatus = (value?: string | null): PixWithdrawalStatus | null => {
    if (!value) return null;

    const normalized = String(value).trim().toLowerCase();
    if (
        normalized === 'pending' ||
        normalized === 'pending_manual_review' ||
        normalized === 'processing' ||
        normalized === 'completed' ||
        normalized === 'failed' ||
        normalized === 'cancelled'
    ) {
        return normalized;
    }

    return null;
};

export const getPixWithdrawalStatusLabel = (value?: string | null) => {
    const normalized = normalizePixWithdrawalStatus(value);
    return normalized ? STATUS_LABELS[normalized] : 'Status indefinido';
};

export const isOpenPixWithdrawalStatus = (value?: string | null) => {
    const normalized = normalizePixWithdrawalStatus(value);
    return normalized ? OPEN_PIX_WITHDRAWAL_STATUSES.has(normalized) : false;
};

export const maskPixKey = (value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return 'Nao informado';
    if (raw.length <= 4) return `${'*'.repeat(Math.max(raw.length - 1, 0))}${raw.slice(-1)}`;

    const visiblePrefix = raw.slice(0, 2);
    const visibleSuffix = raw.slice(-2);
    return `${visiblePrefix}${'*'.repeat(Math.max(raw.length - 4, 2))}${visibleSuffix}`;
};
