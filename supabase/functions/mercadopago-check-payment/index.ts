import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { isApprovedPixPaymentStatus } from '../_shared/pixFlowGuards.ts'
import { getPlanExpiryAtByStart } from '../_shared/planPeriods.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_CREDIT_EPSILON = 0.009
const PIX_REVERSAL_STATUSES = new Set(['refunded', 'charged_back'])
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const FORBIDDEN_PAYMENT_FIELDS = new Set([
  'amount',
  'price',
  'transaction_amount',
  'plan_id',
  'user_id',
  'expected_amount',
])

const parseCheckPaymentPayload = async (req: Request) => {
  const raw = await req.text()
  if (!raw.trim()) {
    throw new HttpError(400, 'Payload inválido')
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'Payload inválido')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Payload inválido')
  }

  const payload = body as Record<string, unknown>
  const keys = Object.keys(payload)
  const unexpected = keys.filter((key) => key !== 'payment_id')
  if (unexpected.length > 0) {
    const blocked = unexpected.find((key) => FORBIDDEN_PAYMENT_FIELDS.has(key))
    if (blocked) {
      throw new HttpError(400, `Campo não permitido no checkout: ${blocked}`)
    }
    throw new HttpError(400, 'Payload inválido')
  }

  const paymentId = String(payload.payment_id ?? '').trim()
  if (!paymentId || !/^\d{6,30}$/.test(paymentId)) {
    throw new HttpError(400, 'ID do pagamento inválido')
  }

  return { paymentId }
}

const amountsMatch = (a: unknown, b: unknown) => {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false
  return Math.abs(na - nb) < 0.0001
}

const isPlanExhausted = (plan: Record<string, unknown> | null | undefined) => {
  if (!plan) return true

  const remaining = Number(plan.validation_credit_remaining ?? 0)
  if (Number.isFinite(remaining)) {
    return remaining <= PLAN_CREDIT_EPSILON
  }

  const used = Number(plan.used_validations ?? 0)
  const max = Number(plan.max_validations ?? 0)
  return max > 0 && used >= max
}

const getPlanExpiryAt = (planId: string, startedAt: string) => {
  return getPlanExpiryAtByStart(planId, startedAt)
}

const isPlanExpired = (plan: Record<string, unknown> | null | undefined, input = Date.now()) => {
  if (!plan?.plan_id || !plan?.started_at) return false
  const expiryMs = Date.parse(getPlanExpiryAt(String(plan.plan_id), String(plan.started_at)))
  return Number.isFinite(expiryMs) && input >= expiryMs
}

