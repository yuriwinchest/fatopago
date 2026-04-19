import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { raiseSecurityAlert } from '../_shared/securityAlerts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

class WorkerPayloadError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ClaimedWithdrawal = {
  id: string
  user_id: string
  amount: number
  pix_key: string
  pix_key_type: string
  idempotency_key: string
  payout_attempts: number
  status: string
  external_payout_id?: string | null
  external_status?: string | null
}

const SUCCESS_STATUSES = new Set([
  'approved',
  'authorized',
  'completed',
  'processed',
  'succeeded',
  'success',
  'paid',
  'done',
])

const FAILED_STATUSES = new Set([
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

const STATUS_DETAIL_KEYS = ['status_detail', 'detail', 'message', 'error_message', 'cause']
const ALLOWED_WORKER_FIELDS = new Set(['limit'])

const parseNumberEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseWorkerPayload = async (req: Request) => {
  const rawBody = await req.text().catch(() => '')
  if (!rawBody.trim()) {
    return {}
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new WorkerPayloadError(400, 'Payload inválido')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WorkerPayloadError(400, 'Payload inválido')
  }

  const payload = body as Record<string, unknown>
  const keys = Object.keys(payload)
  for (const key of keys) {
    if (!ALLOWED_WORKER_FIELDS.has(key)) {
      throw new WorkerPayloadError(400, `Campo não permitido: ${key}`)
    }
  }

  const requestedLimitRaw = payload.limit
  if (requestedLimitRaw === undefined) {
    return {}
  }

  const requestedLimit = Number(requestedLimitRaw)
  if (!Number.isFinite(requestedLimit)) {
    throw new WorkerPayloadError(400, 'limit inválido')
  }

  return { limit: requestedLimit }
}

const sanitizeText = (value: unknown, max = 240) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > max ? text.slice(0, max) : text
}

const buildPayoutStatusUrl = (template: string, payoutId: string) => {
  const normalizedTemplate = sanitizeText(template, 320)
  const normalizedPayoutId = sanitizeText(payoutId, 120)

  if (!normalizedTemplate || !normalizedPayoutId) {
    return ''
  }

  if (normalizedTemplate.includes('{id}')) {
    return normalizedTemplate.replace('{id}', encodeURIComponent(normalizedPayoutId))
  }

  return `${normalizedTemplate.replace(/\/$/, '')}/${encodeURIComponent(normalizedPayoutId)}`
}

const extractPayoutId = (payload: any): string | null => {
  const candidates = [
    payload?.id,
    payload?.transfer_id,
    payload?.payout_id,
    payload?.data?.id,
    payload?.data?.transfer_id,
  ]

  for (const candidate of candidates) {
    const value = sanitizeText(candidate, 120)
    if (value) return value
  }

  return null
}

const extractStatus = (payload: any) => {
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

const extractFailureReason = (payload: any) => {
  for (const key of STATUS_DETAIL_KEYS) {
    const raw = payload?.[key] ?? payload?.data?.[key]
    const normalized = sanitizeText(raw, 240)
    if (normalized) return normalized
  }

  return 'Falha ao processar saque PIX no provedor externo'
}

const normalizePixKeyForProvider = ({
  pixKey,
  pixKeyType,
}: {
  pixKey: string
  pixKeyType: string
}) => {
  const normalizedType = sanitizeText(pixKeyType, 20).toLowerCase()
  const rawKey = sanitizeText(pixKey, 160)

  if (!rawKey || !normalizedType) {
    return { ok: false as const, reason: 'Chave PIX ausente' }
  }

  if (normalizedType === 'cpf' || normalizedType === 'cnpj') {
    const digits = rawKey.replace(/\D/g, '')
    if (digits.length !== 11 && digits.length !== 14) {
      return { ok: false as const, reason: 'Chave PIX CPF/CNPJ inválida para transferência' }
    }
    return {
      ok: true as const,
      pixKey: digits,
      pixKeyType: normalizedType,
    }
  }

  if (normalizedType === 'phone') {
    const digits = rawKey.replace(/\D/g, '')
    if (/^55\d{10,11}$/.test(digits)) {
      return {
        ok: true as const,
        pixKey: `+${digits}`,
        pixKeyType: normalizedType,
      }
    }
    if (/^\d{10,11}$/.test(digits)) {
      return {
        ok: true as const,
        pixKey: `+55${digits}`,
        pixKeyType: normalizedType,
      }
    }
    return { ok: false as const, reason: 'Telefone PIX inválido para transferência' }
  }

  if (normalizedType === 'email') {
    const email = rawKey.trim().toLowerCase()
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      return { ok: false as const, reason: 'E-mail PIX inválido para transferência' }
    }
    return {
      ok: true as const,
      pixKey: email,
      pixKeyType: normalizedType,
    }
  }

  if (normalizedType === 'random') {
    return {
      ok: true as const,
      pixKey: rawKey.trim().toLowerCase(),
      pixKeyType: normalizedType,
    }
  }

  return { ok: false as const, reason: 'Tipo de chave PIX não suportado para transferência' }
}

const parseJsonSafe = async (response: Response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    return await response.json().catch(() => null)
  }

  const text = await response.text().catch(() => '')
  return text ? { raw_text: text } : null
}

