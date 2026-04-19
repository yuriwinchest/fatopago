import { describe, expect, it } from 'vitest';
import {
    buildProfileForgotPasswordRedirectUrl,
    getPasswordRecoveryPrefilledEmail,
    hasPasswordRecoveryIndicators,
    isPasswordRecoveryRequestedFromProfile
} from '../passwordRecovery';

describe('hasPasswordRecoveryIndicators', () => {
    it('detecta token de recovery no hash', () => {
        expect(
            hasPasswordRecoveryIndicators({
                search: '',
                hash: '#access_token=token123&type=recovery'
            })
        ).toBe(true);
    });

    it('detecta code na query string', () => {
        expect(
            hasPasswordRecoveryIndicators({
                search: '?code=abc123',
                hash: ''
            })
        ).toBe(true);
    });

    it('retorna falso quando a URL nao tem marcadores de recovery', () => {
        expect(
            hasPasswordRecoveryIndicators({
                search: '?registered=true',
                hash: ''
            })
        ).toBe(false);
    });
});

describe('password recovery helpers', () => {
    it('extrai o e-mail prefill da query string', () => {
        expect(getPasswordRecoveryPrefilledEmail('?email=ana%40fatopago.com&from=profile')).toBe('ana@fatopago.com');
    });

    it('identifica quando a recuperação foi solicitada pelo perfil', () => {
        expect(isPasswordRecoveryRequestedFromProfile('?from=profile')).toBe(true);
        expect(isPasswordRecoveryRequestedFromProfile('?from=login')).toBe(false);
    });

    it('monta a URL de recuperação vinda do perfil com e-mail', () => {
        expect(buildProfileForgotPasswordRedirectUrl('https://fatopago.com', 'ana@fatopago.com')).toBe(
            'https://fatopago.com/forgot-password?email=ana%40fatopago.com&from=profile'
        );
    });
});
