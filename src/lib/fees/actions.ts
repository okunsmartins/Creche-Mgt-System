'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/crypto/secrets'
import { logger } from '@/lib/logging'
import { buildInvoiceDrafts } from './invoice'
import { type FeeFrequency } from './schedule'
import { type EcceAward, type NcsAward } from '@/lib/payments/subvention'
import { onFeePlanChanged } from '@/lib/funding/events'

// ─── Fee schedules ────────────────────────────────────────────────────────────

export interface FeeScheduleInput {
  studentId: string
  name: string
  frequency: FeeFrequency
  /** Hours-based OR flat — one must be provided. */
  providerHourlyRateCents?: number | null
  flatAmountCents?: number | null
  contractedDayHours?: number[]
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string }

/** Create a recurring fee plan for a child. */
export async function createFeeScheduleAction(
  input: FeeScheduleInput,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  if (!input.studentId || !input.name?.trim())
    return { ok: false, error: 'A child and a name are required.' }
  if (input.flatAmountCents == null && input.providerHourlyRateCents == null) {
    return { ok: false, error: 'Provide either a flat amount or an hourly rate.' }
  }
  if (input.endDate < input.startDate)
    return { ok: false, error: 'End date must be on or after the start date.' }

  // Confirm the child belongs to this tenant (service-role bypasses RLS).
  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }

  const { data, error } = await db
    .from('fee_schedules')
    .insert({
      school_id: schoolId,
      student_id: input.studentId,
      name: input.name.trim(),
      frequency: input.frequency,
      provider_hourly_rate_cents: input.providerHourlyRateCents ?? null,
      flat_amount_cents: input.flatAmountCents ?? null,
      contracted_day_hours: input.contractedDayHours ?? [],
      start_date: input.startDate,
      end_date: input.endDate,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('fee_schedule_create_failed', { schoolId, error: error?.message })
    return { ok: false, error: 'Could not save the fee schedule.' }
  }

  logger.info('fee_schedule_created', { schoolId, feeScheduleId: (data as { id: string }).id })
  revalidatePath('/admin/fees')
  await onFeePlanChanged(schoolId, input.studentId)
  return { ok: true, id: (data as { id: string }).id }
}

/**
 * Update an existing fee schedule (the billing "template"). Allowed at any time;
 * already-issued invoices are NOT rewritten (their amounts are immutable) — void
 * and regenerate to apply a changed schedule to outstanding periods.
 */
export async function updateFeeScheduleAction(
  scheduleId: string,
  input: FeeScheduleInput,
): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  if (!input.name?.trim()) return { ok: false, error: 'A name is required.' }
  if (input.flatAmountCents == null && input.providerHourlyRateCents == null)
    return { ok: false, error: 'Provide either a flat amount or an hourly rate.' }
  if (input.endDate < input.startDate)
    return { ok: false, error: 'End date must be on or after the start date.' }

  const { data: existing } = await db
    .from('fee_schedules')
    .select('id, student_id')
    .eq('id', scheduleId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!existing) return { ok: false, error: 'Fee schedule not found in this crèche.' }
  const studentId = (existing as { student_id: string }).student_id

  const { error } = await db
    .from('fee_schedules')
    .update({
      name: input.name.trim(),
      frequency: input.frequency,
      provider_hourly_rate_cents: input.providerHourlyRateCents ?? null,
      flat_amount_cents: input.flatAmountCents ?? null,
      contracted_day_hours: input.contractedDayHours ?? [],
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .eq('id', scheduleId)
    .eq('school_id', schoolId)

  if (error) {
    logger.error('fee_schedule_update_failed', { scheduleId, error: error.message })
    return { ok: false, error: 'Could not update the fee schedule.' }
  }

  logger.info('fee_schedule_updated', { schoolId, scheduleId })
  revalidatePath('/admin/fees')
  revalidatePath(`/admin/fees/${studentId}`)
  await onFeePlanChanged(schoolId, studentId)
  return { ok: true }
}

/** Reschedule a single invoice (its due date). Financial fields stay immutable. */
export async function updateInvoiceDueDateAction(
  invoiceId: string,
  dueDate: string,
): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))
    return { ok: false, error: 'Enter a valid due date.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('invoices')
    .update({ due_date: dueDate })
    .eq('id', invoiceId)
    .eq('school_id', schoolId)
    .select('id, student_id')

  if (error) {
    logger.error('invoice_due_date_update_failed', { invoiceId, error: error.message })
    return { ok: false, error: 'Could not update the due date.' }
  }
  if (!data || data.length === 0) return { ok: false, error: 'Invoice not found in this crèche.' }

  revalidatePath('/admin/fees')
  revalidatePath(`/admin/fees/${(data[0] as { student_id: string }).student_id}`)
  revalidatePath('/admin/fees/due')
  return { ok: true }
}

