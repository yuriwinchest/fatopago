import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { verifyMercadoPagoWebhookSignature } from '../_shared/mercadoPagoWebhookSignature.ts'
import { isApprovedPixPaymentStatus } from '../_shared/pixFlowGuards.ts'
import { raiseSecurityAlert } from '../_shared/securityAlerts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PIX_REVERSAL_STATUSES = new Set(['refunded', 'charged_back'])
const PAYMENT_ID_PATTERN = /^\d{6,30}$/
const RESOURCE_ID_SAFE_PATTERN = /^[A-Za-z0-9:_-]{4,120}$/

const parseNumberEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const WITHDRAWAL_SUCCESS_STATUSES = new Set([
  'approved',
  'authorized',
  'completed',
  'processed',
  'succeeded',
  'success',
  'paid',
  'done',
])

const WITHDRAWAL_FAILED_STATUSES = new Set([
  'failed',
  'rejected',
  'cancelled',
  'canceled',
  'error',
  'expired',
  'denied',
  'refunded',
  'charged_back',
])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sanitizeText = (value: unknown, max = 240) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > max ? text.slice(0, max) : text
}

const withTimeout = async (fn: (signal: AbortSignal) => Promise<Response>, timeoutMs: number) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs)

  try {
    return await fn(controller.signal).then((response) => {
      clearTimeout(timeout)
      return response
    })
  } finally {
    clearTimeout(timeout)
  }
}

const parsePayload = (rawBody: string) => {
  const trimmed = rawBody.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

const amountsMatch = (a: unknown, b: unknown) => {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false
  return Math.abs(na - nb) < 0.0001
}

const getEventHint = (url: URL, payload: any) => {
  const parts = [
    url.searchParams.get('topic'),
    url.searchParams.get('type'),
    url.searchParams.get('action'),
    payload?.type,
    payload?.topic,
    payload?.action,
    payload?.event,
  ]

  return parts
    .map((value) => sanitizeText(value, 80).toLowerCase())
    .filter(Boolean)
    .join(':')
}

const extractResourceId = (url: URL, payload: any): string | null => {
  const candidates = [
    url.searchParams.get('data.id'),
    url.searchParams.get('payment_id'),
    url.searchParams.get('id'),
    payload?.data?.id,
    payload?.id,
    payload?.resource?.id,
  ]

  for (const candidate of candidates) {
    const normalized = sanitizeText(candidate, 120)
    if (normalized) return normalized
  }

  return null
}

const extractWithdrawalId = (payload: any): string | null => {
  const directCandidates = [
    payload?.metadata?.withdrawal_id,
    payload?.data?.metadata?.withdrawal_id,
    payload?.withdrawal_id,
    payload?.data?.withdrawal_id,
  ]

  for (const candidate of directCandidates) {
    const normalized = sanitizeText(candidate, 80)
    if (normalized) return normalized
  }

  const refs = [
    sanitizeText(payload?.external_reference, 160),
    sanitizeText(payload?.data?.external_reference, 160),
    sanitizeText(payload?.metadata?.external_reference, 160),
    sanitizeText(payload?.data?.metadata?.external_reference, 160),
  ]

  for (const ref of refs) {
    if (!ref) continue
    if (ref.startsWith('fatopago-withdrawal:')) {
      const id = sanitizeText(ref.replace('fatopago-withdrawal:', ''), 80)
      if (id) return id
    }
  }

  return null
}

const extractWithdrawalStatus = (payload: any) => {
  const raw = sanitizeText(
    payload?.status ||
      payload?.transfer_status ||
      payload?.state ||
      payload?.status_detail ||
      payload?.data?.status ||
      payload?.data?.transfer_status ||
      payload?.data?.state
  )
  return raw.toLowerCase()
}

const extractPayoutId = (payload: any) => {
  const candidates = [
    payload?.id,
    payload?.transfer_id,
    payload?.payout_id,
    payload?.data?.id,
    payload?.data?.transfer_id,
  ]

  for (const candidate of candidates) {
    const normalized = sanitizeText(candidate, 120)
    if (normalized) return normalized
  }

  return null
}

const extractFailureReason = (payload: any) => {
  const keys = ['status_detail', 'detail', 'message', 'error_message', 'cause']
  for (const key of keys) {
    const direct = sanitizeText(payload?.[key], 240)
    if (direct) return direct

    const nested = sanitizeText(payload?.data?.[key], 240)
    if (nested) return nested
  }
  return 'Falha ao processar saque PIX no provedor externo'
}

const fetchJsonSafe = async (url: string, accessToken: string, timeoutMs: number) => {
  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      }),
    timeoutMs
  )

  const payload = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, payload }
}

