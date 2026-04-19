import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PROMO_IMAGE_URL,
    inferPromoMediaKindFromUrl,
    isExternalPromoMediaUrl,
    isValidExternalPromoMediaUrl,
    resolvePromoMedia
} from '../promoMedia';

describe('promoMedia helpers', () => {
    it('falls back to the bundled image when setting is empty', () => {
        expect(resolvePromoMedia(null)).toEqual({
            mediaKind: 'image',
            mediaUrl: DEFAULT_PROMO_IMAGE_URL
        });
    });

    it('keeps a configured video source when available', () => {
        expect(resolvePromoMedia({
            media_kind: 'video',
            source_url: 'https://cdn.example.com/promo.mp4'
        })).toEqual({
            mediaKind: 'video',
            mediaUrl: 'https://cdn.example.com/promo.mp4'
        });
    });

    it('detects external URLs correctly', () => {
        expect(isExternalPromoMediaUrl('https://cdn.example.com/promo.mp4')).toBe(true);
        expect(isExternalPromoMediaUrl('http://cdn.example.com/promo.mp4')).toBe(true);
        expect(isExternalPromoMediaUrl('/vidoes/video01.mp4')).toBe(false);
    });

    it('accepts only http and https external URLs', () => {
        expect(isValidExternalPromoMediaUrl('https://cdn.example.com/promo.mp4')).toBe(true);
        expect(isValidExternalPromoMediaUrl('http://cdn.example.com/promo.mp4')).toBe(true);
        expect(isValidExternalPromoMediaUrl('ftp://cdn.example.com/promo.mp4')).toBe(false);
        expect(isValidExternalPromoMediaUrl('/vidoes/video01.mp4')).toBe(false);
        expect(isValidExternalPromoMediaUrl('not-a-url')).toBe(false);
    });

    it('infers media kind by obvious file extension', () => {
        expect(inferPromoMediaKindFromUrl('https://cdn.example.com/banner.webp')).toBe('image');
        expect(inferPromoMediaKindFromUrl('https://cdn.example.com/promo.mp4')).toBe('video');
        expect(inferPromoMediaKindFromUrl('https://cdn.example.com/media')).toBeNull();
    });
});
