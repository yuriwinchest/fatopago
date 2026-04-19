import { describe, expect, it } from 'vitest'

import {
  CheckoutPayloadError,
  parseCheckoutPayload,
} from '../../../supabase/functions/_shared/checkoutPayloadGuards'

describe('parseCheckoutPayload', () => {
  it('aceita somente plan_id válido', () => {
    expect(parseCheckoutPayload({ plan_id: 'starter' })).toEqual({ planId: 'starter' })
  })

  it('bloqueia tentativa de enviar preço', () => {
    expect(() => parseCheckoutPayload({ plan_id: 'starter', price: 0.01 })).toThrowError(
      CheckoutPayloadError,
    )

    try {
      parseCheckoutPayload({ plan_id: 'starter', price: 0.01 })
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutPayloadError)
      expect((error as CheckoutPayloadError).status).toBe(400)
      expect((error as CheckoutPayloadError).message).toBe('Campo de preço não é permitido')
      expect((error as CheckoutPayloadError).details).toEqual({ field: 'price' })
    }
  })

  it('bloqueia campos inesperados', () => {
    try {
      parseCheckoutPayload({ plan_id: 'starter', foo: 'bar' })
    } catch (error) {
      expect(error).toBeInstanceOf(CheckoutPayloadError)
      expect((error as CheckoutPayloadError).status).toBe(400)
      expect((error as CheckoutPayloadError).message).toBe('Payload inválido')
      expect((error as CheckoutPayloadError).details).toEqual({ unexpected_fields: ['foo'] })
    }
  })

  it('bloqueia plano ausente no payload', () => {
    expect(() => parseCheckoutPayload({})).toThrowError(CheckoutPayloadError)
  })
})
