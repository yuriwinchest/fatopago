import { buildSellerMetrics } from './sellerMetrics';
import { SellerCampaignCustomerRow } from './sellerCampaign';
import { SellerFunnelEventRow, SellerFunnelSummary } from './sellerFunnel';

export interface SellerExportSeller {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    seller_code?: string | null;
    affiliate_link?: string | null;
    is_active?: boolean;
    created_at?: string | null;
}

export interface SellerExportReferral {
    id?: string;
    created_at?: string;
    name?: string | null;
    lastname?: string | null;
    email?: string | null;
    city?: string | null;
    state?: string | null;
}

export interface SellerExportSale {
    id?: string;
    referred_name?: string;
    referred_lastname?: string;
    referred_email?: string | null;
    plan_id?: string;
    amount?: number;
    created_at?: string;
}

export interface SellerExportPayload {
    seller?: SellerExportSeller;
    referred_users?: SellerExportReferral[];
    sales?: SellerExportSale[];
    campaign_customers?: SellerCampaignCustomerRow[];
    funnel_summary?: SellerFunnelSummary;
    funnel_events?: SellerFunnelEventRow[];
}

export const buildSellerExportFilename = (
    sellerName?: string | null,
    input: Date | string | number = new Date()
) => {
    const baseName = String(sellerName || 'vendedor')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'vendedor';

    const date = new Date(input);
    const stamp = Number.isNaN(date.getTime())
        ? 'export'
        : date.toISOString().slice(0, 10);

    return `seller-${baseName}-${stamp}.json`;
};

export const buildSellerExportPayload = (
    report: SellerExportPayload,
    input: Date | string | number = new Date()
) => {
    const sales = (Array.isArray(report.sales) ? report.sales : []).map((sale) => ({
        ...sale,
        amount: Number(sale.amount || 0)
    }));

    const metrics = buildSellerMetrics(
        sales.map((sale) => ({
            id: String(sale.id || ''),
            planId: String(sale.plan_id || ''),
            amount: Number(sale.amount || 0),
            createdAt: String(sale.created_at || '')
        })),
        input
    );

    return {
        exported_at: new Date(input).toISOString(),
        seller: report.seller || null,
        summary: {
            signups_count: Array.isArray(report.referred_users) ? report.referred_users.length : 0,
            sales_count: sales.length,
            today_revenue: metrics.todayRevenue,
            week_revenue: metrics.weekRevenue,
            month_revenue: metrics.monthRevenue,
            total_revenue: metrics.totalRevenue,
            today_commission: metrics.todayCommission,
            week_commission: metrics.weekCommission,
            month_commission: metrics.monthCommission,
            total_commission: metrics.totalCommission,
            best_plan_id: metrics.bestPlanId,
            funnel: report.funnel_summary || null
        },
        referred_users: Array.isArray(report.referred_users) ? report.referred_users : [],
        campaign_customers: Array.isArray(report.campaign_customers) ? report.campaign_customers : [],
        sales,
        funnel_events: Array.isArray(report.funnel_events) ? report.funnel_events : []
    };
};
