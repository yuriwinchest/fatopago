import { describe, expect, it } from 'vitest';
import {
    MIN_FALSE_JUSTIFICATION_LENGTH,
    normalizeProofLink,
    validateFalseEvidenceInput
} from '../validationProofs';

describe('validationProofs', () => {
    it('normaliza link sem protocolo', () => {
        expect(normalizeProofLink('example.com/prova')).toBe('https://example.com/prova');
    });

    it('exige justificativa mínima para falso', () => {
        const result = validateFalseEvidenceInput({
            justification: 'curta',
            proofLink: 'https://fonte.com',
            proofFile: new File(['fake'], 'prova.png', { type: 'image/png' })
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain(String(MIN_FALSE_JUSTIFICATION_LENGTH));
        }
    });

    it('exige link de prova para falso', () => {
        const result = validateFalseEvidenceInput({
            justification: 'Justificativa válida',
            proofLink: '',
            proofFile: new File(['fake'], 'prova.png', { type: 'image/png' })
        });

        expect(result).toEqual({
            ok: false,
            error: 'Para validar como falsa, informe o link da fonte ou da prova.'
        });
    });

    it('exige foto de prova para falso', () => {
        const result = validateFalseEvidenceInput({
            justification: 'Justificativa válida',
            proofLink: 'https://fonte.com',
            proofFile: null
        });

        expect(result).toEqual({
            ok: false,
            error: 'Para validar como falsa, anexe uma foto da evidência.'
        });
    });

    it('aceita evidência completa para falso', () => {
        const result = validateFalseEvidenceInput({
            justification: 'Justificativa válida com detalhes.',
            proofLink: 'fonte.com/prova',
            proofFile: new File(['fake'], 'prova.png', { type: 'image/png' })
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.justification).toBe('Justificativa válida com detalhes.');
            expect(result.data.proofLink).toBe('https://fonte.com/prova');
            expect(result.data.proofFile.name).toBe('prova.png');
        }
    });
});
