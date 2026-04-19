import { supabase } from './supabase';
import { SellerCampaignAccessStatus, SellerCampaignSource } from './sellerCampaign';

export type SellerContactSellerOption = {
    id: string;
    name: string;
    avatar_url: string | null;
};

export type SellerContactMessageRow = {
    id: string;
    seller_id: string;
    seller_name: string;
    seller_code: string;
    seller_phone: string | null;
    user_id: string;
    user_name: string;
    user_lastname: string | null;
    user_email: string;
    user_phone: string | null;
    message: string;
    status: 'new' | 'contacted' | 'closed' | string;
    created_at: string;
    campaign_access_status: SellerCampaignAccessStatus;
    campaign_enabled_at: string | null;
    campaign_source: SellerCampaignSource | null;
    campaign_seller_id: string | null;
    campaign_seller_name: string | null;
    can_enable_campaign: boolean;
};

export function buildDefaultSellerContactMessage(sellerName?: string | null) {
    const safeSellerName = String(sellerName || '').trim();
    return safeSellerName
        ? `Olá, ${safeSellerName}. Tenho interesse em contratar um pacote semanal ou mensal da FatoPago e quero entender qual opção faz mais sentido para mim.`
        : 'Olá. Tenho interesse em contratar um pacote semanal ou mensal da FatoPago e quero entender qual opção faz mais sentido para mim.';
}

export function buildSellerContactExcerpt(message: string, maxLength = 120) {
    const normalized = String(message || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function getSellerContactStatusLabel(status?: string | null) {
    switch (String(status || '').toLowerCase()) {
        case 'enabled':
            return 'Planos habilitados';
        case 'contacted':
            return 'Em contato';
        case 'closed':
            return 'Fechado';
        default:
            return 'Novo';
    }
}

export async function listActiveSellersForContact() {
    const { data, error } = await supabase.rpc('list_active_sellers_for_contact');
    if (error) throw error;
    return (data || []) as SellerContactSellerOption[];
}

export async function createSellerContactMessage(sellerId: string, message: string) {
    const { data, error } = await supabase.rpc('create_seller_contact_message', {
        p_seller_id: sellerId,
        p_message: message
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row as SellerContactMessageRow;
}

export async function enableSellerCampaignForContactMessage(messageId: string) {
    const { data, error } = await supabase.rpc('seller_enable_campaign_for_contact_message', {
        p_message_id: messageId
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row as {
        seller_id: string;
        seller_name: string;
        seller_code: string;
        user_id: string;
        access_source: SellerCampaignSource;
        campaign_enabled_at: string;
    };
}

export async function listAdminSellerContactMessages(limit = 40) {
    const { data, error } = await supabase.rpc('admin_list_seller_contact_messages', {
        p_limit: limit
    });
    if (error) throw error;
    return (data || []) as SellerContactMessageRow[];
}

export async function listMySellerContactMessages(limit = 40) {
    const { data, error } = await supabase.rpc('seller_list_my_contact_messages', {
        p_limit: limit
    });
    if (error) throw error;
    return (data || []) as SellerContactMessageRow[];
}
