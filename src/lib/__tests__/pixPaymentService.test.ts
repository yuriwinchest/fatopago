import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
    getSessionMock: vi.fn()
}));

vi.mock('../supabase', () => ({
    supabase: {
        auth: {
            getSession: getSessionMock
        }
    }
}));

import { createPixPayment, getFriendlyPixCheckoutErrorMessage, PixApiError, requestPixWithdrawal } from '../pixPaymentService';

describe('pixPaymentService.createPixPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        Object.assign(import.meta.env, {
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'anon-key'
        });

        getSessionMock.mockResolvedValue({
            data: {
                session: {
                    access_token: 'token-valido',
                    expires_at: Math.floor(Date.now() / 1000) + 3600
                }
            },
            error: null
        });

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                payment_id: 123,
                status: 'pending',
                qr_code: 'pix-code',
                qr_code_base64: 'base64',
                ticket_url: 'https://example.com/ticket',
                expires_at: '2026-03-27T12:00:00.000Z'
            })
        }));
    });

    it('envia apenas o identificador do plano para a edge function', async () => {
        await createPixPayment('starter_weekly');

        const fetchMock = vi.mocked(fetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [, options] = fetchMock.mock.calls[0];
        const body = JSON.parse(String((options as RequestInit).body));

        expect(body).toEqual({
            plan_id: 'starter_weekly'
        });
        expect(body).not.toHaveProperty('plan_price');
        expect(body).not.toHaveProperty('price');
        expect(body).not.toHaveProperty('amount');
        expect(body).not.toHaveProperty('transaction_amount');
    });

    it('traduz conflito de PIX pendente em erro estruturado', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                error: 'Você já possui um PIX pendente',
                details: 'Quite ou aguarde a expiração do pagamento pendente antes de gerar um PIX para outro pacote.'
            })
        }));

        await expect(createPixPayment('starter_weekly')).rejects.toMatchObject<PixApiError>({
            name: 'PixApiError',
            status: 409,
            code: 'open_pix_payment_exists'
        });
    });

    it('exibe mensagem orientando nova tentativa durante reconciliação do PIX anterior', () => {
        const error = new PixApiError('Você já possui um PIX pendente', 409, 'open_pix_payment_exists');

        expect(getFriendlyPixCheckoutErrorMessage(error)).toBe(
            'O PIX anterior ainda está sendo reconciliado. Aguarde alguns segundos e gere novamente.'
        );
    });

    it('envia apenas valor e chave PIX ao solicitar saque', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                withdrawal_id: 'withdraw-123',
                new_balance: 80,
                message: 'ok',
                withdrawal_status: 'pending'
            })
        }));

        await requestPixWithdrawal(20, '11999999999', 'phone');

        const fetchMock = vi.mocked(fetch);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [, options] = fetchMock.mock.calls[0];
        const body = JSON.parse(String((options as RequestInit).body));

        expect(body).toEqual({
            amount: 20,
            pix_key: '11999999999',
            pix_key_type: 'phone'
        });
        expect(body).not.toHaveProperty('current_balance');
        expect(body).not.toHaveProperty('status');
        expect(body).not.toHaveProperty('transaction_id');
    });
});