const enforceRateLimit = async ({
  supabase,
  subject,
  action,
  limit,
  windowSeconds,
}: {
  supabase: ReturnType<typeof createClient>
  subject: string
  action: string
  limit: number
  windowSeconds: number
}) => {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_subject: subject,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('rate limit rpc error:', error)
    throw new Error('Erro ao validar limite de requisição')
  }

  const row = Array.isArray(data) ? data[0] : data
  return Boolean((row as any)?.allowed)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    if (!mpAccessToken) {
      return json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }, 500)
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Não autorizado' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Token inválido' }, 401)
    }

    const allowedCheck = await enforceRateLimit({
      supabase,
      subject: String(user.id),
      action: 'mp_check_payment',
      limit: 600,
      windowSeconds: 600,
    })
    if (!allowedCheck) {
      return json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429)
    }

    const { error: expireStaleError } = await supabase.rpc('expire_stale_pix_payments', {
      p_limit: 120,
    })
    if (expireStaleError) {
      console.error('expire_stale_pix_payments rpc error:', expireStaleError)
    }

    const { paymentId } = await parseCheckPaymentPayload(req)

    // Check payment status with Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      return json({ error: 'Erro ao verificar pagamento' }, 500)
    }

    // Update payment record in database
    const newStatus = String(mpData.status || '') // 'approved', 'pending', 'rejected', etc.

    const { data: paymentRecord, error: paymentError } = await supabase
      .from('pix_payments')
      .select('*')
      .eq('mp_payment_id', paymentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (paymentError) {
      console.error('pix_payments fetch error:', paymentError)
      return json({ error: 'Erro ao localizar pagamento' }, 500)
    }
    if (!paymentRecord) {
      return json({ error: 'Pagamento não encontrado' }, 404)
    }

    // Prevent "pay less, get more" by validating MP response against stored record.
    const metaUserId = String((mpData as any)?.metadata?.user_id || '')
    const metaPlanId = String((mpData as any)?.metadata?.plan_id || '')
    const externalRef = String((mpData as any)?.external_reference || '')
    const mpAmount = (mpData as any)?.transaction_amount

    const planId = String(paymentRecord.plan_id || '')
    const quotedAmount = Number(paymentRecord.amount)
    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
      console.error('PIX check: invalid stored quoted amount', {
        planId,
        storedAmount: paymentRecord.amount,
      })
      return json({ error: 'Pagamento inválido' }, 409)
    }

    const expectedExternalRef = `fatopago:${user.id}:${planId}`
    const hasValidMeta =
      Boolean(metaUserId && metaPlanId) &&
      metaUserId === user.id &&
      metaPlanId === planId
    const hasValidExternalRef = Boolean(externalRef) && externalRef === expectedExternalRef

    if (!hasValidMeta && !hasValidExternalRef) {
      console.error('PIX check: payment identity mismatch', {
        metaUserId,
        metaPlanId,
        externalRef,
        expectedExternalRef,
      })
      return json({ error: 'Pagamento inválido' }, 409)
    }
    if (!amountsMatch(mpAmount, quotedAmount)) {
      console.error('PIX check: amount mismatch', { mpAmount, quotedAmount })
      return json({ error: 'Pagamento inválido' }, 409)
    }

    if (paymentRecord.status !== newStatus) {
      await supabase
        .from('pix_payments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', paymentRecord.id)
    }

    const wasSuperseded = Boolean((paymentRecord as any)?.superseded_at)
    if (wasSuperseded) {
      return json({
        payment_id: mpData.id,
        status: newStatus,
        status_detail: isApprovedPixPaymentStatus(newStatus)
          ? 'Pagamento substituído por um PIX mais recente'
          : (mpData.status_detail || 'Pagamento substituído por um PIX mais recente'),
      })
    }

    if (PIX_REVERSAL_STATUSES.has(newStatus)) {
      const { data: reversalResult, error: reversalError } = await supabase.rpc('process_pix_payment_reversal', {
        p_mp_payment_id: paymentId,
        p_reversal_status: newStatus,
        p_reversal_reason: String(mpData?.status_detail || ''),
      })

      if (reversalError) {
        console.error('process_pix_payment_reversal rpc error:', reversalError)
        return json({ error: 'Erro ao processar estorno do pagamento' }, 500)
      }

      const reversalStatus = String((reversalResult as any)?.status || '')
      if (!['reversed', 'already_processed', 'recorded_without_activation'].includes(reversalStatus)) {
        console.error('process_pix_payment_reversal unexpected status:', reversalResult)
        return json({ error: 'Erro ao processar estorno do pagamento' }, 409)
      }
    }

    // If payment approved and plan not yet activated, activate it (idempotent)
    const alreadyActivated = Boolean((paymentRecord as any).plan_activated_at)
    if (newStatus === 'approved' && !alreadyActivated) {
      const now = new Date().toISOString()

      // If user already has an active plan, don't create a duplicate purchase
      // If user already has an active plan, check if it's exhausted
      let { data: existingActive } = await supabase
        .from('plan_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (existingActive && (isPlanExhausted(existingActive as Record<string, unknown>) || isPlanExpired(existingActive as Record<string, unknown>, Date.now()))) {
         await supabase
          .from('plan_purchases')
          .update({ status: 'completed', completed_at: now, updated_at: now })
          .eq('id', existingActive.id)
         
         existingActive = null
      }

      if (!existingActive) {
        const { data: activationResult, error: activationError } = await supabase.rpc('activate_pix_payment', {
          p_mp_payment_id: paymentId,
          p_user_id: user.id,
        })

        if (activationError) {
          console.error('activate_pix_payment rpc error:', activationError)
          return json({ error: 'Erro ao ativar pagamento' }, 500)
        }

        const activationStatus = String((activationResult as any)?.status || '')
        if (!['activated', 'already_activated', 'superseded'].includes(activationStatus)) {
          console.error('activate_pix_payment unexpected status:', activationResult)
          return json({ error: 'Erro ao ativar pagamento' }, 409)
        }
      }
    }

    return json({
      payment_id: mpData.id,
      status: newStatus,
      status_detail: mpData.status_detail,
    })

  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status)
    }

    console.error('Function error:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
