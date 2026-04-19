import {
    createSentrySmokeTestError,
    isLocalSentrySmokeTestEnabled,
    parseSentrySampleRate,
    stripSensitiveUrlParts,
} from '../sentry';

describe('parseSentrySampleRate', () => {
    it('retorna o fallback quando o valor é inválido', () => {
        expect(parseSentrySampleRate('abc', 0.25)).toBe(0.25);
        expect(parseSentrySampleRate('-1', 0.25)).toBe(0.25);
        expect(parseSentrySampleRate('2', 0.25)).toBe(0.25);
    });

    it('retorna o valor quando ele está entre 0 e 1', () => {
        expect(parseSentrySampleRate('0')).toBe(0);
        expect(parseSentrySampleRate('0.5')).toBe(0.5);
        expect(parseSentrySampleRate('1')).toBe(1);
    });
});

describe('stripSensitiveUrlParts', () => {
    it('remove query string e hash de URLs válidas', () => {
        expect(stripSensitiveUrlParts('https://fatopago.com/reset?token=abc#step-2')).toBe('https://fatopago.com/reset');
    });

    it('remove query string de URLs não parseáveis', () => {
        expect(stripSensitiveUrlParts('/reset?token=abc')).toBe('/reset');
    });
});

describe('isLocalSentrySmokeTestEnabled', () => {
    it('habilita o smoke test apenas em localhost com query param explícita', () => {
        expect(isLocalSentrySmokeTestEnabled(new URL('http://localhost:4173/?sentry-test=1'))).toBe(true);
        expect(isLocalSentrySmokeTestEnabled(new URL('http://127.0.0.1:4173/?sentry-test=1'))).toBe(true);
        expect(isLocalSentrySmokeTestEnabled(new URL('http://localhost:4173/'))).toBe(false);
        expect(isLocalSentrySmokeTestEnabled(new URL('https://fatopago.com/?sentry-test=1'))).toBe(false);
    });
});

describe('createSentrySmokeTestError', () => {
    it('gera o erro padrão de smoke test', () => {
        expect(createSentrySmokeTestError().message).toBe('Fatopago local Sentry smoke test');
    });
});
