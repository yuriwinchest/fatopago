import { supabase } from './supabase';

export type PromoMediaKind = 'video' | 'image';

export const DEFAULT_PROMO_VIDEO_URL = '/vidoes/video01.mp4';
export const DEFAULT_PROMO_IMAGE_URL = '/fotoprinciapl.jpeg';
export const DEFAULT_PROMO_MEDIA_KIND: PromoMediaKind = 'image';

// Mantemos a chave e o bucket legados para compatibilidade com produção.
export const PROMO_MEDIA_SETTING_KEY = 'promo_video';
export const PROMO_MEDIA_BUCKET = 'promo-videos';

export type PromoMediaSetting = {
    setting_key: string;
    media_kind: PromoMediaKind;
    source_url: string;
    storage_path: string | null;
    updated_at: string | null;
    updated_by: string | null;
};

export type ResolvedPromoMedia = {
    mediaKind: PromoMediaKind;
    mediaUrl: string;
};

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(\?.*)?$/i;

export const getDefaultPromoMedia = (): ResolvedPromoMedia => ({
    mediaKind: DEFAULT_PROMO_MEDIA_KIND,
    mediaUrl: DEFAULT_PROMO_IMAGE_URL
});

export const resolvePromoMediaUrl = (kind?: PromoMediaKind | null, sourceUrl?: string | null) => {
    const trimmed = sourceUrl?.trim();
    if (trimmed) return trimmed;
    return kind === 'video' ? DEFAULT_PROMO_VIDEO_URL : DEFAULT_PROMO_IMAGE_URL;
};

export const resolvePromoMedia = (setting?: Partial<PromoMediaSetting> | null): ResolvedPromoMedia => {
    const mediaKind = setting?.media_kind === 'video' ? 'video' : DEFAULT_PROMO_MEDIA_KIND;
    return {
        mediaKind,
        mediaUrl: resolvePromoMediaUrl(mediaKind, setting?.source_url)
    };
};

export const isExternalPromoMediaUrl = (sourceUrl?: string | null) =>
    /^https?:\/\//i.test(sourceUrl?.trim() || '');

export const isValidExternalPromoMediaUrl = (sourceUrl: string) => {
    try {
        const parsed = new URL(sourceUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const inferPromoMediaKindFromMime = (mime?: string | null): PromoMediaKind | null => {
    const normalized = (mime || '').toLowerCase().trim();
    if (!normalized) return null;
    if (normalized.startsWith('video/')) return 'video';
    if (normalized.startsWith('image/')) return 'image';
    return null;
};

export const inferPromoMediaKindFromUrl = (sourceUrl?: string | null): PromoMediaKind | null => {
    const normalized = (sourceUrl || '').trim();
    if (!normalized) return null;
    if (IMAGE_EXTENSION_PATTERN.test(normalized)) return 'image';
    if (VIDEO_EXTENSION_PATTERN.test(normalized)) return 'video';
    return null;
};

export const fetchPromoMediaSetting = async () => {
    const { data, error } = await supabase
        .from('site_media_settings')
        .select('setting_key, media_kind, source_url, storage_path, updated_at, updated_by')
        .eq('setting_key', PROMO_MEDIA_SETTING_KEY)
        .maybeSingle();

    if (error) throw error;
    return (data || null) as PromoMediaSetting | null;
};