// ─── Child funding registrations (ECCE / NCS award data) ──────────────────────

export interface FundingRegistrationInput {
  studentId: string
  scheme: 'ECCE' | 'NCS'
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED'
  startDate?: string | null
  endDate?: string | null
  // NCS:
  chickCode?: string | null
  ncsSubsidyType?: 'UNIVERSAL' | 'INCOME_ASSESSED' | null
  awardedHourlyRateCents?: number | null
  awardedWeeklyHours?: number | null
  // ECCE:
  ecceProgrammeYear?: string | null
  higherCapitation?: boolean
  // Sensitive — plaintext PPSN in; stored encrypted, never returned.
  ppsNumber?: string | null
  notes?: string | null
}

/**
 * Create or update a child's funding registration. PPSN is encrypted at rest.
 * At most one ACTIVE registration per (child, scheme) — enforced by a partial
 * unique index; we surface a friendly error if it trips.
 */
export async function upsertFundingRegistrationAction(
  input: FundingRegistrationInput,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }

  const row: Record<string, unknown> = {
    school_id: schoolId,
    student_id: input.studentId,
    scheme: input.scheme,
    status: input.status ?? 'PENDING',
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    chick_code: input.chickCode ?? null,
    ncs_subsidy_type: input.ncsSubsidyType ?? null,
    awarded_hourly_rate_cents: input.awardedHourlyRateCents ?? null,
    awarded_weekly_hours: input.awardedWeeklyHours ?? null,
    ecce_programme_year: input.ecceProgrammeYear ?? null,
    higher_capitation: input.higherCapitation ?? false,
    notes: input.notes ?? null,
    created_by: admin.id,
  }
  if (input.ppsNumber && input.ppsNumber.trim()) {
    row.pps_number_encrypted = encryptSecret(input.ppsNumber.trim())
  }

  const { data, error } = await db
    .from('child_funding_registrations')
    .insert(row)
    .select('id')
    .single()

  if (error || !data) {
    const dup = error?.message?.includes('uq_funding_reg_one_active')
    logger.error('funding_reg_upsert_failed', { schoolId, error: error?.message })
    return {
      ok: false,
      error: dup
        ? `This child already has an active ${input.scheme} registration. End it before adding another.`
        : 'Could not save the funding registration.',
    }
  }

  logger.info('funding_reg_created', { schoolId, scheme: input.scheme })
  revalidatePath('/admin/fees')
  return { ok: true, id: (data as { id: string }).id }
}

/**
 * Update an existing funding registration (ECCE/NCS award data) in place. Edits the
 * same row, so the one-active-per-scheme unique index is not tripped. The scheme
 * itself can't be changed here. PPSN is re-encrypted only when a new value is given.
 */
