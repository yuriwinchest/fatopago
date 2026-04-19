import { describe, expect, it } from 'vitest';
import { readSupabaseFunctionErrorMessage } from '../supabaseFunctionErrors';

describe('readSupabaseFunctionErrorMessage', () => {
    it('prioriza o erro estruturado retornado pela function', async () => {
        const message = await readSupabaseFunctionErrorMessage(
            {
                message: 'Edge Function returned a non-2xx status code',
                context: new Response(JSON.stringify({ error: 'Já existe um vendedor com este e-mail.' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                })
            },
            'fallback'
        );

        expect(message).toBe('Já existe um vendedor com este e-mail.');
    });

    it('usa a mensagem direta quando não houver corpo estruturado', async () => {
        const message = await readSupabaseFunctionErrorMessage(
            { message: 'Falha de rede' },
            'fallback'
        );

        expect(message).toBe('Falha de rede');
    });

    it('usa fallback quando não houver informação útil', async () => {
        const message = await readSupabaseFunctionErrorMessage({}, 'fallback');
        expect(message).toBe('fallback');
    });
});
