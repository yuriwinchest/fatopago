import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import TermsPage from '../TermsPage';

describe('TermsPage', () => {
    it('renders the three complete legal documents inside the terms page', () => {
        render(
            <MemoryRouter>
                <TermsPage />
            </MemoryRouter>
        );

        expect(
            screen.getByRole('heading', {
                name: /documentos oficiais da plataforma/i
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: /termos de participação e aceite da plataforma de validação de notícias/i
            })
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /políticas de ganhos e privacidade/i })).toBeInTheDocument();
        expect(
            screen.getByRole('heading', {
                name: /privacidade de usuário na plataforma de validação de notícias/i
            })
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /o que é o ciclo no fatopago\?/i })).toBeInTheDocument();
        expect(screen.getByText(/o vencedor de cada ciclo receberá o valor de r\$ 6\.000,00/i)).toBeInTheDocument();
        expect(screen.getByText(/alterações nas regras de remuneração serão comunicadas com antecedência mínima de 30 dias/i)).toBeInTheDocument();
        expect(screen.getByText(/não há venda de dados: as informações dos usuários não são comercializadas/i)).toBeInTheDocument();
        expect(screen.getByText(/ciclo é o período de tempo em que o seu pacote fica ativo para validação de notícias/i)).toBeInTheDocument();
    }, 15000);
});
