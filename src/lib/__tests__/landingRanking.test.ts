import { describe, expect, it } from 'vitest';
import { formatRankingLocation, getRankingPageCount, getRankingPageSlice, RankingProfile } from '../landingRanking';

const makeProfile = (id: number): RankingProfile => ({
    id: `profile-${id}`,
    name: `Usuário ${id}`,
    lastname: null,
    city: `Cidade ${id}`,
    state: 'PI',
    avatar_url: null,
    current_balance: 0,
    reputation_score: 0,
    validations_count: id,
    last_validation_at: null
});

describe('landingRanking helpers', () => {
    it('formata a localização consolidada do ranking geral', () => {
        expect(formatRankingLocation(makeProfile(1))).toBe('Município/Cidade: Cidade 1 • UF: PI');
        expect(formatRankingLocation({ city: 'Teresina', state: null })).toBe('Município/Cidade: Teresina');
        expect(formatRankingLocation({ city: null, state: 'pi' })).toBe('UF: PI');
    });

    it('pagina corretamente a lista do ranking geral', () => {
        const profiles = Array.from({ length: 23 }, (_, index) => makeProfile(index + 1));

        expect(getRankingPageCount(profiles.length, 10)).toBe(3);
        expect(getRankingPageSlice(profiles, 1, 10)).toHaveLength(10);
        expect(getRankingPageSlice(profiles, 3, 10)).toHaveLength(3);
        expect(getRankingPageSlice(profiles, 99, 10)[0]?.id).toBe('profile-21');
    });
});
