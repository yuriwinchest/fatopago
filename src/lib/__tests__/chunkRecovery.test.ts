import { describe, expect, it } from 'vitest';
import { buildChunkRecoveryHref, isChunkLoadError } from '../chunkRecovery';

describe('chunkRecovery', () => {
    it('detecta erro de chunk dinâmico', () => {
        expect(
            isChunkLoadError(new Error('Failed to fetch dynamically imported module'))
        ).toBe(true);
        expect(
            isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 14 failed.' })
        ).toBe(true);
        expect(isChunkLoadError(new Error('Erro qualquer'))).toBe(false);
    });

    it('gera URL de recuperação com cache-busting', () => {
        const href = buildChunkRecoveryHref(
            'https://fatopago.com/register?ref=abc',
            123456
        );

        expect(href).toBe('https://fatopago.com/register?ref=abc&__fatopago_reload=123456');
    });
});
