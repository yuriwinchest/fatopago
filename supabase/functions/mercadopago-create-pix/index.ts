import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { CheckoutPayloadError, parseCheckoutPayload } from '../_shared/checkoutPayloadGuards.ts'
import { isApprovedPixPaymentStatus, isOpenPixPaymentStatus, isPixPaymentExpired } from '../_shared/pixFlowGuards.ts'
import { getPlanExpiryAtByStart } from '../_shared/planPeriods.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_CREDIT_EPSILON = 0.009

type PlanPeriod = 'daily' | 'weekly' | 'monthly'

type CheckoutPlanRow = {
  plan_id: string
  display_name: string
  period: PlanPeriod
  price: number | string
  is_seller_exclusive: boolean
}

class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

type MercadoPagoApiResult = {
  ok: boolean
  status: number
  payload: any
}

const fetchMercadoPagoPayment = async (
  paymentId: string,
  accessToken: string
): Promise<MercadoPagoApiResult> => {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

const cancelMercadoPagoPayment = async (
  paymentId: string,
  accessToken: string
): Promise<MercadoPagoApiResult> => {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  })

  const payload = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

const updatePixPaymentRow = async (
  supabase: ReturnType<typeof createClient>,
  paymentId: string,
  patch: Record<string, unknown>
) => {
  const { error } = await supabase
    .from('pix_payments')
    .update(patch)
    .eq('id', paymentId)

  if (error) {
    console.error('pix_payments update error:', {
      paymentId,
      patch,
      error,
    })
    throw new Error('Erro ao atualizar pagamento PIX')
  }
}

const activateApprovedPixPayment = async (
  supabase: ReturnType<typeof createClient>,
  mpPaymentId: string,
  userId: string
) => {
  const { data: activationResult, error: activationError } = await supabase.rpc('activate_pix_payment', {
    p_mp_payment_id: mpPaymentId,
    p_user_id: userId,
  })

  if (activationError) {
    console.error('activate_pix_payment rpc error:', activationError)
    throw new HttpError(500, 'Erro ao ativar o pagamento aprovado anteriormente')
  }

  const activationStatus = String((activationResult as any)?.status || '')
  if (!['activated', 'already_activated', 'blocked_active_plan', 'superseded'].includes(activationStatus)) {
    console.error('activate_pix_payment unexpected status:', activationResult)
    throw new HttpError(409, 'Erro ao reconciliar o pagamento PIX anterior')
  }

  return activationStatus
}

const readCheckoutPayload = async (req: Request) => {
  const rawBody = await req.text()
  if (!rawBody.trim()) {
    throw new HttpError(400, 'Payload inválido')
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new HttpError(400, 'Payload inválido')
  }

  try {
    return parseCheckoutPayload(payload)
  } catch (error) {
    if (error instanceof CheckoutPayloadError) {
      throw new HttpError(error.status, error.message, error.details)
    }
    throw error
  }
}

const getCheckoutPlan = async (supabase: ReturnType<typeof createClient>, planId: string) => {
  const { data, error } = await supabase
    .from('plan_catalog')
    .select('plan_id, display_name, period, price, is_seller_exclusive')
    .eq('plan_id', planId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('Erro ao consultar o catálogo de planos')
  }

  if (!data) {
    throw new HttpError(400, 'Plano inexistente')
  }

  const price = Number(data.price)
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Catálogo de planos inválido')
  }

  return {
    ...(data as CheckoutPlanRow),
    price,
  }
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
    throw new HttpError(500, 'Erro ao validar limite de requisição')
  }

  const row = Array.isArray(data) ? data[0] : data
  const allowed = Boolean((row as any)?.allowed)
  if (!allowed) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
  }
}

