import {
    ALL_PLAN_IDS,
    DAILY_PLAN_IDS,
    MONTHLY_PLAN_IDS,
    PlanId,
    PLANS_CONFIG,
    WEEKLY_PLAN_IDS,
    parsePlanId
} from './planRules';
import { CommercialPlanPeriod, getPlanDurationLabel } from './planPeriods';

export const AUTO_PLAN_CONTEXT_STORAGE_KEY = 'autoPlanContext';
const LEGACY_AUTO_PLAN_STORAGE_KEY = 'autoPlan';

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

export interface SellerMonthlyLinkContext {
    windowStartAt: string;
    windowEndAt: string;
}

export interface AutoPlanContext {
    planId: PlanId;
    refCode: string | null;
    monthlyLinkWindow?: SellerMonthlyLinkContext;
}

export interface AutoPlanResolution {
    status: 'none' | 'valid' | 'expired' | 'invalid';
    context: AutoPlanContext | null;
    message?: string;
}

export interface SellerMonthlyLinkItem {
    planId: PlanId;
    period: CommercialPlanPeriod;
    name: string;
    shortName: string;
    price: number;
    priceLabel: string;
    link: string;
    titleLabel: string;
    cardLabel: string;
    copyLabel: string;
    shareTitle: string;
    shareText: string;
}

export interface SellerCommercialLinkGroup {
    key: CommercialPlanPeriod;
    title: string;
    subtitle: string;
    items: SellerMonthlyLinkItem[];
}

const sanitizeString = (value?: string | null) => String(value || '').trim();

const buildAutoPlanContext = (
    planId: PlanId,
    refCode: string | null
): AutoPlanContext => ({
    planId,
    refCode
});

export const formatShortPlanName = (name: string) => {
    const trimmed = name
        .replace('Pacote', '')
        .replace('Diário', '')
        .replace('Semanal', '')
        .replace('Mensal', '')
        .trim();
    return trimmed || name.trim();
};

export const formatPlanPriceLabel = (price: number) => price.toFixed(2).replace('.', ',');

const buildLink = (affiliateLink: string, planId: PlanId) => {
    if (!affiliateLink) return '';

    try {
        const url = new URL(affiliateLink);
        url.searchParams.set('plan', planId);
        return url.toString();
    } catch {
        return '';
    }
};

const buildPlanShareText = (planId: PlanId, shortName: string, priceLabel: string) => (
    `Cadastre-se no plano ${shortName} da FatoPago por R$ ${priceLabel}. ` +
    `Validade: ${getPlanDurationLabel(planId)}.`
);

const getPeriodDisplayLabel = (period: CommercialPlanPeriod) => {
    switch (period) {
        case 'monthly':
            return 'mensal';
        case 'weekly':
            return 'semanal';
        default:
            return 'básico';
    }
};

const buildPlanCopyLabel = (planId: PlanId, shortName: string, priceLabel: string) => {
    if (MONTHLY_PLAN_IDS.includes(planId)) {
        return `Mensal ${shortName} | R$ ${priceLabel} | Copiar link`;
    }

    if (WEEKLY_PLAN_IDS.includes(planId)) {
        return `Semanal ${shortName} | R$ ${priceLabel} | Copiar link`;
    }

    return `Básico ${shortName} | R$ ${priceLabel} | Copiar link`;
};

const buildCommercialItems = (
    affiliateLink: string,
    planIds: readonly PlanId[],
    period: CommercialPlanPeriod
) => planIds.map((planId) => {
    const config = PLANS_CONFIG[planId];
    const shortName = formatShortPlanName(config.name);
    const priceLabel = formatPlanPriceLabel(config.price);

    return {
        planId,
        period,
        name: config.name,
        shortName,
        price: config.price,
        priceLabel,
        link: buildLink(affiliateLink, planId),
        titleLabel: `Link ${getPeriodDisplayLabel(period)} - ${shortName} (R$ ${priceLabel})`,
        cardLabel: `Plano ${getPeriodDisplayLabel(period)} ${shortName} • R$ ${priceLabel}`,
        copyLabel: buildPlanCopyLabel(planId, shortName, priceLabel),
        shareTitle: `FatoPago - ${config.name}`,
        shareText: buildPlanShareText(planId, shortName, priceLabel)
    };
});