const isAuthAllowed = (req: Request, expectedWorkerToken: string) => {
  const tokenFromHeader = sanitizeText(req.headers.get('x-worker-token'))
  const tokenFromBearer = sanitizeText(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

  return [tokenFromHeader, tokenFromBearer].some(
    (token) => token && token === expectedWorkerToken
  )
}

const executeProviderRequest = async ({
  request,
  timeoutMs,
}: {
  request: (signal: AbortSignal) => Promise<Response>
  timeoutMs: number
}) => {
  let httpStatus = 0
  let responsePayload: any = null
  let networkError = ''

  try {
    const response = await withTimeout((signal) => request(signal), timeoutMs)
    httpStatus = response.status
    responsePayload = await parseJsonSafe(response)
  } catch (error) {
    networkError = sanitizeText((error as any)?.message || 'Falha de rede ao consultar o provedor', 240)
  }

  return {
    httpStatus,
    responsePayload,
    networkError,
  }
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

const alertOnWorker = async (
  supabase: ReturnType<typeof createClient>,
  input: Parameters<typeof raiseSecurityAlert>[1]
) => {
  await raiseSecurityAlert(supabase, input)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    const workerToken = Deno.env.get('WITHDRAWAL_WORKER_TOKEN') || ''
    const payoutsUrl = Deno.env.get('MERCADOPAGO_PAYOUTS_URL') || 'https://api.mercadopago.com/v1/transfers'
    const payoutStatusUrlTemplate =
      Deno.env.get('MERCADOPAGO_PAYOUTS_STATUS_URL_TEMPLATE') ||
      'https://api.mercadopago.com/v1/transfers/{id}'
    const timeoutMs = parseNumberEnv(Deno.env.get('MERCADOPAGO_PAYOUT_TIMEOUT_MS'), 15000)
    const defaultLimit = parseNumberEnv(Deno.env.get('WITHDRAWAL_WORKER_DEFAULT_LIMIT'), 20)
    const maxLimit = parseNumberEnv(Deno.env.get('WITHDRAWAL_WORKER_MAX_LIMIT'), 100)
    const maxRetryAttempts = Math.min(
      Math.max(Math.floor(parseNumberEnv(Deno.env.get('WITHDRAWAL_WORKER_MAX_RETRIES'), 8)), 1),
      100
    )

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Configuração Supabase ausente' }, 500)
    }
    if (!mpAccessToken) {
      return json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }, 500)
    }
    if (!workerToken) {
      return json({ error: 'WITHDRAWAL_WORKER_TOKEN não configurado' }, 500)
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    if (!isAuthAllowed(req, workerToken)) {
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:unauthorized_access',
        source: 'process_pending_withdrawals',
        category: 'auth',
        severity: 'critical',
        title: 'Tentativa não autorizada no worker de saques',
        message: 'O endpoint interno do worker de saques recebeu uma requisição sem credencial válida.',
        metadata: {
          has_authorization_header: Boolean(req.headers.get('authorization')),
          has_worker_header: Boolean(req.headers.get('x-worker-token')),
        },
      })
      return json({ error: 'Não autorizado' }, 401)
    }

    const payload = await parseWorkerPayload(req)
    const requestedLimit = Number.isFinite(payload.limit as number) ? Number(payload.limit) : defaultLimit
    const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), Math.max(1, Math.floor(maxLimit)))

    // Dead-letter guard: processing withdrawals stuck without provider id past retry threshold
    // are failed and compensated to avoid infinite queue loops.
    const { data: staleProcessingRows, error: staleProcessingError } = await supabase
      .from('pix_withdrawals')
      .select('id, payout_attempts')
      .eq('status', 'processing')
      .is('external_payout_id', null)
      .gte('payout_attempts', maxRetryAttempts)
      .limit(50)

    if (staleProcessingError) {
      console.error('stale processing query error:', staleProcessingError)
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:stale_processing_query_error',
        source: 'process_pending_withdrawals',
        category: 'withdrawal',
        severity: 'high',
        title: 'Falha ao consultar saques travados',
        message: 'O worker não conseguiu inspecionar saques presos em processing.',
        metadata: {
          error: String((staleProcessingError as any)?.message || staleProcessingError),
        },
      })
      return json({ error: 'Erro ao validar saques em loop' }, 500)
    }

    if ((staleProcessingRows || []).length > 0) {
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:dead_letter_detected',
        source: 'process_pending_withdrawals',
        category: 'withdrawal',
        severity: 'high',
        title: 'Saques atingiram limite de retry',
        message: 'O worker encontrou saques presos em processing e iniciou compensação por limite de tentativas.',
        metadata: {
          stale_count: (staleProcessingRows || []).length,
          retry_limit: maxRetryAttempts,
        },
      })
    }

    for (const stale of staleProcessingRows || []) {
      const { error: reconcileStaleError } = await supabase.rpc('reconcile_pix_withdrawal', {
        p_withdrawal_id: String((stale as any).id || ''),
        p_target_status: 'failed',
        p_external_payout_id: null,
        p_external_status: 'retry_limit_exceeded',
        p_failure_reason: `Limite de ${maxRetryAttempts} tentativas excedido sem confirmação do provedor`,
        p_external_response: {
          source: 'worker_dead_letter',
          payout_attempts: Number((stale as any).payout_attempts || 0),
        },
      })

      if (reconcileStaleError) {
        console.error('reconcile stale withdrawal error:', reconcileStaleError)
        await alertOnWorker(supabase, {
          eventKey: 'withdrawal_worker:dead_letter_reconcile_error',
          source: 'process_pending_withdrawals',
          category: 'withdrawal',
          severity: 'high',
          title: 'Falha ao compensar saque travado',
          message: 'O worker detectou dead-letter, mas a reconciliação do saque falhou.',
          metadata: {
            withdrawal_id: String((stale as any).id || ''),
            error: String((reconcileStaleError as any)?.message || reconcileStaleError),
          },
        })
      }
    }

    const { data: claimedRows, error: claimError } = await supabase.rpc('claim_pending_pix_withdrawals', {
      p_limit: limit,
      p_max_retries: maxRetryAttempts,
    })

    if (claimError) {
      console.error('claim_pending_pix_withdrawals rpc error:', claimError)
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:claim_rpc_error',
        source: 'process_pending_withdrawals',
        category: 'withdrawal',
        severity: 'high',
        title: 'Falha ao reservar saques pendentes',
        message: 'O worker não conseguiu reservar os saques pendentes para processamento.',
        metadata: {
          error: String((claimError as any)?.message || claimError),
        },
      })
      return json({ error: 'Erro ao carregar saques pendentes' }, 500)
    }

    const claimed = Array.isArray(claimedRows) ? (claimedRows as ClaimedWithdrawal[]) : []
    if (!claimed.length) {
      return json({
        ok: true,
        claimed: 0,
        completed: 0,
        failed: 0,
        processing: 0,
      })
    }

    const summary = {
      claimed: claimed.length,
      completed: 0,
      failed: 0,
      processing: 0,
      errors: 0,
    }

    const details: Array<Record<string, unknown>> = []

    for (const row of claimed) {
      const providerPayoutId = sanitizeText(row.external_payout_id, 120)
      if (providerPayoutId) {
        const payoutStatusUrl = buildPayoutStatusUrl(payoutStatusUrlTemplate, providerPayoutId)

        if (!payoutStatusUrl) {
          const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
            p_withdrawal_id: row.id,
            p_target_status: 'processing',
            p_external_payout_id: providerPayoutId,
            p_external_status: 'status_lookup_url_invalid',
            p_failure_reason: null,
            p_external_response: {
              source: 'worker_status_lookup',
              existing_external_status: row.external_status || null,
            },
          })

          if (reconcileError) {
            summary.errors += 1
            details.push({
              withdrawal_id: row.id,
              outcome: 'reconcile_error_on_status_lookup_url',
              error: String((reconcileError as any)?.message || reconcileError),
            })
            continue
          }

          summary.processing += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'processing_status_lookup_url_invalid',
            provider_status: row.external_status || 'status_lookup_url_invalid',
          })
          continue
        }

        const {
          httpStatus,
          responsePayload,
          networkError,
        } = await executeProviderRequest({
          request: (signal) =>
            fetch(payoutStatusUrl, {
              headers: {
                Authorization: `Bearer ${mpAccessToken}`,
              },
              signal,
            }),
          timeoutMs,
        })

        const providerStatus = extractStatus(responsePayload)
        const payoutId = extractPayoutId(responsePayload) || providerPayoutId

        if (networkError) {
          const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
            p_withdrawal_id: row.id,
            p_target_status: 'processing',
            p_external_payout_id: payoutId,
            p_external_status: 'status_lookup_unknown',
            p_failure_reason: null,
            p_external_response: {
              provider_http_status: httpStatus || null,
              provider_payload: responsePayload,
              lookup_error: networkError,
              source: 'worker_status_lookup',
            },
          })

          if (reconcileError) {
            summary.errors += 1
            details.push({
              withdrawal_id: row.id,
              outcome: 'reconcile_error_after_status_lookup_failure',
              error: String((reconcileError as any)?.message || reconcileError),
            })
            continue
          }

          summary.processing += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'processing_status_lookup_retry',
            provider_status: providerStatus || 'status_lookup_unknown',
          })
          continue
        }

        const isExplicitFailure = FAILED_STATUSES.has(providerStatus)
        const isExplicitSuccess = SUCCESS_STATUSES.has(providerStatus)

        if (isExplicitFailure) {
          const failureReason = extractFailureReason(responsePayload)
          const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
            p_withdrawal_id: row.id,
            p_target_status: 'failed',
            p_external_payout_id: payoutId,
            p_external_status: providerStatus || `http_${httpStatus}`,
            p_failure_reason: failureReason,
            p_external_response: {
              provider_http_status: httpStatus || null,
              provider_payload: responsePayload,
              source: 'worker_status_lookup',
            },
          })

          if (reconcileError) {
            summary.errors += 1
            details.push({
              withdrawal_id: row.id,
              outcome: 'reconcile_error_on_status_lookup_failed',
              error: String((reconcileError as any)?.message || reconcileError),
            })
            continue
          }

          summary.failed += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'failed_after_status_lookup',
            provider_status: providerStatus || `http_${httpStatus}`,
          })
          continue
        }

        if (isExplicitSuccess) {
          const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
            p_withdrawal_id: row.id,
            p_target_status: 'completed',
            p_external_payout_id: payoutId,
            p_external_status: providerStatus || 'completed',
            p_failure_reason: null,
            p_external_response: {
              provider_http_status: httpStatus || null,
              provider_payload: responsePayload,
              source: 'worker_status_lookup',
            },
          })

          if (reconcileError) {
            summary.errors += 1
            details.push({
              withdrawal_id: row.id,
              outcome: 'reconcile_error_on_status_lookup_completed',
              error: String((reconcileError as any)?.message || reconcileError),
            })
            continue
          }

          summary.completed += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'completed_after_status_lookup',
            provider_status: providerStatus,
          })
          continue
        }

        const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
          p_withdrawal_id: row.id,
          p_target_status: 'processing',
          p_external_payout_id: payoutId,
          p_external_status: providerStatus || `lookup_http_${httpStatus}`,
          p_failure_reason: null,
          p_external_response: {
            provider_http_status: httpStatus || null,
            provider_payload: responsePayload,
            source: 'worker_status_lookup',
          },
        })

        if (reconcileError) {
          summary.errors += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'reconcile_error_on_status_lookup_processing',
            error: String((reconcileError as any)?.message || reconcileError),
          })
          continue
        }

        summary.processing += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'processing_after_status_lookup',
          provider_status: providerStatus || `lookup_http_${httpStatus}`,
        })
        continue
      }

      const idempotencyKey = sanitizeText(row.idempotency_key || row.id, 120) || row.id
      const normalizedPixKey = normalizePixKeyForProvider({
        pixKey: row.pix_key,
        pixKeyType: row.pix_key_type,
      })

      if (!normalizedPixKey.ok) {
        await alertOnWorker(supabase, {
          eventKey: 'withdrawal_worker:invalid_pix_key',
          source: 'process_pending_withdrawals',
          category: 'withdrawal',
          severity: 'medium',
          title: 'Chave PIX inválida detectada no worker',
          message: 'Um saque foi bloqueado no worker porque a chave PIX não passou na normalização para o provedor.',
          metadata: {
            withdrawal_id: row.id,
            pix_key_type: row.pix_key_type,
            reason: normalizedPixKey.reason,
          },
        })
        const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
          p_withdrawal_id: row.id,
          p_target_status: 'failed',
          p_external_payout_id: null,
          p_external_status: 'invalid_pix_key',
          p_failure_reason: normalizedPixKey.reason,
          p_external_response: {
            reason: normalizedPixKey.reason,
            source: 'worker_payload_normalization',
          },
        })

        if (reconcileError) {
          summary.errors += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'reconcile_error_on_invalid_pix',
            error: String((reconcileError as any)?.message || reconcileError),
          })
          continue
        }

        summary.failed += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'failed',
          provider_status: 'invalid_pix_key',
        })
        continue
      }

      const payload = {
        amount: Number(row.amount),
        external_reference: `fatopago-withdrawal:${row.id}`,
        description: 'FatoPago - Saque PIX',
        pix_key: normalizedPixKey.pixKey,
        pix_key_type: normalizedPixKey.pixKeyType,
        metadata: {
          withdrawal_id: row.id,
          user_id: row.user_id,
        },
      }

      const { httpStatus, responsePayload, networkError } = await executeProviderRequest({
        request: (signal) =>
          fetch(payoutsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mpAccessToken}`,
              'X-Idempotency-Key': idempotencyKey,
            },
            signal,
            body: JSON.stringify(payload),
          }),
        timeoutMs,
      })

      const providerStatus = extractStatus(responsePayload)
      const payoutId = extractPayoutId(responsePayload)

      if (networkError) {
        const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
          p_withdrawal_id: row.id,
          p_target_status: 'processing',
          p_external_payout_id: payoutId,
          p_external_status: 'dispatch_unknown',
          p_failure_reason: null,
          p_external_response: {
            provider_http_status: httpStatus || null,
            provider_payload: responsePayload,
            dispatch_error: networkError,
          },
        })

        if (reconcileError) {
          summary.errors += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'reconcile_error_after_network_failure',
            error: String((reconcileError as any)?.message || reconcileError),
          })
          continue
        }

        summary.processing += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'processing_retry_scheduled',
          provider_status: providerStatus || 'dispatch_unknown',
        })
        continue
      }

      const isExplicitFailure = FAILED_STATUSES.has(providerStatus)
      const isExplicitSuccess = SUCCESS_STATUSES.has(providerStatus)
      const isClientFailureStatus = httpStatus >= 400 && httpStatus < 500 && httpStatus !== 409
      const shouldFail = isExplicitFailure || isClientFailureStatus

      if (shouldFail) {
        const failureReason = extractFailureReason(responsePayload)
        const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
          p_withdrawal_id: row.id,
          p_target_status: 'failed',
          p_external_payout_id: payoutId,
          p_external_status: providerStatus || `http_${httpStatus}`,
          p_failure_reason: failureReason,
          p_external_response: {
            provider_http_status: httpStatus || null,
            provider_payload: responsePayload,
          },
        })

        if (reconcileError) {
          summary.errors += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'reconcile_error_on_failed',
            error: String((reconcileError as any)?.message || reconcileError),
          })
          continue
        }

        summary.failed += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'failed',
          provider_status: providerStatus || `http_${httpStatus}`,
        })
        continue
      }

      if (isExplicitSuccess) {
        const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
          p_withdrawal_id: row.id,
          p_target_status: 'completed',
          p_external_payout_id: payoutId,
          p_external_status: providerStatus || 'completed',
          p_failure_reason: null,
          p_external_response: {
            provider_http_status: httpStatus || null,
            provider_payload: responsePayload,
          },
        })

        if (reconcileError) {
          summary.errors += 1
          details.push({
            withdrawal_id: row.id,
            outcome: 'reconcile_error_on_completed',
            error: String((reconcileError as any)?.message || reconcileError),
          })
          continue
        }

        summary.completed += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'completed',
          provider_status: providerStatus,
        })
        continue
      }

      const { error: reconcileError } = await supabase.rpc('reconcile_pix_withdrawal', {
        p_withdrawal_id: row.id,
        p_target_status: 'processing',
        p_external_payout_id: payoutId,
        p_external_status: providerStatus || `http_${httpStatus}`,
        p_failure_reason: null,
        p_external_response: {
          provider_http_status: httpStatus || null,
          provider_payload: responsePayload,
        },
      })

      if (reconcileError) {
        summary.errors += 1
        details.push({
          withdrawal_id: row.id,
          outcome: 'reconcile_error_on_processing',
          error: String((reconcileError as any)?.message || reconcileError),
        })
        continue
      }

      summary.processing += 1
      details.push({
        withdrawal_id: row.id,
        outcome: 'processing',
        provider_status: providerStatus || `http_${httpStatus}`,
      })
    }

    if (summary.failed >= 3) {
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:batch_failed_threshold',
        source: 'process_pending_withdrawals',
        category: 'withdrawal',
        severity: 'high',
        title: 'Lote de saques com falhas acima do normal',
        message: 'O worker registrou volume elevado de falhas em um único lote de saques PIX.',
        metadata: {
          claimed: summary.claimed,
          failed: summary.failed,
          completed: summary.completed,
          processing: summary.processing,
          errors: summary.errors,
        },
      })
    }

    if (summary.errors > 0) {
      await alertOnWorker(supabase, {
        eventKey: 'withdrawal_worker:internal_processing_errors',
        source: 'process_pending_withdrawals',
        category: 'withdrawal',
        severity: 'high',
        title: 'Erros internos no worker de saques',
        message: 'O worker finalizou o lote com erros internos de reconciliação ou persistência.',
        metadata: {
          claimed: summary.claimed,
          failed: summary.failed,
          completed: summary.completed,
          processing: summary.processing,
          errors: summary.errors,
        },
      })
    }

    return json({
      ok: true,
      ...summary,
      details,
    })
  } catch (err) {
    if (err instanceof WorkerPayloadError) {
      return json({ error: err.message }, err.status)
    }

    console.error('process-pending-withdrawals error:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
