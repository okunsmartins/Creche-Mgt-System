'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { validateCollectionMethod, validateCollectionRun, normaliseDays } from './collection'

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
