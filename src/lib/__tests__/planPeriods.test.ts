import { getPlanDurationLabel, getPlanExpiryAtByStart } from '../planPeriods';

describe('planPeriods', () => {
    it('mantém o cálculo legado de datas, mas expõe rótulo por consumo no pacote diário', () => {
        expect(getPlanExpiryAtByStart('starter', '2026-03-20T12:30:00.000Z')).toBe('2026-03-21T12:30:00.000Z');
        expect(getPlanDurationLabel('starter')).toContain('consumir');
    });

    it('mantém o cálculo legado de datas, mas expõe rótulo por consumo no pacote semanal', () => {
        expect(getPlanExpiryAtByStart('starter_weekly', '2026-03-20T12:30:00.000Z')).toBe('2026-03-27T12:30:00.000Z');
        expect(getPlanDurationLabel('starter_weekly')).toContain('consumir');
    });

    it('mantém o cálculo legado de datas, mas expõe rótulo por consumo no pacote mensal', () => {
        expect(getPlanExpiryAtByStart('starter_monthly', '2026-03-20T12:30:00.000Z')).toBe('2026-04-20T12:30:00.000Z');
        expect(getPlanDurationLabel('starter_monthly')).toContain('consumir');
    });
});
