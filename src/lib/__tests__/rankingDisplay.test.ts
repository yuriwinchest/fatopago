import { describe, expect, it } from 'vitest';
import { RankingProfile } from '../../hooks/useRanking';
import {
    filterRankingProfiles,
    formatRankingLocation,
    normalizeValidationCount,
    shouldShowValidationCount
} from '../rankingDisplay';

const buildProfile = (overrides: Partial<RankingProfile>): RankingProfile => ({
    id: '1',
    name: 'Paulo',
    lastname: 'Silva',
    city: 'Piripiri',
    state: 'PI',
    reputation_score: 40,
    validations_count: 12,
    last_validation_at: null,
    avatar_url: null,
    ...overrides
});

describe('rankingDisplay', () => {
    it('filtra por nome e nome do estado', () => {
        const profiles = [
            buildProfile({ id: '1', name: 'Paulo', city: 'Piripiri', state: 'PI' }),
            buildProfile({ id: '2', name: 'Marina', city: 'Campinas', state: 'SP' })
        ];

        expect(filterRankingProfiles(profiles, 'piripiri')).toHaveLength(1);
        expect(filterRankingProfiles(profiles, 'piauí')).toHaveLength(1);
        expect(filterRankingProfiles(profiles, 'são paulo')).toHaveLength(1);
    });

    it('não inventa fallback de localização', () => {
        expect(formatRankingLocation(buildProfile({ city: '', state: '' }))).toEqual({
            cityLabel: 'Não informado',
            stateLabel: 'Não informado'
        });
    });

    it('normaliza contagem de validações antes da regra de exibição', () => {
        expect(normalizeValidationCount('150')).toBe(150);
        expect(normalizeValidationCount('abc')).toBe(0);
        expect(normalizeValidationCount(-10)).toBe(0);
    });

    it('só exibe contagem a partir de 100 validações', () => {
        expect(shouldShowValidationCount(99)).toBe(false);
        expect(shouldShowValidationCount(100)).toBe(true);
        expect(shouldShowValidationCount('120')).toBe(true);
    });
});
