export interface WinnerFollowupFields {
    contacted: boolean;
    prize_paid: boolean;
    image_received: boolean;
    notes: string;
}

export interface WinnerFollowupSource extends Omit<Partial<WinnerFollowupFields>, 'notes'> {
    cycle_number?: number;
    notes?: string | null;
}

export interface WinnerFollowupListItem extends WinnerFollowupSource {
    cycle_offset?: number;
    winner_user_id?: string | null;
    is_active?: boolean;
    cycle_start_at?: string | null;
    cycle_end_at?: string | null;
    last_validation_at?: string | null;
    validations_count?: number | string | null;
    followup_updated_at?: string | null;
    winner_name?: string | null;
    winner_lastname?: string | null;
    winner_email?: string | null;
    winner_phone?: string | null;
    winner_city?: string | null;
    winner_state?: string | null;
}

export type WinnerFollowupFilter = 'all' | 'needs_contact' | 'needs_prize' | 'needs_image';
export type WinnerFollowupSort = 'latest' | 'urgent' | 'oldest';

export interface WinnerFollowupHistoryItem extends WinnerFollowupListItem {
    id?: number | string;
    created_at?: string | null;
}

export const getWinnerFollowupDraft = (source?: WinnerFollowupSource | null): WinnerFollowupFields => ({
    contacted: Boolean(source?.contacted),
    prize_paid: Boolean(source?.prize_paid),
    image_received: Boolean(source?.image_received),
    notes: String(source?.notes || '')
});

export const buildWinnerFollowupDraftMap = (
    rows: WinnerFollowupSource[] = []
): Record<number, WinnerFollowupFields> => (
    rows.reduce<Record<number, WinnerFollowupFields>>((acc, row) => {
        const cycleNumber = Number(row?.cycle_number || 0);
        if (cycleNumber > 0) {
            acc[cycleNumber] = getWinnerFollowupDraft(row);
        }
        return acc;
    }, {})
);

export const matchesWinnerFollowupFilter = <T extends WinnerFollowupListItem>(
    row: T,
    draft: WinnerFollowupFields,
    filter: WinnerFollowupFilter
) => {
    if (filter === 'all') return true;
    if (!row.winner_user_id) return false;

    if (filter === 'needs_contact') return !draft.contacted;
    if (filter === 'needs_prize') return !draft.prize_paid;
    if (filter === 'needs_image') return !draft.image_received;

    return true;
};

export const filterWinnerFollowups = <T extends WinnerFollowupListItem>(
    rows: T[] = [],
    drafts: Record<number, WinnerFollowupFields>,
    filter: WinnerFollowupFilter
) => rows.filter((row) => {
    const cycleNumber = Number(row.cycle_number || 0);
    const draft = drafts[cycleNumber] || getWinnerFollowupDraft(row);
    return matchesWinnerFollowupFilter(row, draft, filter);
});

export const countWinnerFollowupsByFilter = <T extends WinnerFollowupListItem>(
    rows: T[] = [],
    drafts: Record<number, WinnerFollowupFields>,
    filter: WinnerFollowupFilter
) => filterWinnerFollowups(rows, drafts, filter).length;

const normalizeText = (value?: string | null) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
);

const toTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const getWinnerPendingCount = (row: WinnerFollowupListItem, draft: WinnerFollowupFields) => {
    if (!row.winner_user_id) return 0;
    let pendingCount = 0;
    if (!draft.contacted) pendingCount += 1;
    if (!draft.prize_paid) pendingCount += 1;
    if (!draft.image_received) pendingCount += 1;
    return pendingCount;
};

export const matchesWinnerFollowupSearch = (
    row: WinnerFollowupListItem,
    searchTerm: string
) => {
    const normalizedSearch = normalizeText(searchTerm);
    if (!normalizedSearch) return true;

    const phoneDigits = String(row.winner_phone || '').replace(/\D/g, '');
    const searchDigits = String(searchTerm || '').replace(/\D/g, '');
    if (searchDigits && phoneDigits.includes(searchDigits)) return true;

    const haystack = normalizeText([
        row.winner_name,
        row.winner_lastname,
        row.winner_email,
        row.winner_phone,
        row.winner_city,
        row.winner_state
    ].filter(Boolean).join(' '));

    return haystack.includes(normalizedSearch);
};

