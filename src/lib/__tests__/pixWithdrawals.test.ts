import { describe, expect, it } from 'vitest';
import {
    getPixWithdrawalStatusLabel,
    isOpenPixWithdrawalStatus,
    maskPixKey,
    normalizePixWithdrawalStatus
} from '../pixWithdrawals';

describe('pixWithdrawals helpers', () => {
    it('normaliza apenas status conhecidos', () => {
        expect(normalizePixWithdrawalStatus('PROCESSING')).toBe('processing');
        expect(normalizePixWithdrawalStatus('pending_manual_review')).toBe('pending_manual_review');
        expect(normalizePixWithdrawalStatus('unknown')).toBeNull();
    });

    it('identifica corretamente saques ainda abertos', () => {
        expect(isOpenPixWithdrawalStatus('pending')).toBe(true);
        expect(isOpenPixWithdrawalStatus('pending_manual_review')).toBe(true);
        expect(isOpenPixWithdrawalStatus('processing')).toBe(true);
        expect(isOpenPixWithdrawalStatus('completed')).toBe(false);
        expect(isOpenPixWithdrawalStatus('failed')).toBe(false);
    });

    it('gera labels de status amigaveis', () => {
        expect(getPixWithdrawalStatusLabel('pending')).toBe('Na fila');
        expect(getPixWithdrawalStatusLabel('pending_manual_review')).toBe('Em revisão manual');
        expect(getPixWithdrawalStatusLabel('completed')).toBe('Concluído');
    });

    it('mascara a chave pix preservando apenas extremidades', () => {
        expect(maskPixKey('12345678901')).toBe('12*******01');
        expect(maskPixKey('ab12')).toBe('***2');
        expect(maskPixKey('')).toBe('Nao informado');
    });
});
