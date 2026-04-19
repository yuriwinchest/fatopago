import { describe, expect, it } from 'vitest';
import {
    buildSellerFunnelDedupKey,
    getSellerFunnelEventLabel,
    getSellerFunnelEventTone
} from '../sellerFunnel';

describe('sellerFunnel helpers', () => {
    it('normaliza a chave de deduplicação por código e evento', () => {
        expect(buildSellerFunnelDedupKey(' vndabc123 ', 'invite_visit')).toBe(
            'seller-funnel.dedup.VNDABC123:invite_visit'
        );
    });

    it('mapeia labels e tons dos eventos do funil', () => {
        expect(getSellerFunnelEventLabel('pix_approved')).toBe('Compra aprovada');
        expect(getSellerFunnelEventTone('register_completed')).toContain('purple');
    });
});
