'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { validateCollector, isCollectorStatus, canTransitionCollector } from './collectors'
import { hashCollectionPassword } from './password'

type Result = { ok: true } | { ok: false; error: string }

interface BaseCollectorInput {
  studentId: string
  fullName: string
  relationship: string
  phone?: string
  password?: string
  notes?: string
}

/**
 * Staff add a collector for a child. Admin has authority, so a staff-added
 * collector is APPROVED immediately (proposed_by='staff'). `canCollectUnaccompanied`
 * is a safeguarding decision only staff can set.
 */
export async function addCollectorByStaffAction(
  input: BaseCollectorInput & { canCollectUnaccompanied?: boolean },
): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateCollector(input)
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  // Confirm the child belongs to this crèche before writing.
  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found for this crèche.' }

  const { error } = await db.from('authorised_collectors').insert({
    school_id: schoolId,
    student_id: input.studentId,
    full_name: input.fullName.trim(),
    relationship: input.relationship,
    phone: input.phone?.trim() || null,
    collection_password_hash: input.password?.trim()
      ? hashCollectionPassword(input.password.trim())
      : null,
    can_collect_unaccompanied: input.canCollectUnaccompanied ?? false,
    status: 'approved',
    proposed_by: 'staff',
    proposed_by_profile_id: admin.id,
    reviewed_by_profile_id: admin.id,
    notes: input.notes?.trim() || null,
  })
  if (error) {
    logger.error('collector_add_staff_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not add the collector. They may already be listed.' }
  }
  revalidatePath('/admin/collectors')
  return { ok: true }
}

/**
 * A parent proposes a collector for their own child. Always starts PENDING for
 * crèche approval, and parents can never self-authorise unaccompanied release.
 */
export async function proposeCollectorByParentAction(input: BaseCollectorInput): Promise<Result> {
  const parent = await requireVerifiedAuth()
  const check = validateCollector(input)
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  // Authorise: the parent must be actively linked to this child.
  const { data: link } = await db
    .from('parent_student_links')
    .select('id, students(school_id)')
    .eq('parent_id', parent.id)
    .eq('student_id', input.studentId)
    .eq('is_active', true)
    .maybeSingle()
  const schoolId = (link as { students: { school_id: string } | null } | null)?.students?.school_id
  if (!link || !schoolId) return { ok: false, error: 'You are not linked to this child.' }

  const { error } = await db.from('authorised_collectors').insert({
    school_id: schoolId,
    student_id: input.studentId,
    full_name: input.fullName.trim(),
    relationship: input.relationship,
    phone: input.phone?.trim() || null,
    collection_password_hash: input.password?.trim()
      ? hashCollectionPassword(input.password.trim())
      : null,
    can_collect_unaccompanied: false,
    status: 'pending',
    proposed_by: 'parent',
    proposed_by_profile_id: parent.id,
    notes: input.notes?.trim() || null,
  })
  if (error) {
    logger.error('collector_propose_parent_failed', { error: error.message })
    return { ok: false, error: 'Could not submit the collector. They may already be listed.' }
  }
  revalidatePath('/parent/collectors')
  revalidatePath('/admin/collectors')
  return { ok: true }
}

/** Crèche reviews a collector: approve / decline / revoke (status machine enforced). */
export async function reviewCollectorAction(id: string, nextStatus: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!isCollectorStatus(nextStatus)) return { ok: false, error: 'Invalid status.' }

  const db = createSupabaseAdminClient()
  const { data: row } = await db
    .from('authorised_collectors')
    .select('id, status')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Collector not found.' }

  const current = (row as { status: string }).status
  if (!isCollectorStatus(current) || !canTransitionCollector(current, nextStatus))
    return { ok: false, error: `Cannot change a ${current} collector to ${nextStatus}.` }

  const { error } = await db
    .from('authorised_collectors')
    .update({
      status: nextStatus,
      reviewed_by_profile_id: admin.id,
      // Revoking also deactivates so the partial-unique index frees the slot.
      is_active: nextStatus === 'revoked' ? false : true,
    })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) {
    logger.error('collector_review_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not update the collector.' }
  }
  revalidatePath('/admin/collectors')
  return { ok: true }
}
