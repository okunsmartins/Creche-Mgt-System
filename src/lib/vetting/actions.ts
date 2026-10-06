'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export type VettingActionResult = { ok: boolean; error?: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Empty string / nullish → null; a valid `YYYY-MM-DD` → itself; anything else → undefined (invalid). */
function normalizeDate(v: string | null | undefined): string | null | undefined {
  if (v == null || v.trim() === '') return null
  return ISO.test(v.trim()) ? v.trim() : undefined
}

export interface UpsertVettingInput {
  teacherId: string
  reference?: string | null
  vettingDate?: string | null
  expiryDate?: string | null
  notes?: string | null
}

/**
 * Create or update the current Garda vetting record for a staff member (one per teacher,
 * upserted on school_id + teacher_id). Verifies the teacher belongs to the admin's crèche.
 */
export async function upsertVettingAction(input: UpsertVettingInput): Promise<VettingActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!input.teacherId) return { ok: false, error: 'Missing staff member.' }

  const vettingDate = normalizeDate(input.vettingDate)
  const expiryDate = normalizeDate(input.expiryDate)
  if (vettingDate === undefined) return { ok: false, error: 'Invalid vetting date.' }
  if (expiryDate === undefined) return { ok: false, error: 'Invalid renewal date.' }

  const db = createSupabaseAdminClient()

  // Verify-then-write: the teacher must be in this school.
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('id', input.teacherId)
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  if (!teacher) return { ok: false, error: 'Staff member not found for your crèche.' }

  const reference = input.reference?.trim() || null
  const notes = input.notes?.trim() || null

  const { error } = await db.from('garda_vetting').upsert(
    {
      school_id: admin.schoolId,
      teacher_id: input.teacherId,
      reference,
      vetting_date: vettingDate,
      expiry_date: expiryDate,
      notes,
      created_by: admin.id,
    },
    { onConflict: 'school_id,teacher_id' },
  )

  if (error) {
    logger.error('upsertVettingAction failed', { error: error.message, schoolId: admin.schoolId })
    return { ok: false, error: 'Could not save the vetting record.' }
  }

  revalidatePath('/admin/vetting')
  return { ok: true }
}

/** Clear the vetting record for a staff member. School-scoped. */
export async function deleteVettingAction(teacherId: string): Promise<VettingActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!teacherId) return { ok: false, error: 'Missing staff member.' }

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('garda_vetting')
    .delete()
    .eq('school_id', admin.schoolId)
    .eq('teacher_id', teacherId)

  if (error) {
    logger.error('deleteVettingAction failed', { error: error.message, schoolId: admin.schoolId })
    return { ok: false, error: 'Could not clear the vetting record.' }
  }

  revalidatePath('/admin/vetting')
  return { ok: true }
}
