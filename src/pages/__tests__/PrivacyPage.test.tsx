import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '../PrivacyPage';

describe('PrivacyPage', () => {
    it('renders the privacy policy sections', () => {
        render(
            <MemoryRouter>
                <PrivacyPage />
            </MemoryRouter>
        );

        expect(
            screen.getByRole('heading', {
                name: /privacidade de usuário na plataforma de validação de notícias/i
            })
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /coleta de informações/i })).toBeInTheDocument();
        expect(screen.getByText(/não há venda de dados/i)).toBeInTheDocument();
        expect(screen.getByText(/direito de exclusão de dados mediante solicitação/i)).toBeInTheDocument();
    });
});
