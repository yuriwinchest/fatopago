import { describe, expect, it } from 'vitest';

import {
  buildMercadoPagoWebhookManifest,
  verifyMercadoPagoWebhookSignature,
} from '../../../supabase/functions/_shared/mercadoPagoWebhookSignature';

const signManifest = async (secret: string, manifest: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const buildCurrentTimestamp = () => String(Math.floor(Date.now() / 1000));

describe('mercadoPagoWebhookSignature', () => {
  it('monta o manifesto esperado para validação do webhook', () => {
    expect(buildMercadoPagoWebhookManifest('123456', 'req-789', '1711730000')).toBe(
      'id:123456;request-id:req-789;ts:1711730000;'
    );
  });

  it('valida a assinatura HMAC-SHA256 correta', async () => {
    const secret = 'webhook-secret';
    const ts = buildCurrentTimestamp();
    const manifest = buildMercadoPagoWebhookManifest('123456', 'req-789', ts);
    const signature = await signManifest(secret, manifest);

    const result = await verifyMercadoPagoWebhookSignature({
      secret,
      signatureHeader: `ts=${ts},v1=${signature}`,
      requestId: 'req-789',
      dataId: '123456',
    });

    expect(result.ok).toBe(true);
  });

  it('rejeita assinatura incorreta', async () => {
    const ts = buildCurrentTimestamp();
    const result = await verifyMercadoPagoWebhookSignature({
      secret: 'webhook-secret',
      signatureHeader: `ts=${ts},v1=deadbeef`,
      requestId: 'req-789',
      dataId: '123456',
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });
});
