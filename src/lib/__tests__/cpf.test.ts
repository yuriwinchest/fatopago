import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, normalizeCpf } from '../cpf';

describe('cpf helpers', () => {
    it('normaliza CPF removendo caracteres não numéricos', () => {
        expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
    });

    it('valida um CPF conhecido válido', () => {
        expect(isValidCpf('529.982.247-25')).toBe(true);
    });

    it('rejeita CPF inválido', () => {
        expect(isValidCpf('111.111.111-11')).toBe(false);
        expect(isValidCpf('123.456.789-00')).toBe(false);
    });

    it('formata CPF com máscara quando possui 11 dígitos', () => {
        expect(formatCpf('52998224725')).toBe('529.982.247-25');
    });
});
