import { unstable_cache } from 'next/cache'
import { getStripe } from './client'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

export interface ProPriceDisplay {
  /** Formatted monthly amount, e.g. "€39.99" — null if unavailable. */
  monthly: string | null
  /** Formatted annual amount, e.g. "€420" — null if unavailable. */
  annual: string | null
}

function formatAmount(amountMinor: number | null | undefined, currency: string): string | null {
  if (amountMinor == null) return null
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    // Whole amounts (e.g. €420) read better without trailing .00
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100)
}

/**
 * Fetch and format the configured Pro prices from Stripe for display on /pricing.
 * Cached for an hour (prices rarely change) so the public page doesn't hit Stripe
 * on every render. Returns nulls gracefully if a price id is unset or the lookup fails.
 */
export const getProPrices = unstable_cache(
  async (): Promise<ProPriceDisplay> => {
    const stripe = getStripe()
    const result: ProPriceDisplay = { monthly: null, annual: null }

    const lookups: [keyof ProPriceDisplay, string][] = []
    if (serverEnv.stripeProMonthlyPriceId)
      lookups.push(['monthly', serverEnv.stripeProMonthlyPriceId])
    if (serverEnv.stripeProAnnualPriceId) lookups.push(['annual', serverEnv.stripeProAnnualPriceId])

    await Promise.all(
      lookups.map(async ([key, id]) => {
        try {
          const price = await stripe.prices.retrieve(id)
          result[key] = formatAmount(price.unit_amount, price.currency)
        } catch (err) {
          logger.warn('pro_price_fetch_failed', {
            which: key,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }),
    )
    return result
  },
  ['pro-prices'],
  { revalidate: 3600 },
)

/**
 * Fetch and format the configured €44.99 Pro + SMS tier prices from Stripe.
 * Mirrors {@link getProPrices}; returns nulls gracefully until the SMS-tier price
 * ids are configured (STRIPE_PRO_SMS_MONTHLY/ANNUAL_PRICE_ID).
 */
export const getProSmsPrices = unstable_cache(
  async (): Promise<ProPriceDisplay> => {
    const stripe = getStripe()
    const result: ProPriceDisplay = { monthly: null, annual: null }

    const lookups: [keyof ProPriceDisplay, string][] = []
    if (serverEnv.stripeProSmsMonthlyPriceId)
      lookups.push(['monthly', serverEnv.stripeProSmsMonthlyPriceId])
    if (serverEnv.stripeProSmsAnnualPriceId)
      lookups.push(['annual', serverEnv.stripeProSmsAnnualPriceId])

    await Promise.all(
      lookups.map(async ([key, id]) => {
        try {
          const price = await stripe.prices.retrieve(id)
          result[key] = formatAmount(price.unit_amount, price.currency)
        } catch (err) {
          logger.warn('pro_sms_price_fetch_failed', {
            which: key,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }),
    )
    return result
  },
  ['pro-sms-prices'],
  { revalidate: 3600 },
)
