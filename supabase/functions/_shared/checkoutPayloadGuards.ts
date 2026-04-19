export class CheckoutPayloadError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const ALLOWED_CHECKOUT_FIELDS = new Set(['plan_id'])

export const FORBIDDEN_PRICE_FIELDS = new Set([
  'plan_price',
  'price',
  'amount',
  'transaction_amount',
  'expected_amount',
])

export const parseCheckoutPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CheckoutPayloadError(400, 'Payload inválido')
  }

  const body = payload as Record<string, unknown>

  for (const field of FORBIDDEN_PRICE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw new CheckoutPayloadError(400, 'Campo de preço não é permitido', { field })
    }
  }

  const keys = Object.keys(body)
  const unexpectedFields = keys.filter((key) => !ALLOWED_CHECKOUT_FIELDS.has(key))
  if (unexpectedFields.length > 0) {
    throw new CheckoutPayloadError(400, 'Payload inválido', {
      unexpected_fields: unexpectedFields,
    })
  }

  const planId = typeof body.plan_id === 'string' ? body.plan_id.trim() : ''
  if (!planId) {
    throw new CheckoutPayloadError(400, 'Dados do plano inválidos')
  }

  return { planId }
}