export async function updateFundingRegistrationAction(
  registrationId: string,
  input: FundingRegistrationInput,
): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data: existing } = await db
    .from('child_funding_registrations')
    .select('id, student_id')
    .eq('id', registrationId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!existing) return { ok: false, error: 'Funding registration not found in this crèche.' }
  const studentId = (existing as { student_id: string }).student_id

  const row: Record<string, unknown> = {
    status: input.status ?? 'ACTIVE',
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    chick_code: input.chickCode ?? null,
    ncs_subsidy_type: input.ncsSubsidyType ?? null,
    awarded_hourly_rate_cents: input.awardedHourlyRateCents ?? null,
    awarded_weekly_hours: input.awardedWeeklyHours ?? null,
    ecce_programme_year: input.ecceProgrammeYear ?? null,
    higher_capitation: input.higherCapitation ?? false,
    notes: input.notes ?? null,
  }
  if (input.ppsNumber && input.ppsNumber.trim()) {
    row.pps_number_encrypted = encryptSecret(input.ppsNumber.trim())
  }

  const { error } = await db
    .from('child_funding_registrations')
    .update(row)
    .eq('id', registrationId)
    .eq('school_id', schoolId)

  if (error) {
    const dup = error.message?.includes('uq_funding_reg_one_active')
    logger.error('funding_reg_update_failed', { registrationId, error: error.message })
    return {
      ok: false,
      error: dup
        ? `This child already has another active ${input.scheme} registration.`
        : 'Could not update the funding registration.',
    }
  }

  logger.info('funding_reg_updated', { schoolId, registrationId, scheme: input.scheme })
  revalidatePath('/admin/fees')
  revalidatePath(`/admin/fees/${studentId}`)
  await onFeePlanChanged(schoolId, studentId)
  return { ok: true }
}

// ─── Invoice generation (FEE-06) ──────────────────────────────────────────────

interface FeeScheduleRow {
  id: string
  student_id: string
  name: string
  frequency: FeeFrequency
  provider_hourly_rate_cents: number | null
  flat_amount_cents: number | null
  contracted_day_hours: number[] | null
  start_date: string
  end_date: string
  status: string
}

interface FundingRow {
  scheme: 'ECCE' | 'NCS'
  status: string
  higher_capitation: boolean
  awarded_hourly_rate_cents: number | null
  awarded_weekly_hours: number | null
}

/**
 * Generate draft invoices for a fee schedule, netting each period by the child's
 * ACTIVE ECCE/NCS awards. Idempotency-lite: refuses if drafts already exist for
 * the schedule (caller can void + regenerate). Invoices are created as 'draft';
 * issuing them is a separate step so nothing bills a parent unattended.
 */
