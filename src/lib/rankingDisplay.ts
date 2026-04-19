import { RankingProfile } from '../hooks/useRanking';
import { getBrazilStateName } from './brazilStates';

export const normalizeValidationCount = (count: unknown) => {
    const parsed = typeof count === 'number' ? count : Number(count ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.trunc(parsed));
};

export const shouldShowValidationCount = (count: unknown) => normalizeValidationCount(count) >= 100;

export const filterRankingProfiles = (
    profiles: RankingProfile[],
    query: string
) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return profiles;

    return profiles.filter((profile) => {
        const stateName = getBrazilStateName(profile.state)?.toLowerCase() || '';
        const haystack = [
            profile.name,
            profile.lastname,
            profile.city,
            profile.state,
            stateName
        ]
            .join(' ')
            .toLowerCase();

        return haystack.includes(normalizedQuery);
    });
};

export const formatRankingLocation = (profile: Pick<RankingProfile, 'city' | 'state'>) => {
    const city = String(profile.city || '').trim();
    const stateUf = String(profile.state || '').trim().toUpperCase();
    const stateName = getBrazilStateName(stateUf);

    return {
        cityLabel: city || 'Não informado',
        stateLabel: stateName ? `${stateUf} • ${stateName}` : (stateUf || 'Não informado')
    };
};
