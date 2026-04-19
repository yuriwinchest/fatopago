import { supabase } from './supabase';

export interface PixPaymentResponse {
  payment_id: number;
  status: string;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  expires_at: string;
}

export interface PixPaymentStatus {
  payment_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_process';
  status_detail: string;
}

export interface PixWithdrawalResponse {
  success: boolean;
  withdrawal_id: string | null;
  new_balance: number;
  message: string;
  withdrawal_status?: 'pending' | 'pending_manual_review' | 'processing' | 'completed' | 'failed';
  manual_review_required?: boolean;
  review_reason?: string;
}

export class PixApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'PixApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getAnonKey = () => {
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!key) throw new Error('Erro de configuração: VITE_SUPABASE_ANON_KEY ausente.');
  return key;
}

const getValidAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const session = data?.session;
  if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

  const expiresAtMs = typeof session.expires_at === 'number' ? session.expires_at * 1000 : 0;
  const isExpiringSoon = expiresAtMs > 0 && expiresAtMs - Date.now() < 30_000;

  if (!isExpiringSoon) return session.access_token.trim();

  // Refresh token close to expiry to avoid 401/Invalid JWT on Edge Functions.
  const refresh = (supabase.auth as any).refreshSession;
  if (typeof refresh !== 'function') return session.access_token.trim();

  const { data: refreshed, error: refreshError } = await refresh.call(supabase.auth);
  if (refreshError || !refreshed?.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return String(refreshed.session.access_token).trim();
}

const getAuthHeaders = async () => {
  const accessToken = await getValidAccessToken();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'apikey': getAnonKey(),
  };
};

const getFunctionsUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.replace(/\/$/, '') + '/functions/v1';
};

const inferPixErrorCode = (status: number, message: string) => {
  const normalized = message.toLowerCase();

  if (status === 401) return 'session_expired';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';

  if (status === 409) {
    if (normalized.includes('pix pendente')) return 'open_pix_payment_exists';
    if (normalized.includes('pacote ativo')) return 'active_plan_exists';
    if (normalized.includes('pagamento inválido')) return 'invalid_payment_guard';
    return 'conflict';
  }

  if (status === 400) {
    if (normalized.includes('payload inválido')) return 'invalid_payload';
    if (normalized.includes('chave pix')) return 'invalid_pix_key';
    if (normalized.includes('valor mínimo')) return 'minimum_withdrawal';
    if (normalized.includes('valor inválido')) return 'invalid_amount';
    return 'bad_request';
  }

  return 'unknown_error';
};

const buildPixApiError = async (response: Response, fallbackMessage: string) => {
  const data = await response.json().catch(() => null as any);

  // message fica LIMPO — apenas a mensagem amigavel (ou fallback).
  // Payload tecnico fica em details, acessivel via error.details, mas
  // NUNCA concatenado em message (evita vazamento de JSON ao usuario).
  const message =
    data?.error ||
    data?.message ||
    (typeof data === 'string' ? data : null) ||
    fallbackMessage;

  const code = inferPixErrorCode(response.status, message);

  // Log tecnico apenas no console do dev (nao vai pro usuario).
  if (data?.details && typeof console !== 'undefined') {
    try {
      console.warn('[PixApiError details]', { status: response.status, code, details: data.details });
    } catch {
      /* noop */
    }
  }

  return new PixApiError(message, response.status, code, data?.details);
};

export const getFriendlyPixCheckoutErrorMessage = (error: unknown) => {
  if (!(error instanceof PixApiError)) {
    return 'Não foi possível gerar o PIX agora. Tente novamente.';
  }

  switch (error.code) {
    case 'session_expired':
      return 'Sua sessão expirou. Faça login novamente para gerar o PIX.';
    case 'open_pix_payment_exists':
      return 'O PIX anterior ainda está sendo reconciliado. Aguarde alguns segundos e gere novamente.';
    case 'active_plan_exists':
      return 'Você já possui um pacote ativo. Finalize o pacote atual antes de comprar outro.';
    case 'forbidden':
      return 'Este plano está restrito ao fluxo comercial com vendedor ativo.';
    case 'rate_limited':
      return 'Muitas tentativas em sequência. Aguarde um pouco e tente novamente.';
    case 'invalid_payment_guard':
      return 'O backend bloqueou o pagamento por divergência de segurança. Gere um novo PIX.';
    default:
      // NUNCA retornar error.message cru no default — pode conter payload
      // tecnico. Fallback generico mantido mesmo quando code e unknown.
      return 'Não foi possível gerar o PIX agora. Tente novamente em instantes.';
  }
};

export const getFriendlyPixWithdrawalErrorMessage = (error: unknown) => {
  if (!(error instanceof PixApiError)) {
    return 'Não foi possível processar o saque agora. Tente novamente.';
  }

  switch (error.code) {
    case 'session_expired':
      return 'Sua sessão expirou. Faça login novamente para solicitar o saque.';
    case 'invalid_pix_key':
      return 'A chave PIX informada não passou na validação. Revise o formato e tente novamente.';
    case 'minimum_withdrawal':
    case 'invalid_amount':
    case 'bad_request':
      return error.message;
    case 'rate_limited':
      return 'Você atingiu o limite de tentativas de saque por enquanto. Aguarde e tente novamente mais tarde.';
    default:
      return error.message || 'Não foi possível processar o saque agora. Tente novamente.';
  }
};

/**
 * Creates a PIX payment for plan purchase via Mercado Pago
 */
export const createPixPayment = async (
  planId: string
): Promise<PixPaymentResponse> => {
  const headers = await getAuthHeaders();
  const functionsUrl = getFunctionsUrl();

  const response = await fetch(`${functionsUrl}/mercadopago-create-pix`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      plan_id: planId,
    }),
  });

  if (!response.ok) {
    throw await buildPixApiError(response, 'Erro ao criar pagamento PIX');
  }

  const data = await response.json();
  return data;
};

/**
 * Checks payment status with Mercado Pago
 */
export const checkPixPaymentStatus = async (
  paymentId: number
): Promise<PixPaymentStatus> => {
  const headers = await getAuthHeaders();
  const functionsUrl = getFunctionsUrl();

  const response = await fetch(`${functionsUrl}/mercadopago-check-payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ payment_id: paymentId }),
  });

  if (!response.ok) {
    throw await buildPixApiError(response, 'Erro ao verificar pagamento');
  }

  const data = await response.json();
  return data;
};

/**
 * Requests a PIX withdrawal via Mercado Pago
 */
export const requestPixWithdrawal = async (
  amount: number,
  pixKey: string,
  pixKeyType: string
): Promise<PixWithdrawalResponse> => {
  const headers = await getAuthHeaders();
  const functionsUrl = getFunctionsUrl();

  const response = await fetch(`${functionsUrl}/mercadopago-pix-withdraw`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
    }),
  });

  if (!response.ok) {
    throw await buildPixApiError(response, 'Erro ao processar saque');
  }

  const data = await response.json();
  return data;
};
