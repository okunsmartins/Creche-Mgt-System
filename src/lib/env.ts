/**
 * Environment variable access.
 *
 * Values are read LAZILY via getters, so merely importing this module never
 * touches `process.env` — a required-but-absent variable only throws when it is
 * actually read (at request time). This keeps `next build` / page-data collection
 * from failing in environments that don't carry the full secret set (e.g. Vercel
 * Preview), while still surfacing a clear error the moment a missing value is
 * needed at runtime. `validateServerEnv()` can be called from a server-only
 * startup hook to fail fast on boot if desired.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env.local and fill in all values.`,
    )
  }
  return value
}

function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

// Server-side only — never import this in client components or expose to browser.
export const serverEnv = {
  get supabaseUrl(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get supabaseServiceRoleKey(): string {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
  get stripeSecretKey(): string {
    return requireEnv('STRIPE_SECRET_KEY')
  },
  get stripeWebhookSecret(): string {
    return requireEnv('STRIPE_WEBHOOK_SECRET')
  },
  // Signing secret for the SEPARATE "Connected accounts" webhook endpoint.
  // Stripe scopes each endpoint to EITHER your account OR connected accounts, each
  // with its own secret. Direct-charge parent payments (checkout.session.completed,
  // payment_intent.payment_failed, charge.refunded) and account.updated arrive on
  // the connected-accounts endpoint. Optional: when unset, only your-account events
  // are verified (Connect parent payments won't be acknowledged until it is set).
  get stripeConnectWebhookSecret(): string {
    return optionalEnv('STRIPE_CONNECT_WEBHOOK_SECRET')
  },
  // Subscription price IDs — optional until the subscription checkout is live.
  get stripeProMonthlyPriceId(): string {
    return optionalEnv('STRIPE_PRO_MONTHLY_PRICE_ID')
  },
  get stripeProAnnualPriceId(): string {
    return optionalEnv('STRIPE_PRO_ANNUAL_PRICE_ID')
  },
  // €44.99 "Pro + SMS" tier price IDs — a subscription on one of these grants the
  // SMS entitlement (subscriptions.sms_enabled) at webhook-sync time. Optional
  // until the live Stripe Pro+SMS product exists.
  get stripeProSmsMonthlyPriceId(): string {
    return optionalEnv('STRIPE_PRO_SMS_MONTHLY_PRICE_ID')
  },
  get stripeProSmsAnnualPriceId(): string {
    return optionalEnv('STRIPE_PRO_SMS_ANNUAL_PRICE_ID')
  },
  // Revolut Pay — optional until credentials are provisioned. When unset, the
  // Revolut payment option is hidden and the order/webhook paths are inert.
  // Base URL: sandbox = https://sandbox-merchant.revolut.com/api/1.0
  //           production = https://merchant.revolut.com/api/1.0
  get revolutApiKey(): string {
    return optionalEnv('REVOLUT_API_KEY')
  },
  get revolutWebhookSecret(): string {
    return optionalEnv('REVOLUT_WEBHOOK_SECRET')
  },
  get revolutApiBaseUrl(): string {
    return optionalEnv('REVOLUT_API_BASE_URL', 'https://sandbox-merchant.revolut.com/api/1.0')
  },
  get resendApiKey(): string {
    return requireEnv('RESEND_API_KEY')
  },
  get emailFromAddress(): string {
    return requireEnv('EMAIL_FROM_ADDRESS')
  },
  get emailFromName(): string {
    return optionalEnv('EMAIL_FROM_NAME', 'Creche Wise')
  },
  get schoolNotificationEmail(): string {
    return requireEnv('SCHOOL_NOTIFICATION_EMAIL')
  },
  get appUrl(): string {
    return requireEnv('NEXT_PUBLIC_APP_URL')
  },
  get cronSecret(): string {
    return optionalEnv('CRON_SECRET')
  },
  get appEnv(): 'poc' | 'production' {
    return optionalEnv('APP_ENV', 'production') as 'poc' | 'production'
  },
  get nodeEnv(): 'development' | 'test' | 'production' {
    return optionalEnv('NODE_ENV', 'development') as 'development' | 'test' | 'production'
  },
}

// Safe to use in client components (only NEXT_PUBLIC_ vars).
export const clientEnv = {
  get supabaseUrl(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabaseAnonKey(): string {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get stripePublishableKey(): string {
    return requireEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  },
  get appUrl(): string {
    return requireEnv('NEXT_PUBLIC_APP_URL')
  },
}

/**
 * Touch every REQUIRED variable so a missing one throws immediately. Optional to
 * call — intended for a server-only startup hook (e.g. instrumentation) to fail
 * fast on boot. Must NOT run during `next build`, or it would re-introduce the
 * build-time env requirement this module deliberately avoids.
 */
export function validateServerEnv(): void {
  void [
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    serverEnv.supabaseServiceRoleKey,
    serverEnv.stripeSecretKey,
    serverEnv.stripeWebhookSecret,
    serverEnv.resendApiKey,
    serverEnv.emailFromAddress,
    serverEnv.schoolNotificationEmail,
    serverEnv.appUrl,
    clientEnv.stripePublishableKey,
  ]
}
