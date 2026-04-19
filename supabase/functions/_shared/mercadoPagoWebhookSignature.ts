type WebhookSignatureResult =
  | { ok: true; ts: string; expected: string; provided: string }
  | { ok: false; reason: 'missing_secret' | 'missing_headers' | 'invalid_signature_header' | 'stale_timestamp' | 'invalid_signature' }

const encoder = new TextEncoder()

const parseSignatureHeader = (signatureHeader: string) => {
  const values = new Map<string, string>()

  for (const segment of signatureHeader.split(',')) {
    const [rawKey, rawValue] = segment.split('=', 2)
    const key = String(rawKey || '').trim().toLowerCase()
    const value = String(rawValue || '').trim()
    if (key && value) {
      values.set(key, value)
    }
  }

  const ts = values.get('ts') || ''
  const v1 = values.get('v1') || ''
  if (!ts || !v1) return null

  return { ts, v1: v1.toLowerCase() }
}

const toHex = (buffer: ArrayBuffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false

  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }

  return diff === 0
}

const SIGNATURE_MAX_AGE_SECONDS = 15 * 60
const SIGNATURE_FUTURE_SKEW_SECONDS = 60

export const buildMercadoPagoWebhookManifest = (dataId: string, requestId: string, ts: string) => {
  return `id:${dataId.trim().toLowerCase()};request-id:${requestId.trim()};ts:${ts.trim()};`
}

export const verifyMercadoPagoWebhookSignature = async ({
  secret,
  signatureHeader,
  requestId,
  dataId,
}: {
  secret: string
  signatureHeader: string
  requestId: string
  dataId: string
}): Promise<WebhookSignatureResult> => {
  const normalizedSecret = String(secret || '').trim()
  if (!normalizedSecret) {
    return { ok: false, reason: 'missing_secret' }
  }

  const normalizedSignatureHeader = String(signatureHeader || '').trim()
  const normalizedRequestId = String(requestId || '').trim()
  const normalizedDataId = String(dataId || '').trim().toLowerCase()

  if (!normalizedSignatureHeader || !normalizedRequestId || !normalizedDataId) {
    return { ok: false, reason: 'missing_headers' }
  }

  const signature = parseSignatureHeader(normalizedSignatureHeader)
  if (!signature) {
    return { ok: false, reason: 'invalid_signature_header' }
  }

  const tsSeconds = Number(signature.ts)
  if (!Number.isFinite(tsSeconds)) {
    return { ok: false, reason: 'invalid_signature_header' }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const ageSeconds = nowSeconds - Math.floor(tsSeconds)
  if (ageSeconds > SIGNATURE_MAX_AGE_SECONDS || ageSeconds < -SIGNATURE_FUTURE_SKEW_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  const manifest = buildMercadoPagoWebhookManifest(normalizedDataId, normalizedRequestId, signature.ts)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signed = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(manifest))
  const expectedSignature = toHex(signed)

  if (!timingSafeEqual(expectedSignature, signature.v1)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  return {
    ok: true,
    ts: signature.ts,
    expected: expectedSignature,
    provided: signature.v1,
  }
}
