import { supabase } from './supabase';

export type SellerFunnelEventType =
    | 'link_click'
    | 'invite_visit'
    | 'register_completed'
    | 'pix_generated'
    | 'pix_approved';

export type SellerFunnelSummary = {
    link_clicks: number;
    unique_link_clicks: number;
    invite_visits: number;
    unique_invite_visits: number;
    registrations: number;
    unique_registrations: number;
    pix_generated: number;
    unique_pix_generated: number;
    pix_approved: number;
    unique_pix_approved: number;
};

export type SellerFunnelEventRow = {
    id: number;
    event_type: SellerFunnelEventType;
    source: string;
    created_at: string;
    visitor_id: string | null;
    referred_user_id: string | null;
    seller_referral_id: number | null;
    path: string | null;
    metadata: Record<string, unknown> | null;
    referred_name: string | null;
    referred_lastname: string | null;
    referred_email: string | null;
    referred_city: string | null;
    referred_state: string | null;
    referred_avatar_url: string | null;
    plan_id: string | null;
    mp_payment_id: string | null;
    amount: number;
};

const VISITOR_STORAGE_KEY = 'seller-funnel.visitor-id';
const EVENT_DEDUP_PREFIX = 'seller-funnel.dedup.';

const safeBrowser = () => typeof window !== 'undefined';

const buildFallbackVisitorId = () =>
    `vf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const resolveSellerFunnelVisitorId = () => {
    if (!safeBrowser()) return null;

    const current = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (current) return current;

    const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : buildFallbackVisitorId();

    window.localStorage.setItem(VISITOR_STORAGE_KEY, next);
    return next;
};

export const buildSellerFunnelDedupKey = (
    affiliateCode: string,
    eventType: SellerFunnelEventType
) => `${EVENT_DEDUP_PREFIX}${String(affiliateCode || '').trim().toUpperCase()}:${eventType}`;

export const hasTrackedSellerFunnelEvent = (
    affiliateCode: string,
    eventType: SellerFunnelEventType
) => {
    if (!safeBrowser()) return false;
    return window.sessionStorage.getItem(buildSellerFunnelDedupKey(affiliateCode, eventType)) === '1';
};

export const markSellerFunnelEventTracked = (
    affiliateCode: string,
    eventType: SellerFunnelEventType
) => {
    if (!safeBrowser()) return;
    window.sessionStorage.setItem(buildSellerFunnelDedupKey(affiliateCode, eventType), '1');
};

export const trackSellerFunnelEvent = async (params: {
    affiliateCode: string;
    eventType: Extract<SellerFunnelEventType, 'link_click' | 'invite_visit'>;
    path?: string;
    metadata?: Record<string, unknown>;
}) => {
    const affiliateCode = String(params.affiliateCode || '').trim().toUpperCase();
    if (!affiliateCode || !safeBrowser()) return;
    if (hasTrackedSellerFunnelEvent(affiliateCode, params.eventType)) return;

    const visitorId = resolveSellerFunnelVisitorId();
    const payload = params.metadata ?? {};

    const { error } = await supabase.rpc('track_seller_funnel_event', {
        p_affiliate_code: affiliateCode,
        p_event_type: params.eventType,
        p_visitor_id: visitorId,
        p_path: params.path || window.location.pathname,
        p_metadata: payload
    });

    if (error) {
        throw error;
    }

    markSellerFunnelEventTracked(affiliateCode, params.eventType);
};

export const getSellerFunnelEventLabel = (eventType?: string | null) => {
    switch (String(eventType || '').toLowerCase()) {
        case 'link_click':
            return 'Clique no link';
        case 'invite_visit':
            return 'Visita na página do convite';
        case 'register_completed':
            return 'Cadastro concluído';
        case 'pix_generated':
            return 'Compra gerada';
        case 'pix_approved':
            return 'Compra aprovada';
        default:
            return 'Evento';
    }
};

export const getSellerFunnelEventTone = (eventType?: string | null) => {
    switch (String(eventType || '').toLowerCase()) {
        case 'link_click':
            return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100';
        case 'invite_visit':
            return 'border-sky-400/20 bg-sky-500/10 text-sky-100';
        case 'register_completed':
            return 'border-purple-400/20 bg-purple-500/10 text-purple-100';
        case 'pix_generated':
            return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
        case 'pix_approved':
            return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
        default:
            return 'border-white/10 bg-white/5 text-slate-200';
    }
};
