export const OPEN_PIX_PAYMENT_STATUSES = new Set(['pending', 'in_process'])
export const APPROVED_PIX_PAYMENT_STATUSES = new Set(['approved', 'paid', 'completed', 'authorized', 'active'])

export const isOpenPixPaymentStatus = (status: unknown) => {
  return OPEN_PIX_PAYMENT_STATUSES.has(String(status || '').trim().toLowerCase())
}

export const isApprovedPixPaymentStatus = (status: unknown) => {
  return APPROVED_PIX_PAYMENT_STATUSES.has(String(status || '').trim().toLowerCase())
}

export const isPixPaymentExpired = (expiresAt: unknown, nowMs = Date.now()) => {
  const value = String(expiresAt || '').trim()
  if (!value) return false

  const expiresAtMs = Date.parse(value)
  return Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs
}
