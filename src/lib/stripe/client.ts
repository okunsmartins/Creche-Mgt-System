import Stripe from 'stripe'
import { serverEnv } from '@/lib/env'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(serverEnv.stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    })
  }
  return _stripe
}
