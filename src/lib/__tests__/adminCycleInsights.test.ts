import { describe, expect, it } from 'vitest';
import { buildCycleInsights } from '../adminCycleInsights';

describe('buildCycleInsights', () => {
    it('resume o ciclo com receita, comissão, vendedor líder e pacote líder', () => {
        const insights = buildCycleInsights({
            start: '2026-04-07T15:00:00.000Z',
            end: '2026-04-14T14:00:00.000Z',
            profilesCreated: [
                { id: 'u1', created_at: '2026-04-08T10:00:00.000Z' },
                { id: 'u2', created_at: '2026-04-08T11:00:00.000Z' },
                { id: 'u3', created_at: '2026-04-09T09:00:00.000Z' }
            ],
            pixPayments: [
                {
                    user_id: 'u1',
                    seller_id: 'seller-a',
                    plan_id: 'starter',
                    amount: 6,
                    status: 'approved',
                    created_at: '2026-04-08T12:00:00.000Z',
                    plan_activated_at: '2026-04-08T12:01:00.000Z'
                },
                {
                    user_id: 'u2',
                    seller_id: 'seller-a',
                    plan_id: 'starter',
                    amount: 6,
                    status: 'approved',
                    created_at: '2026-04-08T12:10:00.000Z',
                    plan_activated_at: '2026-04-08T12:11:00.000Z'
                },
                {
                    user_id: 'u3',
                    seller_id: 'seller-b',
                    plan_id: 'expert',
                    amount: 20,
                    status: 'pending',
                    created_at: '2026-04-09T11:00:00.000Z',
                    plan_activated_at: null
                }
            ],
            sellerReferrals: [
                { seller_id: 'seller-a', referred_user_id: 'u1', created_at: '2026-04-08T10:00:00.000Z' },
                { seller_id: 'seller-a', referred_user_id: 'u2', created_at: '2026-04-08T11:00:00.000Z' },
                { seller_id: 'seller-b', referred_user_id: 'u3', created_at: '2026-04-09T09:00:00.000Z' }
            ],
            sellerFunnelEvents: [
                { seller_id: 'seller-a', event_type: 'link_click', created_at: '2026-04-08T08:00:00.000Z' },
                { seller_id: 'seller-a', event_type: 'link_click', created_at: '2026-04-08T08:05:00.000Z' },
                { seller_id: 'seller-b', event_type: 'link_click', created_at: '2026-04-09T08:00:00.000Z' },
                { seller_id: 'seller-b', event_type: 'invite_visit', created_at: '2026-04-09T08:10:00.000Z' }
            ],
            sellerCommissionCredits: [
                { seller_id: 'seller-a', amount: 1.2, created_at: '2026-04-08T12:02:00.000Z' },
                { seller_id: 'seller-a', amount: 1.2, created_at: '2026-04-08T12:12:00.000Z' }
            ],
            sellerDirectory: [
                { id: 'seller-a', name: 'Cibelle Lima' },
                { id: 'seller-b', name: 'Outro Vendedor' }
            ]
        });

        expect(insights.summary.activeUsersCount).toBe(3);
        expect(insights.summary.registrationsCount).toBe(3);
        expect(insights.summary.paidUsersCount).toBe(2);
        expect(insights.summary.revenue).toBe(12);
        expect(insights.summary.sellerCommissionTotal).toBe(2.4);
        expect(insights.summary.topSeller.sellerName).toBe('Cibelle Lima');
        expect(insights.summary.topSeller.count).toBe(2);
        expect(insights.summary.topLinkSeller.sellerName).toBe('Cibelle Lima');
        expect(insights.summary.topLinkSeller.count).toBe(2);
        expect(insights.summary.topPlan.planId).toBe('starter');
        expect(insights.summary.topPlan.salesCount).toBe(2);
        expect(insights.summary.topPlan.sellerName).toBe('Cibelle Lima');
        expect(insights.summary.topSellerDetails).toMatchObject({
            sellerName: 'Cibelle Lima',
            registrationsCount: 2,
            paidUsersCount: 2,
            unpaidUsersCount: 0,
            salesCount: 2,
            revenue: 12,
            linkClicks: 2,
            inviteVisits: 0
        });
    });

    it('gera resumo por dia para o calendário do ciclo', () => {
        const insights = buildCycleInsights({
            start: '2026-04-07T15:00:00.000Z',
            end: '2026-04-14T14:00:00.000Z',
            profilesCreated: [
                { id: 'u1', created_at: '2026-04-08T10:00:00.000Z' },
                { id: 'u2', created_at: '2026-04-09T10:00:00.000Z' }
            ],
            pixPayments: [
                {
                    user_id: 'u1',
                    seller_id: 'seller-a',
                    plan_id: 'starter',
                    amount: 6,
                    status: 'approved',
                    created_at: '2026-04-08T12:00:00.000Z',
                    plan_activated_at: '2026-04-08T12:01:00.000Z'
                }
            ],
            sellerReferrals: [
                { seller_id: 'seller-a', referred_user_id: 'u1', created_at: '2026-04-08T10:00:00.000Z' },
                { seller_id: 'seller-a', referred_user_id: 'u2', created_at: '2026-04-09T10:00:00.000Z' }
            ],
            sellerFunnelEvents: [
                { seller_id: 'seller-a', event_type: 'link_click', created_at: '2026-04-08T08:00:00.000Z' },
                { seller_id: 'seller-a', event_type: 'invite_visit', created_at: '2026-04-08T08:10:00.000Z' }
            ],
            sellerCommissionCredits: [
                { seller_id: 'seller-a', amount: 1.2, created_at: '2026-04-08T12:02:00.000Z' }
            ],
            sellerDirectory: [
                { id: 'seller-a', name: 'Cibelle Lima' }
            ]
        });

        expect(insights.byDay['2026-04-08']).toMatchObject({
            registrationsCount: 1,
            paidUsersCount: 1,
            unpaidUsersCount: 0,
            activeUsersCount: 1,
            revenue: 6,
            sellerCommissionTotal: 1.2,
            linkClicks: 1,
            inviteVisits: 1
        });
        expect(insights.byDay['2026-04-09']).toMatchObject({
            registrationsCount: 1,
            paidUsersCount: 0,
            unpaidUsersCount: 1,
            activeUsersCount: 1,
            revenue: 0
        });
        expect(insights.byDay['2026-04-08'].topSellerDetails).toMatchObject({
            sellerName: 'Cibelle Lima',
            registrationsCount: 1,
            paidUsersCount: 1,
            unpaidUsersCount: 0,
            salesCount: 1
        });
    });
});
