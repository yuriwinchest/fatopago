import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { raiseSecurityAlert } from '../_shared/securityAlerts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

const ALLOWED_WITHDRAW_FIELDS = new Set(['amount', 'pix_key', 'pix_key_type'])
const FORBIDDEN_WITHDRAW_FIELDS = new Set([
  'user_id',
  'profile_id',
  'current_balance',
  'status',
  'withdrawal_id',
])

const parseWithdrawPayload = async (req: Request) => {
  const rawBody = await req.text()
  if (!rawBody.trim()) {
    throw new HttpError(400, 'Payload inválido')
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new HttpError(400, 'Payload inválido')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Payload inválido')
  }

  const payload = body as Record<string, unknown>
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_WITHDRAW_FIELDS.has(key)) {
      throw new HttpError(400, `Campo não permitido: ${key}`)
    }
    if (!ALLOWED_WITHDRAW_FIELDS.has(key)) {
      throw new HttpError(400, 'Payload inválido')
    }
  }

  const requestedAmount = Number(payload.amount)
  const pixKey = String(payload.pix_key || '').trim()
  const pixKeyType = String(payload.pix_key_type || '').trim().toLowerCase()

  return { requestedAmount, pixKey, pixKeyType }
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

const alertOnWithdraw = async (
  supabase: ReturnType<typeof createClient>,
  input: Parameters<typeof raiseSecurityAlert>[1]
) => {
  await raiseSecurityAlert(supabase, input)
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

    const token = authHeader.replace('Bearer ', '')

    // Create client with service key, but keep Authorization so DB functions can use auth.uid().
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Token inválido' }, 401)
    }

    const allowedWithdraw = await enforceRateLimit({
      supabase,
      subject: String(user.id),
      action: 'mp_pix_withdraw',
      limit: 6,
      windowSeconds: 3600,
    })
    if (!allowedWithdraw) {
      return json({ error: 'Muitas tentativas de saque. Tente novamente mais tarde.' }, 429)
    }

    const { requestedAmount, pixKey, pixKeyType } = await parseWithdrawPayload(req)

    if (!Number.isFinite(requestedAmount)) {
      return json({ error: 'Valor inválido' }, 400)
    }

    if (requestedAmount < 10) {
      return json({ error: 'Valor mínimo para saque é R$ 10,00' }, 400)
    }

    if (!pixKey || !pixKeyType) {
      return json({ error: 'Chave PIX inválida' }, 400)
    }

    // Atomic DB-side operation to avoid race conditions and inconsistent balance updates.
    const { data, error } = await supabase.rpc('request_pix_withdrawal', {
      p_amount: requestedAmount,
      p_pix_key: pixKey,
      p_pix_key_type: pixKeyType,
    })

    if (error) {
      console.error('request_pix_withdrawal rpc error:', error)
      await alertOnWithdraw(supabase, {
        eventKey: 'pix_withdraw:request_rpc_error',
        source: 'mercadopago_pix_withdraw',
        category: 'withdrawal',
        severity: 'high',
        title: 'Falha ao solicitar saque PIX',
        message: 'A Edge Function de saque não conseguiu concluir a RPC transacional de solicitação.',
        metadata: {
          user_id: user.id,
          amount: requestedAmount,
          pix_key_type: pixKeyType,
          error: String((error as any)?.message || error),
        },
      })
      return json({ error: 'Erro ao processar saque' }, 500)
    }

    if (!data || typeof data !== 'object') {
      return json({ error: 'Erro ao processar saque' }, 500)
    }

    const status = String((data as any).status || '')
    if (status !== 'success') {
      const message = String((data as any).message || 'Erro ao processar saque')
      // Common client errors: insufficient balance, invalid key, etc.
      return json({ error: message }, 400)
    }

    const manualReviewRequired = (data as any).manual_review_required === true

    if (manualReviewRequired) {
      await alertOnWithdraw(supabase, {
        eventKey: 'pix_withdraw:manual_review_requested',
        source: 'mercadopago_pix_withdraw',
        category: 'withdrawal',
        severity: 'high',
        title: 'Saque enviado para revisão manual',
        message: 'Um saque caiu na esteira de revisão manual de segurança e requer acompanhamento administrativo.',
        metadata: {
          user_id: user.id,
          withdrawal_id: (data as any).withdrawal_id || null,
          amount: requestedAmount,
          review_reason: String((data as any).review_reason || ''),
        },
      })
    }

    return json({
      success: true,
      withdrawal_id: (data as any).withdrawal_id || null,
      new_balance: (data as any).new_balance ?? null,
      withdrawal_status: String((data as any).withdrawal_status || 'pending'),
      manual_review_required: manualReviewRequired,
      review_reason: String((data as any).review_reason || ''),
      message: manualReviewRequired
        ? 'Saque recebido e encaminhado para revisão manual de segurança.'
        : 'Saque solicitado com sucesso. Processamento em até 24h úteis.',
    })

  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status)
    }

    console.error('Function error:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }
})
