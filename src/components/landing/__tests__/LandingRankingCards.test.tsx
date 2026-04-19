import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LandingRankingCards from '../LandingRankingCards';
import type { RankingProfile } from '../../../lib/landingRanking';

const makeProfile = (validationsCount = 2): RankingProfile => ({
    id: 'profile-1',
    name: 'Mariano',
    lastname: 'Wikoli',
    city: 'Teresina',
    state: 'PI',
    avatar_url: null,
    current_balance: 10,
    reputation_score: 0,
    validations_count: validationsCount,
    last_validation_at: '2026-04-10T08:44:00.000Z'
});

describe('LandingRankingCards', () => {
    it('não renderiza mais a barra explicativa acima do ranking', () => {
        render(
            <LandingRankingCards
                loading={false}
                profiles={[makeProfile()]}
                error={null}
                cycleLabel="Ciclo atual"
            />
        );

        expect(screen.queryByText(/como ler/i)).not.toBeInTheDocument();
        expect(screen.getByText(/^geral$/i)).toBeInTheDocument();
        expect(screen.getByText(/visão consolidada da plataforma/i)).toBeInTheDocument();
        expect(screen.queryByText(/saldo/i)).not.toBeInTheDocument();
        expect(screen.getByText(/última validação/i)).toBeInTheDocument();
    });

    it('esconde a quantidade de validações abaixo de 100 e exibe ao atingir 100', () => {
        const { rerender } = render(
            <LandingRankingCards
                loading={false}
                profiles={[makeProfile(99)]}
                error={null}
                cycleLabel="Ciclo atual"
            />
        );

        expect(screen.queryByText(/^99$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/no ciclo/i)).not.toBeInTheDocument();
        expect(screen.getByText(/última validação/i)).toBeInTheDocument();

        rerender(
            <LandingRankingCards
                loading={false}
                profiles={[makeProfile(100)]}
                error={null}
                cycleLabel="Ciclo atual"
            />
        );

        expect(screen.getByText(/^100$/)).toBeInTheDocument();
        expect(screen.getByText(/no ciclo/i)).toBeInTheDocument();
    });
});
