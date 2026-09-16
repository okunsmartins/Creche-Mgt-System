/**
 * SMS credit top-up bundles (one-off Stripe purchases). 1 credit = 1 SMS segment.
 * Effective ≈ €0.083–0.10/text — margin over the ~€0.074 Twilio cost. Purchased
 * credits expire 12 months after the latest top-up.
 */

export interface SmsTopupBundle {
  /** Stable id used as the checkout selector + in Stripe metadata. */
  id: string
  credits: number
  priceCents: number
}

export const SMS_TOPUP_BUNDLES: readonly SmsTopupBundle[] = [
  { id: 'sms-10', credits: 100, priceCents: 1000 },
  { id: 'sms-25', credits: 275, priceCents: 2500 },
  { id: 'sms-50', credits: 600, priceCents: 5000 },
]

export const SMS_CREDIT_EXPIRY_MONTHS = 12

export function getSmsTopupBundle(id: string): SmsTopupBundle | null {
  return SMS_TOPUP_BUNDLES.find((b) => b.id === id) ?? null
}