export const searchWinnerFollowups = <T extends WinnerFollowupListItem>(
    rows: T[] = [],
    searchTerm: string
) => rows.filter((row) => matchesWinnerFollowupSearch(row, searchTerm));

export const sortWinnerFollowups = <T extends WinnerFollowupListItem>(
    rows: T[] = [],
    drafts: Record<number, WinnerFollowupFields>,
    sort: WinnerFollowupSort
) => [...rows].sort((left, right) => {
    const leftDraft = drafts[Number(left.cycle_number || 0)] || getWinnerFollowupDraft(left);
    const rightDraft = drafts[Number(right.cycle_number || 0)] || getWinnerFollowupDraft(right);

    if (sort === 'latest') {
        return toTimestamp(right.cycle_end_at) - toTimestamp(left.cycle_end_at);
    }

    if (sort === 'oldest') {
        return toTimestamp(left.cycle_end_at) - toTimestamp(right.cycle_end_at);
    }

    const leftPending = getWinnerPendingCount(left, leftDraft);
    const rightPending = getWinnerPendingCount(right, rightDraft);
    if (rightPending !== leftPending) return rightPending - leftPending;

    const leftContactPriority = leftDraft.contacted ? 0 : 1;
    const rightContactPriority = rightDraft.contacted ? 0 : 1;
    if (rightContactPriority !== leftContactPriority) return rightContactPriority - leftContactPriority;

    const leftUpdatedAt = toTimestamp(left.followup_updated_at);
    const rightUpdatedAt = toTimestamp(right.followup_updated_at);
    if (leftUpdatedAt !== rightUpdatedAt) {
        if (!leftUpdatedAt) return -1;
        if (!rightUpdatedAt) return 1;
        return leftUpdatedAt - rightUpdatedAt;
    }

    return toTimestamp(right.cycle_end_at) - toTimestamp(left.cycle_end_at);
});

export const buildWinnerFollowupHistoryMap = (
    rows: WinnerFollowupHistoryItem[] = []
): Record<number, WinnerFollowupHistoryItem[]> => (
    rows.reduce<Record<number, WinnerFollowupHistoryItem[]>>((acc, row) => {
        const cycleNumber = Number(row.cycle_number || 0);
        if (cycleNumber <= 0) return acc;

        if (!acc[cycleNumber]) {
            acc[cycleNumber] = [];
        }

        acc[cycleNumber].push(row);
        acc[cycleNumber].sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at));
        return acc;
    }, {})
);

const csvEscape = (value: unknown) => {
    const text = String(value ?? '');
    if (text.includes(';') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

const toYesNo = (value: boolean) => value ? 'Sim' : 'Não';

export const exportWinnerFollowupsCsv = <T extends WinnerFollowupListItem>(
    rows: T[] = [],
    drafts: Record<number, WinnerFollowupFields>
) => {
    const headers = [
        'Ciclo',
        'Início do ciclo',
        'Fim do ciclo',
        'Status do ciclo',
        'Nome',
        'Sobrenome',
        'E-mail',
        'Telefone',
        'Cidade',
        'Estado',
        'Validações',
        'Contatado',
        'Prêmio pago',
        'Imagem recebida',
        'Observação atual',
        'Última validação',
        'Atualizado em'
    ];

    const lines = rows.map((row) => {
        const draft = drafts[Number(row.cycle_number || 0)] || getWinnerFollowupDraft(row);
        return [
            row.cycle_number || '',
            row.cycle_start_at || '',
            row.cycle_end_at || '',
            row.is_active ? 'Em andamento' : 'Encerrado',
            row.winner_name || '',
            row.winner_lastname || '',
            row.winner_email || '',
            row.winner_phone || '',
            row.winner_city || '',
            row.winner_state || '',
            row.validations_count ?? '',
            toYesNo(draft.contacted),
            toYesNo(draft.prize_paid),
            toYesNo(draft.image_received),
            draft.notes,
            row.last_validation_at || '',
            row.followup_updated_at || ''
        ].map(csvEscape).join(';');
    });

    return `\uFEFF${headers.map(csvEscape).join(';')}\n${lines.join('\n')}`;
};