const alertOnWebhook = async (
  supabase: ReturnType<typeof createClient>,
  input: Parameters<typeof raiseSecurityAlert>[1]
) => {
  await raiseSecurityAlert(supabase, input)
}

const maybeHandleWithdrawalWebhook = async ({
  eventHint,
  resourceId,
  payload,
  supabase,
  mpAccessToken,
  payoutStatusUrlTemplate,
  webhookTimeoutMs,
  raiseAlert,
}: {
  eventHint: string
  resourceId: string
  payload: any
  supabase: ReturnType<typeof createClient>
  mpAccessToken: string
  payoutStatusUrlTemplate: string
  webhookTimeoutMs: number
  raiseAlert: (input: Parameters<typeof raiseSecurityAlert>[1]) => Promise<void>
}) => {
  const likelyWithdrawalEvent =
    eventHint.includes('transfer') ||
    eventHint.includes('withdraw') ||
    eventHint.includes('payout')

  let snapshot = payload
  let withdrawalId = extractWithdrawalId(snapshot)
  let status = extractWithdrawalStatus(snapshot)

  if ((likelyWithdrawalEvent || withdrawalId) && (!withdrawalId || !status)) {
    const statusUrl = payoutStatusUrlTemplate.replace('{id}', encodeURIComponent(resourceId))
    const externalLookup = await fetchJsonSafe(statusUrl, mpAccessToken, webhookTimeoutMs)

    if (externalLookup.ok && externalLookup.payload) {
      snapshot = externalLookup.payload
      withdrawalId = withdrawalId || extractWithdrawalId(snapshot)
      status = status || extractWithdrawalStatus(snapshot)
    }
  }

  if (!withdrawalId) {
    return { handled: false as const }
  }

  const normalizedStatus = status || 'processing'
  const payoutId = extractPayoutId(snapshot) || resourceId
  const failureReason = extractFailureReason(snapshot)

  let targetStatus: 'processing' | 'completed' | 'failed' = 'processing'
  if (WITHDRAWAL_SUCCESS_STATUSES.has(normalizedStatus)) {
    targetStatus = 'completed'
  } else if (WITHDRAWAL_FAILED_STATUSES.has(normalizedStatus)) {
    targetStatus = 'failed'
  }

  const { data: reconcileResult, error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_target_status: targetStatus,
    p_external_payout_id: payoutId,
    p_external_status: normalizedStatus,
    p_failure_reason: targetStatus === 'failed' ? failureReason : null,
    p_external_response: snapshot ?? {},
  })

  if (reconcileError) {
    console.error('reconcile_pix_withdrawal rpc error:', reconcileError)
    await raiseAlert({
      eventKey: 'webhook:withdrawal_reconcile_error',
      source: 'mercadopago_webhook',
      category: 'withdrawal',
      severity: 'high',
      title: 'Falha ao reconciliar saque via webhook',
      message: 'O webhook recebeu atualização de saque, mas a reconciliação no banco falhou.',
      metadata: {
        resource_id: resourceId,
        withdrawal_id: withdrawalId,
        event_hint: eventHint,
        error: String((reconcileError as any)?.message || reconcileError),
      },
    })
    return { handled: true as const, error: 'Erro ao reconciliar saque' }
  }

  return {
    handled: true as const,
    status: normalizedStatus,
    target_status: targetStatus,
    reconcile_status: String((reconcileResult as any)?.status || ''),
    withdrawal_id: withdrawalId,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    if (!mpAccessToken) return json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }, 500)

    const expectedToken = Deno.env.get('MERCADOPAGO_WEBHOOK_TOKEN') || ''
    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') || ''
    const payoutStatusUrlTemplate =
      Deno.env.get('MERCADOPAGO_PAYOUTS_STATUS_URL_TEMPLATE') ||
      'https://api.mercadopago.com/v1/transfers/{id}'
    const webhookTimeoutMs = parseNumberEnv(Deno.env.get('MERCADOPAGO_WEBHOOK_TIMEOUT_MS'), 12000)
    const allowInsecureTokenOnly =
      String(Deno.env.get('MERCADOPAGO_WEBHOOK_ALLOW_INSECURE_TOKEN_ONLY') || '').trim().toLowerCase() === 'true'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const providedToken = url.searchParams.get('token') || ''
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || ''
    if (!expectedToken || providedToken !== expectedToken) {
      await alertOnWebhook(supabase, {
        eventKey: 'webhook:invalid_token',
        source: 'mercadopago_webhook',
        category: 'auth',
        severity: 'critical',
        title: 'Tentativa não autorizada no webhook',
        message: 'A rota do webhook recebeu requisição com token ausente ou inválido.',
        metadata: {
          request_id: requestId || null,
          has_expected_token: Boolean(expectedToken),
          provided_token_present: Boolean(providedToken),
        },
      })
      return json({ error: 'Não autorizado' }, 401)
    }

    const rawBody = await req.text()
    const payload = parsePayload(rawBody)
    const resourceId = extractResourceId(url, payload)
    if (!resourceId) {
      await alertOnWebhook(supabase, {
        eventKey: 'webhook:missing_resource_id',
        source: 'mercadopago_webhook',
        category: 'payload',
        severity: 'high',
        title: 'Webhook com recurso inválido',
        message: 'O webhook recebeu payload sem identificador de recurso utilizável.',
        metadata: {
          request_id: requestId || null,
          raw_body_present: rawBody.trim().length > 0,
        },
      })
      return json({ error: 'ID do recurso inválido' }, 400)
    }
    if (!RESOURCE_ID_SAFE_PATTERN.test(resourceId)) {
      await alertOnWebhook(supabase, {
        eventKey: 'webhook:unsafe_resource_id',
        source: 'mercadopago_webhook',
        category: 'payload',
        severity: 'high',
        title: 'Webhook com resource_id fora do padrão',
        message: 'O webhook recebeu um resource_id fora do padrão esperado e a requisição foi bloqueada.',
        metadata: {
          request_id: requestId || null,
          resource_id: resourceId,
        },
      })
      return json({ error: 'ID do recurso inválido' }, 400)
    }

    if (!webhookSecret.trim() && !allowInsecureTokenOnly) {
      console.error('MERCADOPAGO_WEBHOOK_SECRET ausente com modo estrito ativo')
      await alertOnWebhook(supabase, {
        eventKey: 'webhook:missing_signature_secret',
        source: 'mercadopago_webhook',
        category: 'configuration',
        severity: 'critical',
        title: 'Webhook sem segredo de assinatura',
        message: 'O webhook entrou em modo estrito sem MERCADOPAGO_WEBHOOK_SECRET configurado.',
        metadata: {
          request_id: requestId || null,
          resource_id: resourceId,
        },
      })
      return json({ error: 'Webhook secret não configurado' }, 500)
    }

    if (webhookSecret.trim()) {
      const signatureValidation = await verifyMercadoPagoWebhookSignature({
        secret: webhookSecret,
        signatureHeader: req.headers.get('x-signature') || '',
        requestId,
        dataId: resourceId,
      })

      if (!signatureValidation.ok) {
        console.error('Mercado Pago webhook signature error:', {
          reason: signatureValidation.reason,
          resourceId,
        })
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:invalid_signature',
          source: 'mercadopago_webhook',
          category: 'auth',
          severity: 'critical',
          title: 'Assinatura inválida no webhook',
          message: 'Uma requisição ao webhook falhou na validação criptográfica da assinatura.',
          metadata: {
            request_id: requestId || null,
            resource_id: resourceId,
            reason: signatureValidation.reason,
          },
        })
        return json({ error: 'Assinatura do webhook inválida' }, 403)
      }
    } else if (allowInsecureTokenOnly) {
      console.warn('Webhook operando em modo inseguro controlado (token-only). Configure MERCADOPAGO_WEBHOOK_SECRET.')
    }

    // Replay protection: one webhook request-id can only be processed once.
    if (requestId.trim()) {
      const { error: receiptInsertError } = await supabase
        .from('mercadopago_webhook_receipts')
        .insert({
          request_id: requestId.trim(),
          payment_id: resourceId,
        })

      if (receiptInsertError) {
        if (String((receiptInsertError as any)?.code || '') === '23505') {
          return json({ ok: true, duplicate: true })
        }

        console.error('Mercado Pago webhook receipt error:', receiptInsertError)
        return json({ error: 'Erro ao registrar webhook' }, 500)
      }
    }

    const eventHint = getEventHint(url, payload)
    const withdrawalResult = await maybeHandleWithdrawalWebhook({
      eventHint,
      resourceId,
      payload,
      supabase,
      mpAccessToken,
      payoutStatusUrlTemplate,
      webhookTimeoutMs,
      raiseAlert: (input) => alertOnWebhook(supabase, input),
    })

    if (withdrawalResult.handled) {
      if ((withdrawalResult as any).error) {
        return json({ error: (withdrawalResult as any).error }, 500)
      }
      return json({ ok: true, flow: 'withdrawal', ...withdrawalResult })
    }

    if (eventHint.includes('transfer') || eventHint.includes('withdraw') || eventHint.includes('payout')) {
      return json({
        ok: true,
        ignored: true,
        reason: 'withdrawal_event_without_reference',
      })
    }

    if (!PAYMENT_ID_PATTERN.test(resourceId)) {
      return json({
        ok: true,
        ignored: true,
        reason: 'invalid_payment_resource_id',
      })
    }

    const paymentLookup = await fetchJsonSafe(
      `https://api.mercadopago.com/v1/payments/${resourceId}`,
      mpAccessToken,
      webhookTimeoutMs
    )
    const mpData: any = paymentLookup.payload
    if (!paymentLookup.ok || !mpData?.id) {
      console.error('Mercado Pago webhook fetch error:', mpData)
      await alertOnWebhook(supabase, {
        eventKey: 'webhook:payment_lookup_error',
        source: 'mercadopago_webhook',
        category: 'payment',
        severity: 'high',
        title: 'Falha ao consultar pagamento no webhook',
        message: 'O webhook não conseguiu consultar o pagamento no Mercado Pago.',
        metadata: {
          request_id: requestId || null,
          resource_id: resourceId,
          provider_status: paymentLookup.status,
        },
      })
      return json({ error: 'Erro ao verificar pagamento' }, 500)
    }

    const newStatus = String(mpData.status || '')
    const now = new Date().toISOString()
    const { data: paymentRecord } = await supabase
      .from('pix_payments')
      .select('*')
      .eq('mp_payment_id', String(mpData.id))
      .maybeSingle()

    if (paymentRecord) {
      // Validate metadata + amount before updating/activating.
      const metaUserId = String((mpData as any)?.metadata?.user_id || '')
      const metaPlanId = String((mpData as any)?.metadata?.plan_id || '')
      const externalRef = String((mpData as any)?.external_reference || '')
      const mpAmount = (mpData as any)?.transaction_amount

      const planId = String(paymentRecord.plan_id || '')
      const quotedAmount = Number(paymentRecord.amount)
      if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
        console.error('PIX webhook: invalid stored quoted amount', {
          planId,
          storedAmount: paymentRecord.amount,
        })
        return json({ error: 'Pagamento inválido' }, 409)
      }

      const recordUserId = String(paymentRecord.user_id || '')
      const expectedExternalRef = `fatopago:${recordUserId}:${planId}`
      const hasValidMeta =
        Boolean(metaUserId && metaPlanId) &&
        metaUserId === recordUserId &&
        metaPlanId === planId
      const hasValidExternalRef = Boolean(externalRef) && externalRef === expectedExternalRef

      if (!hasValidMeta && !hasValidExternalRef) {
        console.error('PIX webhook: payment identity mismatch', {
          metaUserId,
          metaPlanId,
          externalRef,
          expectedExternalRef,
        })
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_identity_mismatch',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'critical',
          title: 'Divergência de identidade em pagamento PIX',
          message: 'O webhook bloqueou um pagamento cujo metadata/external_reference não bate com o registro interno.',
          metadata: {
            resource_id: resourceId,
            meta_user_id: metaUserId || null,
            meta_plan_id: metaPlanId || null,
            expected_external_reference: expectedExternalRef,
            external_reference: externalRef || null,
          },
        })
        return json({ error: 'Pagamento inválido' }, 409)
      }
      if (!amountsMatch(mpAmount, quotedAmount)) {
        console.error('PIX webhook: amount mismatch', { mpAmount, quotedAmount })
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_amount_mismatch',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'critical',
          title: 'Divergência de valor em pagamento PIX',
          message: 'O webhook bloqueou um pagamento com valor diferente do valor imutável salvo no banco.',
          metadata: {
            resource_id: resourceId,
            mp_amount: Number(mpAmount),
            quoted_amount: quotedAmount,
          },
        })
        return json({ error: 'Pagamento inválido' }, 409)
      }

      await supabase
        .from('pix_payments')
        .update({ status: newStatus, updated_at: now })
        .eq('id', paymentRecord.id)
    }

    if (paymentRecord && (paymentRecord as any).superseded_at) {
      if (isApprovedPixPaymentStatus(newStatus)) {
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:superseded_pix_paid',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'high',
          title: 'PIX substituído recebeu pagamento',
          message: 'Um PIX já substituído foi pago depois da geração de um checkout mais recente. A ativação foi bloqueada.',
          metadata: {
            resource_id: resourceId,
            user_id: String(paymentRecord.user_id || ''),
            plan_id: String(paymentRecord.plan_id || ''),
            superseded_at: (paymentRecord as any).superseded_at,
            superseded_by_mp_payment_id: (paymentRecord as any).superseded_by_mp_payment_id || null,
          },
        })
      }

      return json({
        ok: true,
        flow: 'payment',
        status: newStatus,
        ignored: true,
        reason: 'superseded_payment',
      })
    }

    if (newStatus === 'approved' && paymentRecord) {
      const { data: activationResult, error: activationError } = await supabase.rpc('activate_pix_payment', {
        p_mp_payment_id: String(mpData.id),
        p_user_id: null,
      })

      if (activationError) {
        console.error('activate_pix_payment rpc error:', activationError)
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_activation_rpc_error',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'high',
          title: 'Falha ao ativar pagamento PIX',
          message: 'O webhook confirmou um pagamento aprovado, mas a ativação do plano falhou na RPC.',
          metadata: {
            resource_id: resourceId,
            error: String((activationError as any)?.message || activationError),
          },
        })
        return json({ error: 'Erro ao ativar pagamento' }, 500)
      }

      const activationStatus = String((activationResult as any)?.status || '')
      if (!['activated', 'already_activated', 'blocked_active_plan', 'superseded'].includes(activationStatus)) {
        console.error('activate_pix_payment unexpected status:', activationResult)
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_activation_unexpected_status',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'high',
          title: 'Status inesperado na ativação PIX',
          message: 'A RPC de ativação retornou um status não previsto pelo fluxo seguro de pagamento.',
          metadata: {
            resource_id: resourceId,
            activation_status: activationStatus,
          },
        })
        return json({ error: 'Erro ao ativar pagamento' }, 409)
      }
    }

    if (paymentRecord && PIX_REVERSAL_STATUSES.has(newStatus)) {
      const { data: reversalResult, error: reversalError } = await supabase.rpc('process_pix_payment_reversal', {
        p_mp_payment_id: String(mpData.id),
        p_reversal_status: newStatus,
        p_reversal_reason: String((mpData as any)?.status_detail || ''),
      })

      if (reversalError) {
        console.error('process_pix_payment_reversal rpc error:', reversalError)
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_reversal_rpc_error',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'high',
          title: 'Falha ao processar estorno PIX',
          message: 'O webhook identificou estorno, mas a RPC de reversão falhou.',
          metadata: {
            resource_id: resourceId,
            reversal_status: newStatus,
            error: String((reversalError as any)?.message || reversalError),
          },
        })
        return json({ error: 'Erro ao processar estorno do pagamento' }, 500)
      }

      const reversalStatus = String((reversalResult as any)?.status || '')
      if (!['reversed', 'already_processed', 'recorded_without_activation'].includes(reversalStatus)) {
        console.error('process_pix_payment_reversal unexpected status:', reversalResult)
        await alertOnWebhook(supabase, {
          eventKey: 'webhook:payment_reversal_unexpected_status',
          source: 'mercadopago_webhook',
          category: 'payment',
          severity: 'high',
          title: 'Status inesperado no estorno PIX',
          message: 'A RPC de reversão retornou um status não previsto pelo fluxo seguro de estorno.',
          metadata: {
            resource_id: resourceId,
            reversal_status,
          },
        })
        return json({ error: 'Erro ao processar estorno do pagamento' }, 409)
      }
    }

    return json({ ok: true, flow: 'payment', status: newStatus })
  } catch (err) {
    console.error('Webhook error:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