export function buildSellerMonthlyLinks(
    affiliateLink: string
): { groups: SellerCommercialLinkGroup[] } {
    return {
        groups: [
            {
                key: 'daily',
                title: 'Links básicos',
                subtitle: 'Pacotes básicos com consumo por quantidade de notícias.',
                items: buildCommercialItems(affiliateLink, DAILY_PLAN_IDS, 'daily')
            },
            {
                key: 'weekly',
                title: 'Links semanais',
                subtitle: 'Planos semanais com consumo total por quantidade de notícias.',
                items: buildCommercialItems(affiliateLink, WEEKLY_PLAN_IDS, 'weekly')
            },
            {
                key: 'monthly',
                title: 'Links mensais',
                subtitle: 'Planos mensais com consumo total por quantidade de notícias.',
                items: buildCommercialItems(affiliateLink, MONTHLY_PLAN_IDS, 'monthly')
            }
        ]
    };
}

export function resolveAutoPlanContext(
    planId: PlanId | null,
    options: {
        refCode?: string | null;
        windowStartAt?: string | null;
        windowEndAt?: string | null;
    }
): AutoPlanResolution {
    if (!planId || !ALL_PLAN_IDS.includes(planId)) {
        return { status: 'none', context: null };
    }

    const refCode = sanitizeString(options.refCode) || null;

    return {
        status: 'valid',
        context: buildAutoPlanContext(planId, refCode)
    };
}

export function resolveAutoPlanContextFromSearchParams(
    searchParams: SearchParamsReader,
    refCode?: string | null
): AutoPlanResolution {
    const planId = parsePlanId(searchParams.get('plan'));

    return resolveAutoPlanContext(
        planId,
        {
            refCode,
            windowStartAt: searchParams.get('windowStartAt'),
            windowEndAt: searchParams.get('windowEndAt')
        }
    );
}

export function persistAutoPlanContext(context: AutoPlanContext) {
    if (typeof window === 'undefined') return;

    sessionStorage.setItem(AUTO_PLAN_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    sessionStorage.setItem(LEGACY_AUTO_PLAN_STORAGE_KEY, context.planId);
}

export function clearStoredAutoPlanContext() {
    if (typeof window === 'undefined') return;

    sessionStorage.removeItem(AUTO_PLAN_CONTEXT_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_AUTO_PLAN_STORAGE_KEY);
}

export function readStoredAutoPlanContext(): AutoPlanResolution {
    if (typeof window === 'undefined') {
        return { status: 'none', context: null };
    }

    const raw = sessionStorage.getItem(AUTO_PLAN_CONTEXT_STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<AutoPlanContext>;
            const resolution = resolveAutoPlanContext(
                parsePlanId(typeof parsed.planId === 'string' ? parsed.planId : null),
                {
                    refCode: typeof parsed.refCode === 'string' ? parsed.refCode : null,
                    windowStartAt: parsed.monthlyLinkWindow?.windowStartAt,
                    windowEndAt: parsed.monthlyLinkWindow?.windowEndAt
                }
            );

            if (resolution.status === 'valid') {
                return resolution;
            }

            clearStoredAutoPlanContext();
            return resolution;
        } catch {
            clearStoredAutoPlanContext();
        }
    }

    const legacyPlanId = parsePlanId(sessionStorage.getItem(LEGACY_AUTO_PLAN_STORAGE_KEY));
    if (!legacyPlanId) {
        return { status: 'none', context: null };
    }

    return resolveAutoPlanContext(legacyPlanId, {});
}

export function buildAutoPlanQueryString(
    context: AutoPlanContext,
    extraParams?: Record<string, string>
) {
    const params = new URLSearchParams(extraParams || {});

    params.set('plan', context.planId);

    return params.toString();
}

export function buildPlansAutoPlanQueryString(
    context: AutoPlanContext,
    returnTo = '/validation'
) {
    const params = new URLSearchParams({
        autoPlan: context.planId,
        returnTo
    });

    return params.toString();
}
