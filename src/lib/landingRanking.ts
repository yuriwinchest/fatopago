import { supabase } from './supabase';

export type RankingProfile = {
    id: string;
    name: string | null;
    lastname: string | null;
    city: string | null;
    state: string | null;
    avatar_url: string | null;
    current_balance: number;
    reputation_score: number;
    validations_count: number;
    last_validation_at: string | null;
};

export type CycleMeta = {
    cycleNumber: number | null;
    startAt: Date | null;
    endAt: Date | null;
};

export const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const toNumber = (value: unknown) => {
    if (value == null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const n = Number(value.replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
};

const fallbackAvatarUrl = (fullName: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e1065&color=fff`;

export const avatarFromProfile = (profile: Pick<RankingProfile, 'name' | 'lastname' | 'avatar_url'>) => {
    if (profile.avatar_url) return profile.avatar_url;
    const fullName = `${profile.name || ''} ${profile.lastname || ''}`.trim() || 'Usuário';
    return fallbackAvatarUrl(fullName);
};

export const formatRankingLocation = (profile: Pick<RankingProfile, 'city' | 'state'>) => {
    const city = (profile.city || '').trim();
    const state = (profile.state || '').trim().toUpperCase();

    if (city && state) return `Município/Cidade: ${city} • UF: ${state}`;
    if (city) return `Município/Cidade: ${city}`;
    if (state) return `UF: ${state}`;
    return 'Localização não informada';
};

export const formatRankingLastValidation = (value: string | null) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const getRankingPageCount = (totalItems: number, pageSize: number) => {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
};

export const getRankingPageSlice = <T,>(items: T[], currentPage: number, pageSize: number) => {
    const safePageSize = pageSize > 0 ? pageSize : items.length || 1;
    const totalPages = getRankingPageCount(items.length, safePageSize);
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * safePageSize;
    return items.slice(startIndex, startIndex + safePageSize);
};

const rankingAvatarCache = new globalThis.Map<string, string>();

export const normalizeRankingProfile = (p: any): RankingProfile => ({
    id: String(p?.id ?? ''),
    name: p?.name ?? null,
    lastname: p?.lastname ?? null,
    city: p?.city ?? null,
    state: p?.state ?? null,
    avatar_url: p?.avatar_url ? String(p.avatar_url) : null,
    current_balance: toNumber(p?.current_balance),
    reputation_score: toNumber(p?.reputation_score),
    validations_count: toNumber(p?.validations_count),
    last_validation_at: p?.last_validation_at ?? null,
});

export const hydrateRankingAvatars = async (rows: RankingProfile[]): Promise<RankingProfile[]> => {
    const missingAvatarIds = Array.from(
        new Set(
            rows
                .filter((row) => !row.avatar_url && row.id && !rankingAvatarCache.has(row.id))
                .map((row) => row.id)
        )
    );

    if (missingAvatarIds.length > 0) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', missingAvatarIds);

        if (error) {
            console.warn('Falha ao completar avatares do ranking:', error);
        } else {
            for (const row of data || []) {
                const id = String((row as any)?.id || '');
                const avatarUrl = (row as any)?.avatar_url ? String((row as any).avatar_url) : '';
                if (id && avatarUrl) rankingAvatarCache.set(id, avatarUrl);
            }
        }
    }

    return rows.map((row) => ({
        ...row,
        avatar_url: row.avatar_url || rankingAvatarCache.get(row.id) || null
    }));
};

export const formatCycleRange = (meta: CycleMeta | null) => {
    if (!meta?.startAt || !meta?.endAt) return null;
    const start = meta.startAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const end = meta.endAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${start} → ${end}`;
};

export const formatCycleDeadline = (meta: CycleMeta | null) => {
    if (!meta?.endAt) return null;
    return meta.endAt.toLocaleString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatCycleRemaining = (endAt: Date | null, nowMs: number) => {
    if (!endAt) return '--';
    const diffMs = endAt.getTime() - nowMs;
    if (diffMs <= 0) return 'Encerrando';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}min`;
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
};
