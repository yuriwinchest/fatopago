import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, getRoleFromContext, getRoleRedirect } from '../authRouting';

describe('authRouting', () => {
    it('prioriza admin quando o e-mail é o do admin', () => {
        const role = getRoleFromContext({ email: ADMIN_EMAIL, isSeller: true });
        expect(role).toBe('admin');
        expect(getRoleRedirect(role)).toBe('/admin-dashboard');
    });

    it('retorna seller quando marcado como vendedor', () => {
        const role = getRoleFromContext({ email: 'vendedor@teste.com', isSeller: true });
        expect(role).toBe('seller');
        expect(getRoleRedirect(role)).toBe('/admin-dashboard');
    });

    it('retorna user quando não é admin nem vendedor', () => {
        const role = getRoleFromContext({ email: 'usuario@teste.com', isSeller: false });
        expect(role).toBe('user');
        expect(getRoleRedirect(role)).toBe('/validation');
    });
});
