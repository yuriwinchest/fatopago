import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SellerContactModal from '../plans/SellerContactModal';

const listActiveSellersForContact = vi.fn();
const createSellerContactMessage = vi.fn();
const buildDefaultSellerContactMessage = vi.fn((sellerName?: string) =>
    `Olá, quero falar com ${sellerName || 'o vendedor'} sobre os planos da campanha.`
);

vi.mock('../../lib/sellerContactMessages', () => ({
    listActiveSellersForContact: (...args: unknown[]) => listActiveSellersForContact(...args),
    createSellerContactMessage: (...args: unknown[]) => createSellerContactMessage(...args),
    buildDefaultSellerContactMessage: (...args: unknown[]) => buildDefaultSellerContactMessage(...args)
}));

describe('SellerContactModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listActiveSellersForContact.mockResolvedValue([
            {
                id: 'seller-1',
                name: 'vendendor01',
                seller_code: 'VNDEZVUQHH0'
            },
            {
                id: 'seller-2',
                name: 'testes',
                seller_code: 'VND587A7977'
            }
        ]);
        createSellerContactMessage.mockResolvedValue(undefined);
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    });

    it('trava o scroll global e mantém ações principais visíveis', async () => {
        const { unmount } = render(
            <SellerContactModal isOpen={true} onClose={vi.fn()} />
        );

        const sellerNames = await screen.findAllByText('vendendor01');
        expect(sellerNames.length).toBeGreaterThan(0);
        expect(screen.getByRole('dialog', { name: /contato com vendedor/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enviar solicitação/i })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /fechar/i }).length).toBeGreaterThan(0);
        expect(document.body.style.overflow).toBe('hidden');
        expect(document.documentElement.style.overflow).toBe('hidden');

        unmount();

        expect(document.body.style.overflow).toBe('');
        expect(document.documentElement.style.overflow).toBe('');
    });

    it('envia a mensagem para o vendedor selecionado', async () => {
        render(
            <SellerContactModal isOpen={true} onClose={vi.fn()} onSubmitted={vi.fn()} />
        );

        const testSellerButtons = await screen.findAllByRole('button', { name: /testes/i });

        fireEvent.click(testSellerButtons[0]);

        const textarea = screen.getByLabelText(/mensagem do pedido/i);
        fireEvent.change(textarea, {
            target: {
                value: 'Quero entender as opções de pacote semanal e mensal com atendimento hoje.'
            }
        });

        fireEvent.click(screen.getByRole('button', { name: /enviar solicitação/i }));

        await waitFor(() => {
            expect(createSellerContactMessage).toHaveBeenCalledWith(
                'seller-2',
                'Quero entender as opções de pacote semanal e mensal com atendimento hoje.'
            );
        });

        expect(
            await screen.findByText(/pedido enviado com sucesso/i)
        ).toBeInTheDocument();
    });
});
