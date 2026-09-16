import type { createSupabaseAdminClient } from '@/lib/supabase/server'
import { periodReset } from './credits'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface SmsBalanceView {
  /** Monthly included allowance (texts/month on the Pro+SMS tier). */
  allowanceLimit: number
  /** Allowance left this month (limit − used, after the monthly reset). */
  allowanceRemaining: number
  /** Purchased credits still spendable (0 once expired). */
  credits: number
  /** When the purchased credits expire, or null. */
  creditsExpireAt: string | null
}

const DEFAULT_INCLUDED_LIMIT = 100

/**
 * Read-only SMS balance for display. Applies the monthly allowance reset and the
 * credit-expiry window IN MEMORY only — it never writes. The send action
 * (`loadBalance`) persists those transitions on the next send, so this stays a
 * pure display read. Tenant-scoped by school_id.
 */
export async function loadSmsBalanceView(
  adminClient: AdminClient,
  schoolId: string,
): Promise<SmsBalanceView> {
  const { data } = await adminClient
    .from('school_sms_balance')
    .select('included_limit, included_used, period_start, credits, credits_expire_at')
    .eq('school_id', schoolId)
    .maybeSingle()

  const row = data as {
    included_limit: number
    included_used: number
    period_start: string
    credits: number
    credits_expire_at: string | null
  } | null

  if (!row) {
    return {
      allowanceLimit: DEFAULT_INCLUDED_LIMIT,
      allowanceRemaining: DEFAULT_INCLUDED_LIMIT,
      credits: 0,
      creditsExpireAt: null,
    }
  }

  const now = new Date()
  const includedUsed = periodReset(row.period_start, now) ? 0 : row.included_used
  const expired = Boolean(
    row.credits > 0 && row.credits_expire_at && new Date(row.credits_expire_at) < now,
  )

  return {
    allowanceLimit: row.included_limit,
    allowanceRemaining: Math.max(0, row.included_limit - includedUsed),
    credits: expired ? 0 : row.credits,
    creditsExpireAt: expired ? null : row.credits_expire_at,
  }
}
