import {
    buildSellerMonthlyLinks,
    resolveAutoPlanContext
} from '../sellerMonthlyLinks';

describe('sellerMonthlyLinks', () => {
    it('gera 9 links comerciais com diário, semanal e mensal', () => {
        const result = buildSellerMonthlyLinks('https://fatopago.com/convite/VNDTESTE01');

        expect(result.groups).toHaveLength(3);
        expect(result.groups[0].key).toBe('daily');
        expect(result.groups[1].key).toBe('weekly');
        expect(result.groups[2].key).toBe('monthly');
        expect(result.groups.flatMap((group) => group.items)).toHaveLength(9);
    });

    it('gera os links sem janela mensal e com o plano no query string', () => {
        const result = buildSellerMonthlyLinks('https://fatopago.com/convite/VNDTESTE01');
        const monthlyLink = new URL(result.groups[2].items[0].link);
        const dailyLink = new URL(result.groups[0].items[0].link);

        expect(monthlyLink.searchParams.get('plan')).toBe('starter_monthly');
        expect(monthlyLink.searchParams.get('windowStartAt')).toBeNull();
        expect(monthlyLink.searchParams.get('windowEndAt')).toBeNull();
        expect(dailyLink.searchParams.get('plan')).toBe('starter');
    });

    it('aceita auto plan diário, semanal e mensal sem depender de janela', () => {
        expect(resolveAutoPlanContext('starter', { refCode: 'VND123456' }).status).toBe('valid');
        expect(resolveAutoPlanContext('starter_weekly', { refCode: 'VND123456' }).status).toBe('valid');
        expect(resolveAutoPlanContext('starter_monthly', { refCode: 'VND123456' }).status).toBe('valid');
    });
});

