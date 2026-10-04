'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import { fundingEnabled } from './access'
import { reconcileClaimBilling } from './reconcile'
import { CURRENT_NCS_RULES_VERSION } from './rules'
import {
  computeCopayment,
  validateClaimReady,
  canTransitionClaim,
  isClaimStatus,
  type ClaimStatus,
} from './copayment'

export type ClaimActionState = { error?: string; success?: boolean }

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function gate(
  permission: string,
): Promise<{ user: SessionUser; schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes(permission))
    return { error: 'You do not have permission for this.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { user, schoolId: user.schoolId }
}

const toCents = (v: FormDataEntryValue | null): number =>
  Math.max(0, Math.round(parseFloat((v as string) || '0') * 100) || 0)
const toMinutes = (v: FormDataEntryValue | null): number =>
  Math.max(0, Math.round(parseFloat((v as string) || '0') * 60) || 0)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Create or update a DRAFT/READY NCS claim. Computes the parent co-payment from the
 * fee and subsidies (snapshotting the inputs). Admin + funding.manage_ncs + flag.
 */
export async function saveClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const g = await gate('funding.manage_ncs')
  if ('error' in g) return { error: g.error }

  const claimId = (formData.get('claimId') as string | null)?.trim() || null
  const studentId = (formData.get('studentId') as string | null)?.trim()
  const startDate = (formData.get('startDate') as string | null)?.trim() ?? ''
  if (!studentId) return { error: 'Choose a child.' }
  if (!ISO_DATE.test(startDate)) return { error: 'Enter a valid claim start date.' }
  const endDateRaw = (formData.get('endDate') as string | null)?.trim()
  const endDate = endDateRaw && ISO_DATE.test(endDateRaw) ? endDateRaw : null

  const termMinutes = toMinutes(formData.get('termHours'))
  const nonTermMinutes = toMinutes(formData.get('nonTermHours'))
  const weeklyFeeCents = toCents(formData.get('weeklyFee'))
  const ncsSubsidyCents = toCents(formData.get('ncsSubsidy'))
  const ecceSubsidyCents = toCents(formData.get('ecceSubsidy'))
  const discountCents = toCents(formData.get('discount'))
  const calculated = computeCopayment({
    weeklyFeeCents,
    ncsSubsidyCents,
    ecceSubsidyCents,
    discountCents,
  })

  const db: AdminClient = createSupabaseAdminClient()
  const fields = {
    student_id: studentId,
    start_date: startDate,
    end_date: endDate,
    term_minutes: termMinutes,
    non_term_minutes: nonTermMinutes,
    weekly_fee_cents: weeklyFeeCents,
    weekly_childcare_minutes: termMinutes || nonTermMinutes,
    ncs_subsidy_cents: ncsSubsidyCents,
    ecce_subsidy_cents: ecceSubsidyCents,
    discount_cents: discountCents,
    calculated_copayment_cents: calculated,
    calculation_version: CURRENT_NCS_RULES_VERSION,
  }

  if (claimId) {
    // Only DRAFT/READY claims may be edited (verify-then-act, school-scoped).
    const { data: existing } = await db
      .from('ncs_claim_versions')
      .select('status')
      .eq('id', claimId)
      .eq('school_id', g.schoolId)
      .maybeSingle()
    const status = (existing as { status: string } | null)?.status
    if (!status) return { error: 'Claim not found.' }
    if (status !== 'DRAFT' && status !== 'READY')
      return { error: 'Only draft or ready claims can be edited.' }
    const { error } = await db
      .from('ncs_claim_versions')
      .update(fields)
      .eq('id', claimId)
      .eq('school_id', g.schoolId)
    if (error) {
      logger.error('claim_update_failed', { schoolId: g.schoolId, error: error.message })
      return { error: 'Could not save the claim. Please try again.' }
    }
  } else {
    const { error } = await db
      .from('ncs_claim_versions')
      .insert({ school_id: g.schoolId, status: 'DRAFT', created_by: g.user.id, ...fields })
    if (error) {
      logger.error('claim_insert_failed', { schoolId: g.schoolId, error: error.message })
      return { error: 'Could not create the claim. Please try again.' }
    }
  }

  // Reconcile the prepared co-payment against the parent's actual billing (best
  // effort — a mismatch raises a Hive action; it never blocks or changes the save).
  try {
    await reconcileClaimBilling(g.schoolId, studentId, calculated)
  } catch (err) {
    logger.error('copayment_reconcile_failed', {
      schoolId: g.schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }

  revalidatePath('/admin/funding/claims')
  revalidatePath('/admin/funding')
  return { success: true }
}

/** Move a claim through its lifecycle. Validates READY; verify-then-act, school-scoped. */
export async function transitionClaimAction(
  claimId: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await gate('funding.manage_ncs')
  if ('error' in g) return { ok: false, error: g.error }
  if (!isClaimStatus(to)) return { ok: false, error: 'Invalid status.' }
  const next = to as ClaimStatus

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_claim_versions')
    .select('status, start_date, term_minutes, non_term_minutes, weekly_fee_cents')
    .eq('id', claimId)
    .eq('school_id', g.schoolId)
    .maybeSingle()
  const claim = data as {
    status: string
    start_date: string
    term_minutes: number
    non_term_minutes: number
    weekly_fee_cents: number | null
  } | null
  if (!claim || !isClaimStatus(claim.status)) return { ok: false, error: 'Claim not found.' }
  if (!canTransitionClaim(claim.status, next))
    return { ok: false, error: `Cannot move a ${claim.status} claim to ${next}.` }

  if (next === 'READY') {
    const v = validateClaimReady({
      weeklyFeeCents: claim.weekly_fee_cents ?? 0,
      termMinutes: claim.term_minutes,
      nonTermMinutes: claim.non_term_minutes,
      startDate: claim.start_date,
    })
    if (!v.ok) return { ok: false, error: `Missing before ready: ${v.missing.join(', ')}.` }
  }

  const now = new Date().toISOString()
  const fields: Record<string, unknown> = { status: next }
  if (next === 'READY') fields.prepared_at = now
  if (next === 'VERIFIED') {
    fields.verified_by = g.user.id
    fields.verified_at = now
  }
  if (next === 'SUBMITTED_EXTERNALLY') {
    fields.external_submitted_by = g.user.id
    fields.external_submitted_at = now
  }

  const { error } = await db
    .from('ncs_claim_versions')
    .update(fields)
    .eq('id', claimId)
    .eq('school_id', g.schoolId)
  if (error) {
    logger.error('claim_transition_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the claim. Please try again.' }
  }
  revalidatePath('/admin/funding/claims')
  return { ok: true }
}
