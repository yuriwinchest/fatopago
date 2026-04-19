import { describe, expect, it } from 'vitest';

import {
  isOpenPixPaymentStatus,
  isPixPaymentExpired,
} from '../../../supabase/functions/_shared/pixFlowGuards';

describe('pixFlowGuards', () => {
  it('reconhece status de pagamento PIX ainda aberto', () => {
    expect(isOpenPixPaymentStatus('pending')).toBe(true);
    expect(isOpenPixPaymentStatus('in_process')).toBe(true);
    expect(isOpenPixPaymentStatus('approved')).toBe(false);
    expect(isOpenPixPaymentStatus('cancelled')).toBe(false);
  });

  it('detecta expiração com base no expires_at', () => {
    expect(isPixPaymentExpired('2026-03-29T12:00:00.000Z', Date.parse('2026-03-29T12:00:01.000Z'))).toBe(true);
    expect(isPixPaymentExpired('2026-03-29T12:00:00.000Z', Date.parse('2026-03-29T11:59:59.000Z'))).toBe(false);
    expect(isPixPaymentExpired(null, Date.parse('2026-03-29T12:00:01.000Z'))).toBe(false);
  });
});