const resolveSellerCampaignAccess = async (supabase: ReturnType<typeof createClient>, userId: string) => {
  const { data: directReferral, error: referralError } = await supabase
    .from('seller_referrals')
    .select('id, seller_id, source, campaign_enabled_at')
    .eq('referred_user_id', userId)
    .limit(1)
    .maybeSingle()

  if (referralError) {
    throw new Error('Erro ao validar o vínculo do vendedor')
  }

  let referralRow = directReferral

  if (!referralRow?.seller_id) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('affiliate_code')
      .eq('id', userId)
      .limit(1)
      .maybeSingle()

    if (profileError) {
      throw new Error('Erro ao validar o perfil vinculado ao vendedor')
    }

    const affiliateCode = String(profileRow?.affiliate_code || '').trim()
    if (affiliateCode) {
      const { data: sellerRow, error: sellerError } = await supabase
        .from('sellers')
        .select('id, seller_code')
        .eq('seller_code', affiliateCode)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (sellerError) {
        throw new Error('Erro ao validar o vendedor responsável')
      }

      if (sellerRow?.id) {
        const nowIso = new Date().toISOString()
        const { data: insertedReferral, error: insertReferralError } = await supabase
          .from('seller_referrals')
          .insert({
            seller_id: sellerRow.id,
            referred_user_id: userId,
            affiliate_code: sellerRow.seller_code,
            source: 'link',
            campaign_enabled_at: nowIso,
            updated_at: nowIso,
          })
          .select('id, seller_id, source, campaign_enabled_at')
          .single()

        if (insertReferralError) {
          const { data: retriedReferral, error: retriedReferralError } = await supabase
            .from('seller_referrals')
            .select('id, seller_id, source, campaign_enabled_at')
            .eq('referred_user_id', userId)
            .limit(1)
            .maybeSingle()

          if (retriedReferralError) {
            throw new Error('Erro ao sincronizar o vínculo do vendedor')
          }

          referralRow = retriedReferral
        } else {
          referralRow = insertedReferral
        }
      }
    }
  }

  if (!referralRow?.seller_id) {
    return null
  }

  const { data: sellerRow, error: sellerFetchError } = await supabase
    .from('sellers')
    .select('id, seller_code')
    .eq('id', referralRow.seller_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (sellerFetchError) {
    throw new Error('Erro ao validar o vendedor responsável')
  }

  if (!sellerRow?.id) {
    return null
  }

  return {
    sellerId: sellerRow.id as string,
    sellerCode: String(sellerRow.seller_code || ''),
    sellerReferralId: Number(referralRow.id),
    sellerSource: String(referralRow.source || 'link'),
    campaignEnabledAt: String(referralRow.campaign_enabled_at || ''),
  }
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
      return new Response(JSON.stringify({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await enforceRateLimit({
      supabase,
      subject: String(user.id),
      action: 'mp_create_pix',
      limit: 12,
      windowSeconds: 600,
    })

    // Housekeeping: prevent users from being blocked by stale pending PIX rows.
    const { error: expireStaleError } = await supabase.rpc('expire_stale_pix_payments', {
      p_limit: 200,
    })
    if (expireStaleError) {
      console.error('expire_stale_pix_payments rpc error:', expireStaleError)
    }

    const { planId } = await readCheckoutPayload(req)
    const checkoutPlan = await getCheckoutPlan(supabase, planId)
    const expectedAmount = Number(checkoutPlan.price)

    // Enforce business rule: only 1 active package at a time.
    // User can buy another package only after finishing the current one.
    // If an exhausted plan is still marked as active, auto-complete it.
    const nowIso = new Date().toISOString()
    const { data: existingActive, error: activeError } = await supabase
      .from('plan_purchases')
      .select('id, plan_id, started_at, used_validations, max_validations, validation_credit_remaining')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (activeError) {
      console.error('plan_purchases select error:', activeError)
      return new Response(JSON.stringify({ error: 'Erro ao verificar seu pacote atual' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingActive) {
      const exhausted = isPlanExhausted(existingActive as Record<string, unknown>)
      const expired = isPlanExpired(existingActive as Record<string, unknown>, Date.now())

      if (exhausted || expired) {
        await supabase
          .from('plan_purchases')
          .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
          .eq('id', (existingActive as any).id)
      } else {
        return new Response(JSON.stringify({
          error: 'Você já possui um pacote ativo. Finalize o pacote atual para comprar outro.',
          details: {
            used_validations: Number((existingActive as any).used_validations || 0),
            max_validations: Number((existingActive as any).max_validations || 0),
            validation_credit_remaining: Number((existingActive as any).validation_credit_remaining || 0),
          },
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let sellerCampaignAccess: Awaited<ReturnType<typeof resolveSellerCampaignAccess>> | null = null

    try {
      sellerCampaignAccess = await resolveSellerCampaignAccess(supabase, user.id)
    } catch (sellerAccessError: any) {
      console.error('seller campaign access error:', sellerAccessError)
      return new Response(JSON.stringify({ error: sellerAccessError?.message || 'Erro ao validar o vínculo do vendedor' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (checkoutPlan.is_seller_exclusive && !sellerCampaignAccess?.sellerId) {
      return new Response(JSON.stringify({
        error: 'Plano indisponível',
        details: 'Este pacote da campanha do vendedor só pode ser comprado por usuários vinculados a um vendedor ativo.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existingOpenPayments, error: existingOpenPaymentsError } = await supabase
      .from('pix_payments')
      .select('id, mp_payment_id, plan_id, status, qr_code, qr_code_base64, ticket_url, expires_at, created_at, superseded_at')
      .eq('user_id', user.id)
      .is('plan_activated_at', null)
      .in('status', ['pending', 'in_process'])
      .order('created_at', { ascending: false })

    if (existingOpenPaymentsError) {
      console.error('pix_payments open payment fetch error:', existingOpenPaymentsError)
      return new Response(JSON.stringify({ error: 'Erro ao verificar pagamentos pendentes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const staleOpenPaymentIds = (existingOpenPayments || [])
      .filter((payment) => isOpenPixPaymentStatus(payment.status) && isPixPaymentExpired(payment.expires_at))
      .map((payment) => payment.id)

    if (staleOpenPaymentIds.length > 0) {
      const { error: expirePendingError } = await supabase
        .from('pix_payments')
        .update({ status: 'expired', updated_at: nowIso })
        .in('id', staleOpenPaymentIds)

      if (expirePendingError) {
        console.error('pix_payments expire stale payment error:', expirePendingError)
      }
    }

    const replaceableOpenPayments = (existingOpenPayments || []).filter(
      (payment) =>
        isOpenPixPaymentStatus(payment.status) &&
        !isPixPaymentExpired(payment.expires_at) &&
        !payment.superseded_at
    )
    const supersededPaymentIds: string[] = []

    for (const pendingPayment of replaceableOpenPayments) {
      const mpPaymentId = String(pendingPayment.mp_payment_id || '').trim()
      if (!mpPaymentId) continue

      const remoteSnapshot = await fetchMercadoPagoPayment(mpPaymentId, mpAccessToken)
      if (!remoteSnapshot.ok || !remoteSnapshot.payload?.id) {
        console.error('Mercado Pago fetch previous PIX error:', {
          paymentId: mpPaymentId,
          status: remoteSnapshot.status,
          payload: remoteSnapshot.payload,
        })
        throw new HttpError(502, 'Não foi possível reconciliar o PIX pendente anterior. Tente novamente em instantes.')
      }

      const remoteStatus = String(remoteSnapshot.payload?.status || pendingPayment.status || '').trim().toLowerCase()
      if (remoteStatus && remoteStatus !== String(pendingPayment.status || '').trim().toLowerCase()) {
        await updatePixPaymentRow(supabase, String(pendingPayment.id), {
          status: remoteStatus,
          updated_at: nowIso,
        })
      }

      if (isApprovedPixPaymentStatus(remoteStatus)) {
        const activationStatus = await activateApprovedPixPayment(supabase, mpPaymentId, user.id)
        if (activationStatus === 'superseded') {
          throw new HttpError(409, 'O PIX anterior já foi substituído. Gere um novo código.')
        }

        throw new HttpError(
          409,
          'Seu PIX anterior já foi aprovado. Atualize a página para carregar o pacote liberado.'
        )
      }

      if (!isOpenPixPaymentStatus(remoteStatus)) {
        continue
      }

      const cancellation = await cancelMercadoPagoPayment(mpPaymentId, mpAccessToken)
      const cancelledStatus = String(cancellation.payload?.status || remoteStatus || '').trim().toLowerCase()

      if (!cancellation.ok) {
        if (isApprovedPixPaymentStatus(cancelledStatus)) {
          await updatePixPaymentRow(supabase, String(pendingPayment.id), {
            status: cancelledStatus,
            updated_at: nowIso,
          })

          await activateApprovedPixPayment(supabase, mpPaymentId, user.id)
          throw new HttpError(
            409,
            'Seu PIX anterior foi aprovado durante a reconciliação. Atualize a página para carregar o pacote.'
          )
        }

        console.error('Mercado Pago cancel previous PIX error:', {
          paymentId: mpPaymentId,
          status: cancellation.status,
          payload: cancellation.payload,
        })
        throw new HttpError(409, 'Não foi possível cancelar o PIX anterior. Tente novamente em instantes.')
      }

      if (isOpenPixPaymentStatus(cancelledStatus)) {
        console.error('Mercado Pago kept PIX open after cancel attempt:', {
          paymentId: mpPaymentId,
          status: cancelledStatus,
          payload: cancellation.payload,
        })
        throw new HttpError(409, 'O PIX anterior ainda está em aberto. Aguarde alguns segundos e tente novamente.')
      }

      await updatePixPaymentRow(supabase, String(pendingPayment.id), {
        status: cancelledStatus || 'cancelled',
        superseded_at: nowIso,
        superseded_reason: 'replaced_by_new_checkout',
        updated_at: nowIso,
      })
      supersededPaymentIds.push(String(pendingPayment.id))
    }

    // Get user email
    const email = user.email || 'usuario@fatopago.com'

    // Create PIX payment via Mercado Pago API
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpAccessToken}`,
        // Use a unique key per request. We are not implementing retries here; frontend can create a new PIX if needed.
        'X-Idempotency-Key': `pix-${user.id}-${planId}-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        transaction_amount: expectedAmount,
        description: `FatoPago - ${checkoutPlan.display_name}`,
        payment_method_id: 'pix',
        external_reference: `fatopago:${user.id}:${planId}`,
        metadata: {
          plan_id: planId,
          user_id: user.id,
          expected_amount: expectedAmount,
          seller_id: sellerCampaignAccess?.sellerId || null,
          seller_referral_id: sellerCampaignAccess?.sellerReferralId || null,
          seller_source: sellerCampaignAccess?.sellerSource || null,
        },
        payer: {
          email: email,
        },
      }),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Mercado Pago error:', mpData)
      return new Response(JSON.stringify({ error: 'Erro ao criar pagamento PIX' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Save payment record in database
    const { error: insertError } = await supabase.from('pix_payments').insert({
      user_id: user.id,
      plan_id: planId,
      mp_payment_id: String(mpData.id),
      amount: expectedAmount,
      status: mpData.status, // 'pending'
      qr_code: mpData.point_of_interaction?.transaction_data?.qr_code || '',
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      ticket_url: mpData.point_of_interaction?.transaction_data?.ticket_url || '',
      expires_at: mpData.date_of_expiration || null,
      seller_id: sellerCampaignAccess?.sellerId || null,
      seller_referral_id: sellerCampaignAccess?.sellerReferralId || null,
      seller_source: sellerCampaignAccess?.sellerSource || null,
    })

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Erro ao registrar pagamento PIX' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (supersededPaymentIds.length > 0) {
      const { error: supersededLinkError } = await supabase
        .from('pix_payments')
        .update({
          superseded_by_mp_payment_id: String(mpData.id),
          updated_at: nowIso,
        })
        .in('id', supersededPaymentIds)
        .not('superseded_at', 'is', null)

      if (supersededLinkError) {
        console.error('superseded payment link error:', supersededLinkError)
        return new Response(JSON.stringify({ error: 'Erro ao finalizar substituição do PIX anterior' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({
      payment_id: mpData.id,
      status: mpData.status,
      qr_code: mpData.point_of_interaction?.transaction_data?.qr_code || '',
      qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      ticket_url: mpData.point_of_interaction?.transaction_data?.ticket_url || '',
      expires_at: mpData.date_of_expiration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({
        error: err.message,
        details: err.details,
      }), {
        status: err.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
