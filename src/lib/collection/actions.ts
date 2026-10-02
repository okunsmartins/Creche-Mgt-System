'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  validateCollectionMethod,
  validateCollectionRun,
  normaliseDays,
  computeCollectionCharge,
  canTransitionEnrolment,
  isEnrolmentStatus,
} from './collection'

type Result = { ok: true } | { ok: false; error: string }

// ── Collection methods (dropdown config) ──────────────────────────────────────
export async function createCollectionMethodAction(input: {
  label: string
  hasTransport?: boolean
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateCollectionMethod(input)
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  const { error } = await db.from('collection_methods').insert({
    school_id: schoolId,
    label: input.label.trim(),
    has_transport: input.hasTransport ?? false,
  })
  if (error) {
    logger.error('collection_method_create_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not add the collection method.' }
  }
  revalidatePath('/admin/collection')
  return { ok: true }
}

export async function deleteCollectionMethodAction(id: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()
  // Runs referencing this method have collection_method_id set to NULL (FK ON DELETE SET NULL).
  const { error } = await db
    .from('collection_methods')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not delete the method.' }
  revalidatePath('/admin/collection')
  return { ok: true }
}

// ── Collection runs ───────────────────────────────────────────────────────────
export async function createCollectionRunAction(input: {
  name: string
  originSchoolName: string
  collectionMethodId?: string | null
  days: number[]
  pickupTime?: string | null
  capacity: number
  chargeBasis: string
  priceCents: number
  childrenPerChaperone?: number
  teacherIds?: string[]
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateCollectionRun(input)
  if (!check.ok) return check

  const db = createSupabaseAdminClient()

  // If a method was chosen, confirm it belongs to this crèche.
  if (input.collectionMethodId) {
    const { data: m } = await db
      .from('collection_methods')
      .select('id')
      .eq('id', input.collectionMethodId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (!m) return { ok: false, error: 'Selected collection method not found.' }
  }

  const { data: run, error } = await db
    .from('collection_runs')
    .insert({
      school_id: schoolId,
      name: input.name.trim(),
      origin_school_name: input.originSchoolName.trim(),
      collection_method_id: input.collectionMethodId || null,
      days_of_week: normaliseDays(input.days),
      pickup_time: input.pickupTime?.trim() || null,
      capacity: input.capacity,
      charge_basis: input.chargeBasis,
      price_cents: input.priceCents,
      children_per_chaperone: input.childrenPerChaperone ?? 4,
    })
    .select('id')
    .single()
  if (error || !run) {
    logger.error('collection_run_create_failed', { schoolId, error: error?.message })
    return { ok: false, error: 'Could not create the collection run.' }
  }

  if (input.teacherIds?.length) {
    const res = await assignRunStaff(db, schoolId, run.id, input.teacherIds)
    if (!res.ok) return res
  }
  revalidatePath('/admin/collection')
  return { ok: true }
}

export async function deleteCollectionRunAction(id: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()
  const { error } = await db.from('collection_runs').delete().eq('id', id).eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not delete the run.' }
  revalidatePath('/admin/collection')
  return { ok: true }
}

/** Replace the staff assigned to a run (validates the run + staff belong to this crèche). */
export async function setRunStaffAction(runId: string, teacherIds: string[]): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data: run } = await db
    .from('collection_runs')
    .select('id')
    .eq('id', runId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!run) return { ok: false, error: 'Run not found.' }

  await db
    .from('collection_run_staff')
    .delete()
    .eq('collection_run_id', runId)
    .eq('school_id', schoolId)
  if (teacherIds.length) {
    const res = await assignRunStaff(db, schoolId, runId, teacherIds)
    if (!res.ok) return res
  }
  revalidatePath('/admin/collection')
  return { ok: true }
}

// Insert run-staff rows for teachers confirmed to belong to this crèche.
async function assignRunStaff(
  db: ReturnType<typeof createSupabaseAdminClient>,
  schoolId: string,
  runId: string,
  teacherIds: string[],
): Promise<Result> {
  const { data: valid } = await db
    .from('teachers')
    .select('id')
    .eq('school_id', schoolId)
    .in('id', teacherIds)
  const validIds = new Set((valid ?? []).map((t: { id: string }) => t.id))
  const rows = teacherIds
    .filter((id) => validIds.has(id))
    .map((teacher_id) => ({ school_id: schoolId, collection_run_id: runId, teacher_id }))
  if (!rows.length) return { ok: true }
  const { error } = await db.from('collection_run_staff').insert(rows)
  if (error) {
    logger.error('collection_run_staff_assign_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not assign staff to the run.' }
  }
  return { ok: true }
}

// ── Enrolment (Slice 2) ───────────────────────────────────────────────────────

/** Staff enrol a child in a run — approved immediately. */
export async function enrolChildByStaffAction(input: {
  runId: string
  studentId: string
  days?: number[]
  notes?: string
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const [{ data: run }, { data: child }] = await Promise.all([
    db
      .from('collection_runs')
      .select('id')
      .eq('id', input.runId)
      .eq('school_id', schoolId)
      .maybeSingle(),
    db
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .eq('school_id', schoolId)
      .maybeSingle(),
  ])
  if (!run) return { ok: false, error: 'Run not found for this crèche.' }
  if (!child) return { ok: false, error: 'Child not found for this crèche.' }

  const { error } = await db.from('collection_enrolments').insert({
    school_id: schoolId,
    student_id: input.studentId,
    collection_run_id: input.runId,
    days: normaliseDays(input.days ?? []),
    status: 'approved',
    requested_by: 'staff',
    requested_by_profile_id: admin.id,
    reviewed_by_profile_id: admin.id,
    notes: input.notes?.trim() || null,
  })
  if (error) {
    logger.error('collection_enrol_staff_failed', { schoolId, error: error.message })
    return {
      ok: false,
      error: 'Could not enrol the child. They may already be enrolled in this run.',
    }
  }
  revalidatePath('/admin/collection')
  return { ok: true }
}

/** A parent requests collection for their own child. Requires written consent. */
export async function requestCollectionByParentAction(input: {
  runId: string
  studentId: string
  days?: number[]
  consent: boolean
}): Promise<Result> {
  const parent = await requireVerifiedAuth()
  if (!input.consent) return { ok: false, error: 'Please confirm consent to proceed.' }
  const db = createSupabaseAdminClient()

  // Authorise: parent must be actively linked to this child.
  const { data: link } = await db
    .from('parent_student_links')
    .select('id, students(school_id)')
    .eq('parent_id', parent.id)
    .eq('student_id', input.studentId)
    .eq('is_active', true)
    .maybeSingle()
  const schoolId = (link as { students: { school_id: string } | null } | null)?.students?.school_id
  if (!link || !schoolId) return { ok: false, error: 'You are not linked to this child.' }

  // The run must belong to the child's crèche.
  const { data: run } = await db
    .from('collection_runs')
    .select('id')
    .eq('id', input.runId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!run) return { ok: false, error: 'Collection run not found.' }

  const { error } = await db.from('collection_enrolments').insert({
    school_id: schoolId,
    student_id: input.studentId,
    collection_run_id: input.runId,
    days: normaliseDays(input.days ?? []),
    status: 'requested',
    requested_by: 'parent',
    requested_by_profile_id: parent.id,
    consent_given_at: new Date().toISOString(),
  })
  if (error) {
    logger.error('collection_request_parent_failed', { error: error.message })
    return { ok: false, error: 'Could not submit the request. The child may already be enrolled.' }
  }
  revalidatePath('/parent/collection')
  revalidatePath('/admin/collection')
  return { ok: true }
}

/** Crèche reviews an enrolment: approve / decline / end (status machine enforced). */
export async function reviewEnrolmentAction(id: string, nextStatus: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!isEnrolmentStatus(nextStatus)) return { ok: false, error: 'Invalid status.' }

  const db = createSupabaseAdminClient()
  const { data: row } = await db
    .from('collection_enrolments')
    .select('status')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Enrolment not found.' }

  const current = (row as { status: string }).status
  if (!isEnrolmentStatus(current) || !canTransitionEnrolment(current, nextStatus))
    return { ok: false, error: `Cannot change a ${current} enrolment to ${nextStatus}.` }

  const { error } = await db
    .from('collection_enrolments')
    .update({ status: nextStatus, reviewed_by_profile_id: admin.id })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not update the enrolment.' }
  revalidatePath('/admin/collection')
  return { ok: true }
}

/**
 * Generate a collection charge (an issued invoice) for an APPROVED enrolment.
 * net = run price × units. Reuses the invoices table + generate_invoice_number RPC,
 * so the charge shows in /admin/fees and the parent's /parent/invoices. No NCS
 * netting yet (school-age subvention is a later refinement — see design open qs).
 */
export async function generateCollectionChargeAction(input: {
  enrolmentId: string
  periodStart: string
  periodEnd: string
  dueDate: string
  units: number
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  if (!input.periodStart || !input.periodEnd || !input.dueDate)
    return { ok: false, error: 'A billing period and due date are required.' }
  if (!Number.isInteger(input.units) || input.units < 1)
    return { ok: false, error: 'Units must be at least 1.' }
  if (input.periodEnd < input.periodStart)
    return { ok: false, error: 'Period end must be on or after the start.' }

  const { data: enr } = await db
    .from('collection_enrolments')
    .select('id, student_id, status, collection_runs(name, charge_basis, price_cents)')
    .eq('id', input.enrolmentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  const row = enr as {
    id: string
    student_id: string
    status: string
    collection_runs: { name: string; charge_basis: string; price_cents: number } | null
  } | null
  if (!row || !row.collection_runs) return { ok: false, error: 'Enrolment not found.' }
  if (row.status !== 'approved')
    return { ok: false, error: 'Only an approved enrolment can be charged.' }

  const net = computeCollectionCharge(row.collection_runs.price_cents, input.units)
  const { data: numData, error: numErr } = await db.rpc('generate_invoice_number')
  if (numErr || !numData) return { ok: false, error: 'Could not allocate an invoice number.' }

  const { error } = await db.from('invoices').insert({
    school_id: schoolId,
    student_id: row.student_id,
    invoice_number: numData,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    due_date: input.dueDate,
    gross_parent_cents: net,
    net_parent_cents: net,
    status: 'issued',
    issued_at: new Date().toISOString(),
    collection_enrolment_id: row.id,
    created_by: admin.id,
    snapshot: {
      source: 'school_collection',
      run_name: row.collection_runs.name,
      charge_basis: row.collection_runs.charge_basis,
      unit_price_cents: row.collection_runs.price_cents,
      units: input.units,
    },
  })
  if (error) {
    logger.error('collection_charge_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not generate the charge.' }
  }
  revalidatePath('/admin/collection')
  revalidatePath('/admin/fees')
  return { ok: true }
}
