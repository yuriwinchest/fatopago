import { describe, expect, it } from 'vitest';
import { buildSellerMetrics, type SellerSale } from '../sellerMetrics';

const sales: SellerSale[] = [
    {
        id: 'sale-1',
        planId: 'starter',
        amount: 6,
        createdAt: '2026-03-13T12:00:00.000Z'
    },
    {
        id: 'sale-2',
        planId: 'pro',
        amount: 10,
        createdAt: '2026-03-13T18:00:00.000Z'
    },
    {
        id: 'sale-3',
        planId: 'pro',
        amount: 10,
        createdAt: '2026-03-11T15:00:00.000Z'
    },
    {
        id: 'sale-4',
        planId: 'expert',
        amount: 20,
        createdAt: '2026-03-01T18:00:00.000Z'
    }
];

describe('buildSellerMetrics', () => {
    it('aggregates day, week and month totals using the weekly cycle window', () => {
        const metrics = buildSellerMetrics(sales, '2026-03-13T20:00:00.000Z');

        expect(metrics.totalRevenue).toBe(46);
        expect(metrics.todayRevenue).toBe(16);
        expect(metrics.weekRevenue).toBe(26);
        expect(metrics.monthRevenue).toBe(46);
        expect(metrics.totalCommission).toBe(9.2);
        expect(metrics.todayCommission).toBe(3.2);
        expect(metrics.weekCommission).toBe(5.2);
        expect(metrics.monthCommission).toBe(9.2);
        expect(metrics.salesCount).toBe(4);
        expect(metrics.bestPlanId).toBe('pro');
        expect(metrics.bestPlanSalesCount).toBe(2);
    });

    it('builds a daily series for the current weekly cycle', () => {
        const metrics = buildSellerMetrics(sales, '2026-03-13T20:00:00.000Z');

        expect(metrics.dailySeries).toEqual([
            { label: 'Dom', revenue: 0, salesCount: 0 },
            { label: 'Seg', revenue: 0, salesCount: 0 },
            { label: 'Ter', revenue: 0, salesCount: 0 },
            { label: 'Qua', revenue: 10, salesCount: 1 },
            { label: 'Qui', revenue: 0, salesCount: 0 },
            { label: 'Sex', revenue: 16, salesCount: 2 },
            { label: 'Sab', revenue: 0, salesCount: 0 }
        ]);
    });
});
