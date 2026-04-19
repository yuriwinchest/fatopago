export type SellerCampaignSource = 'link' | 'manual' | string;

export type SellerCampaignAccessStatus =
    | 'pending_enable'
    | 'enabled_for_this_seller'
    | 'enabled_for_other_seller'
    | string;

export type SellerCampaignCustomerRow = {
    user_id: string;
    name: string;
    lastname: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    source: SellerCampaignSource;
    linked_at: string;
    campaign_enabled_at: string | null;
    contact_requests_count: number;
    last_contact_request_at: string | null;
    latest_contact_message: string | null;
    total_campaign_sales: number;
    total_campaign_revenue: number;
    first_campaign_purchase_at: string | null;
    last_campaign_purchase_at: string | null;
    last_campaign_plan_id: string | null;
    cycles_without_campaign_purchase: number | null;
    needs_reactivation: boolean;
};

export function getSellerCampaignSourceLabel(source?: SellerCampaignSource | null) {
    switch (String(source || '').toLowerCase()) {
        case 'manual':
            return 'Habilitado manualmente';
        case 'link':
            return 'Entrou pelo link';
        default:
            return 'Campanha comercial';
    }
}

export function getSellerCampaignAccessStatusLabel(status?: SellerCampaignAccessStatus | null) {
    switch (String(status || '').toLowerCase()) {
        case 'enabled_for_this_seller':
            return 'Planos liberados';
        case 'enabled_for_other_seller':
            return 'Vinculado a outro vendedor';
        default:
            return 'Pendente de habilitação';
    }
}

export function getSellerCampaignAccessStatusTone(status?: SellerCampaignAccessStatus | null) {
    switch (String(status || '').toLowerCase()) {
        case 'enabled_for_this_seller':
            return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
        case 'enabled_for_other_seller':
            return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
        default:
            return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100';
    }
}

export function buildSellerCampaignEnabledMessage(params: {
    sellerName?: string | null;
    source?: SellerCampaignSource | null;
}) {
    const sellerName = params.sellerName?.trim() || 'o vendedor';
    const source = String(params.source || '').toLowerCase();

    if (source === 'manual') {
        return `Seus planos semanal e mensal já foram habilitados por ${sellerName}. Escolha abaixo o pacote da campanha que deseja comprar.`;
    }

    return `Seus planos semanal e mensal já estão liberados com ${sellerName}. Escolha abaixo o pacote da campanha que deseja comprar.`;
}

export function buildSellerCampaignAcknowledgementKey(params: {
    sellerId?: string | null;
    source?: SellerCampaignSource | null;
    campaignEnabledAt?: string | null;
}) {
    if (!params.sellerId || !params.campaignEnabledAt) return null;

    return [
        'seller-campaign-access',
        params.sellerId,
        String(params.source || 'unknown').toLowerCase(),
        params.campaignEnabledAt
    ].join(':');
}