export async function generateInvoicesForScheduleAction(
  feeScheduleId: string,
): Promise<ActionResult<{ created: number; totalNetCents: number }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data: schedule } = await db
    .from('fee_schedules')
    .select('*')
    .eq('id', feeScheduleId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!schedule) return { ok: false, error: 'Fee schedule not found.' }
  const s = schedule as FeeScheduleRow

  // Don't double-generate. Voided invoices don't count — voiding frees a schedule
  // to be regenerated.
  const { count: existingCount } = await db
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('fee_schedule_id', feeScheduleId)
    .neq('status', 'void')
  if ((existingCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'Invoices already exist for this schedule. Void them before regenerating.',
    }
  }

  // Active funding for this child.
  const { data: funding } = await db
    .from('child_funding_registrations')
    .select('scheme, status, higher_capitation, awarded_hourly_rate_cents, awarded_weekly_hours')
    .eq('school_id', schoolId)
    .eq('student_id', s.student_id)
    .eq('status', 'ACTIVE')
  const rows = (funding ?? []) as FundingRow[]

  const ecceRow = rows.find((r) => r.scheme === 'ECCE')
  const ncsRow = rows.find((r) => r.scheme === 'NCS')
  const ecce: EcceAward | null = ecceRow
    ? { active: true, higherCapitation: ecceRow.higher_capitation }
    : null
  const ncs: NcsAward | null = ncsRow
    ? {
        active: true,
        awardedHourlyRateCents: ncsRow.awarded_hourly_rate_cents ?? 0,
        awardedWeeklyHours: ncsRow.awarded_weekly_hours ?? 0,
      }
    : null

  const buildParams: Parameters<typeof buildInvoiceDrafts>[0] = {
    frequency: s.frequency,
    startISO: s.start_date,
    endISO: s.end_date,
    ecce,
    ncs,
  }
  if (s.provider_hourly_rate_cents != null)
    buildParams.providerHourlyRateCents = s.provider_hourly_rate_cents
  if (s.contracted_day_hours != null) buildParams.contractedDayHours = s.contracted_day_hours
  if (s.flat_amount_cents != null) buildParams.flatAmountCents = s.flat_amount_cents
  const drafts = buildInvoiceDrafts(buildParams)
  if (drafts.length === 0)
    return { ok: false, error: 'No billing periods fall in this schedule’s window.' }

  let created = 0
  for (const d of drafts) {
    const numRes = await db.rpc('generate_invoice_number')
    const invoiceNumber = numRes.data as string | null
    if (!invoiceNumber) {
      logger.error('invoice_number_failed', { schoolId, feeScheduleId })
      continue
    }
    const ins = await db.from('invoices').insert({
      school_id: schoolId,
      student_id: s.student_id,
      fee_schedule_id: feeScheduleId,
      invoice_number: invoiceNumber,
      period_start: d.periodStart,
      period_end: d.periodEnd,
      due_date: d.dueDate,
      basis: 'CONTRACTED',
      gross_parent_cents: d.grossParentCents,
      ecce_zero_rated_hours: d.ecceZeroRatedHours,
      ncs_subsidised_hours: d.ncsSubsidisedHours,
      ncs_subsidy_cents: d.ncsSubsidyCents,
      net_parent_cents: d.netParentCents,
      provider_receivable_ecce_cents: d.providerReceivableEcceCents,
      provider_receivable_ncs_cents: d.providerReceivableNcsCents,
      status: 'draft',
      snapshot: { weeks: d.weeks, generatedAt: new Date().toISOString() },
      created_by: admin.id,
    })
    if (ins.error) {
      logger.error('invoice_insert_failed', { schoolId, error: ins.error.message })
      continue
    }
    created++
  }

  const totalNet = drafts.reduce((sum, d) => sum + d.netParentCents, 0)
  logger.info('invoices_generated', { schoolId, feeScheduleId, created, totalNet })
  revalidatePath('/admin/fees')
  await onFeePlanChanged(schoolId, s.student_id)
  return { ok: true, created, totalNetCents: totalNet }
}

/** Issue all draft invoices for a schedule (draft → issued). Stamps issued_at. */
export async function issueInvoicesForScheduleAction(
  feeScheduleId: string,
): Promise<ActionResult<{ issued: number }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data, error } = await db
    .from('invoices')
    .update({ status: 'issued', issued_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('fee_schedule_id', feeScheduleId)
    .eq('status', 'draft')
    .select('id')
  if (error) {
    logger.error('invoices_issue_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not issue the invoices.' }
  }
  const issued = (data ?? []).length
  logger.info('invoices_issued', { schoolId, feeScheduleId, issued })
  revalidatePath('/admin/fees')
  return { ok: true, issued }
}

/**
 * Void all invoices for a schedule (any status → void), freeing it to be
 * regenerated. Issued invoices are financial records, so voiding — not deletion —
 * is the correct reversal; the guard trigger permits the status change to 'void'.
 */
export async function voidInvoicesForScheduleAction(
  feeScheduleId: string,
): Promise<ActionResult<{ voided: number }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data, error } = await db
    .from('invoices')
    .update({ status: 'void' })
    .eq('school_id', schoolId)
    .eq('fee_schedule_id', feeScheduleId)
    .neq('status', 'void')
    .select('id')
  if (error) {
    logger.error('invoices_void_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not void the invoices.' }
  }
  const voided = (data ?? []).length
  logger.info('invoices_voided', { schoolId, feeScheduleId, voided })
  revalidatePath('/admin/fees')
  return { ok: true, voided }
}
