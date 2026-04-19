import {
    SAO_PAULO_UTC_OFFSET_MS,
    getStartOfSaoPauloDay,
    getStartOfSaoPauloMonth,
    getWeeklyCycleSnapshot
} from './cycleSchedule';

export interface SellerSale {
    id: string;
    planId: string;
    amount: number;
    createdAt: string;
}

export interface SellerDailySeriesEntry {
    label: string;
    revenue: number;
    salesCount: number;
}

export interface SellerPlanBreakdown {
    planId: string;
    revenue: number;
    salesCount: number;
}

export interface SellerMetrics {
    totalRevenue: number;
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
    totalCommission: number;
    todayCommission: number;
    weekCommission: number;
    monthCommission: number;
    salesCount: number;
    bestPlanId: string | null;
    bestPlanSalesCount: number;
    dailySeries: SellerDailySeriesEntry[];
    planBreakdown: SellerPlanBreakdown[];
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
export const SELLER_COMMISSION_RATE = 0.2;

function toTimestamp(input: string): number {
    return new Date(input).getTime();
}

function toNumber(input: number): number {
    return Number.isFinite(input) ? input : 0;
}

export function getSellerCommissionAmount(revenue: number): number {
    const normalized = Number.isFinite(revenue) ? revenue : 0;
    return Number((normalized * SELLER_COMMISSION_RATE).toFixed(2));
}

export function buildSellerMetrics(
    sales: SellerSale[],
    nowInput: Date | string | number = new Date()
): SellerMetrics {
    const nowMs = nowInput instanceof Date ? nowInput.getTime() : new Date(nowInput).getTime();
    const todayStartMs = getStartOfSaoPauloDay(nowMs);
    const monthStartMs = getStartOfSaoPauloMonth(nowMs);
    const cycleSnapshot = getWeeklyCycleSnapshot(nowMs);
    const weekStartMs = new Date(cycleSnapshot.cycleStartAt).getTime();

    const normalizedSales = sales
        .map((sale) => ({
            ...sale,
            amount: toNumber(sale.amount),
            timestamp: toTimestamp(sale.createdAt)
        }))
        .filter((sale) => !Number.isNaN(sale.timestamp) && sale.amount > 0);

    const totalRevenue = normalizedSales.reduce((sum, sale) => sum + sale.amount, 0);
    const todayRevenue = normalizedSales
        .filter((sale) => sale.timestamp >= todayStartMs && sale.timestamp <= nowMs)
        .reduce((sum, sale) => sum + sale.amount, 0);
    const weekRevenue = normalizedSales
        .filter((sale) => sale.timestamp >= weekStartMs && sale.timestamp <= nowMs)
        .reduce((sum, sale) => sum + sale.amount, 0);
    const monthRevenue = normalizedSales
        .filter((sale) => sale.timestamp >= monthStartMs && sale.timestamp <= nowMs)
        .reduce((sum, sale) => sum + sale.amount, 0);
    const totalCommission = getSellerCommissionAmount(totalRevenue);
    const todayCommission = getSellerCommissionAmount(todayRevenue);
    const weekCommission = getSellerCommissionAmount(weekRevenue);
    const monthCommission = getSellerCommissionAmount(monthRevenue);

    const planBreakdownMap = new Map<string, SellerPlanBreakdown>();
    for (const sale of normalizedSales) {
        const current = planBreakdownMap.get(sale.planId) || {
            planId: sale.planId,
            revenue: 0,
            salesCount: 0
        };

        current.revenue += sale.amount;
        current.salesCount += 1;
        planBreakdownMap.set(sale.planId, current);
    }

    const planBreakdown = Array.from(planBreakdownMap.values()).sort((left, right) => {
        if (right.salesCount !== left.salesCount) return right.salesCount - left.salesCount;
        if (right.revenue !== left.revenue) return right.revenue - left.revenue;
        return left.planId.localeCompare(right.planId);
    });

    const cycleStartLocalMs = weekStartMs + SAO_PAULO_UTC_OFFSET_MS;
    const cycleStartLocal = new Date(cycleStartLocalMs);

    const dailySeries: SellerDailySeriesEntry[] = Array.from({ length: 7 }, (_, index) => {
        const localBucketStartMs = Date.UTC(
            cycleStartLocal.getUTCFullYear(),
            cycleStartLocal.getUTCMonth(),
            cycleStartLocal.getUTCDate() + index,
            0,
            0,
            0,
            0
        );
        const bucketStartMs = localBucketStartMs - SAO_PAULO_UTC_OFFSET_MS;
        const bucketEndMs = bucketStartMs + (24 * 60 * 60 * 1000);

        const bucketSales = normalizedSales.filter(
            (sale) => sale.timestamp >= bucketStartMs && sale.timestamp < bucketEndMs
        );

        return {
            label: DAY_LABELS[(cycleStartLocal.getUTCDay() + index) % 7],
            revenue: bucketSales.reduce((sum, sale) => sum + sale.amount, 0),
            salesCount: bucketSales.length
        };
    });

    return {
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalCommission,
        todayCommission,
        weekCommission,
        monthCommission,
        salesCount: normalizedSales.length,
        bestPlanId: planBreakdown[0]?.planId || null,
        bestPlanSalesCount: planBreakdown[0]?.salesCount || 0,
        dailySeries,
        planBreakdown
    };
}
