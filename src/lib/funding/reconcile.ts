import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { reconcileCopayment } from './copayment'

// A small rounding tolerance so sub-euro differences don't raise noise.
const TOLERANCE_CENTS = 100

/**
 * Three-way co-payment reconciliation (spec §6.4): compare the prepared NCS
 * co-payment to what billing actually charges the parent. We compare only against
 * the child's most recent WEEKLY invoice net (comparable to a weekly co-payment) to
 * avoid false mismatches from differently-periodised invoices. On a mismatch beyond
 * tolerance we raise a deduped Hive action — we never silently change the claim or the
 * invoice. If they now agree, any open mismatch for the child is auto-resolved.
 */
export async function reconcileClaimBilling(
  schoolId: string,
  studentId: string,
  calculatedCopaymentCents: number,
): Promise<{ raised: boolean }> {
  const db = createSupabaseAdminClient()
  const dedupeKey = `ncs:NCS_COPAYMENT_MISMATCH:${studentId}`

  // Only compare when the child is billed WEEKLY (an active weekly fee schedule) —
  // otherwise an invoice net isn't comparable to a weekly co-payment.
  const { data: feeData } = await db
    .from('fee_schedules')
    .select('id')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .eq('frequency', 'weekly')
    .limit(1)
    .maybeSingle()
  if (!feeData) return { raised: false } // not weekly-billed — skip

  const { data } = await db
    .from('invoices')
    .select('net_parent_cents, period_start')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  const invoice = data as { net_parent_cents: number } | null
  if (!invoice) return { raised: false } // no invoice to compare against yet

  const { matches, differenceCents } = reconcileCopayment(
    calculatedCopaymentCents,
    invoice.net_parent_cents,
    TOLERANCE_CENTS,
  )

  if (matches) {
    // Resolve any open mismatch now that the figures agree.
    await db
      .from('hive_action_items')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('dedupe_key', dedupeKey)
      .in('status', ['OPEN', 'IN_REVIEW'])
    return { raised: false }
  }

  const prepared = (calculatedCopaymentCents / 100).toFixed(2)
  const billed = (invoice.net_parent_cents / 100).toFixed(2)
  const diff = (Math.abs(differenceCents) / 100).toFixed(2)
  const { error } = await db.from('hive_action_items').insert({
    school_id: schoolId,
    programme: 'NCS',
    action_type: 'NCS_COPAYMENT_MISMATCH',
    entity_type: 'child',
    entity_id: studentId,
    severity: 'ACTION',
    status: 'OPEN',
    reason_code: 'COPAYMENT_MISMATCH',
    description: `Prepared NCS co-payment €${prepared}/wk differs from the parent's billed amount €${billed}/wk (difference €${diff}). Review the claim or the fee plan — Creche Wise will not change either automatically.`,
    dedupe_key: dedupeKey,
  })
  if (error && !/duplicate key|unique/i.test(error.message)) {
    logger.error('copayment_mismatch_insert_failed', { schoolId, error: error.message })
    return { raised: false }
  }
  return { raised: !error }
}
