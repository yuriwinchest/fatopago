import { buildSellerExportFilename, buildSellerExportPayload } from '../sellerExport';

describe('sellerExport', () => {
    it('gera nome de arquivo limpo para exportacao', () => {
        expect(buildSellerExportFilename('Yuri Almeida', '2026-03-23T12:00:00.000Z')).toBe('seller-yuri-almeida-2026-03-23.json');
    });

    it('monta payload com resumo consolidado', () => {
        const payload = buildSellerExportPayload({
            seller: {
                id: 'seller-1',
                name: 'Vendedor 01'
            },
            referred_users: [
                { id: 'ref-1' },
                { id: 'ref-2' }
            ],
            sales: [
                {
                    id: 'sale-1',
                    plan_id: 'starter_monthly',
                    amount: 180,
                    created_at: '2026-03-23T12:00:00.000Z'
                },
                {
                    id: 'sale-2',
                    plan_id: 'starter',
                    amount: 6,
                    created_at: '2026-03-23T15:00:00.000Z'
                }
            ]
        }, '2026-03-23T18:00:00.000Z');

        expect(payload.exported_at).toBe('2026-03-23T18:00:00.000Z');
        expect(payload.summary.signups_count).toBe(2);
        expect(payload.summary.sales_count).toBe(2);
        expect(payload.summary.total_revenue).toBe(186);
        expect(payload.summary.week_commission).toBe(37.2);
        expect(payload.summary.month_commission).toBe(37.2);
        expect(payload.summary.total_commission).toBe(37.2);
        expect(payload.summary.best_plan_id).toBe('starter_monthly');
        expect(Array.isArray(payload.campaign_customers)).toBe(true);
    });
});
