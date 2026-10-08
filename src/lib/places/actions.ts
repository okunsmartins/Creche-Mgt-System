'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export type PlacesActionResult = { ok: true } | { ok: false; error: string }

/**
 * Set (or clear) a room's capacity from the Places & Vacancies view. Capacity drives
 * the available-places / vacancy figures. School-scoped, verify-then-write.
 */
export async function updateRoomCapacityAction(
  classId: string,
  capacity: number | null,
): Promise<PlacesActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  if (capacity != null && (!Number.isInteger(capacity) || capacity < 0))
    return { ok: false, error: 'Capacity must be a whole number of 0 or more.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('classes')
    .update({ capacity })
    .eq('id', classId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) {
    logger.error('room_capacity_update_failed', { classId, error: error.message })
    return { ok: false, error: 'Could not update the room capacity.' }
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'Room not found, or it does not belong to your crèche.' }

  revalidatePath('/admin/places')
  revalidatePath('/admin/classes')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

/**
 * Set (or clear) a child's expected leaving date from the Places & Vacancies view.
 * A date within 90 days surfaces the child under upcoming leavers. School-scoped.
 */
export async function setStudentLeavingDateAction(
  studentId: string,
  leavingDate: string | null,
): Promise<PlacesActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  if (leavingDate != null) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(leavingDate) ||
      Number.isNaN(Date.parse(`${leavingDate}T00:00:00Z`))
    )
      return { ok: false, error: 'Enter a valid leaving date.' }
  }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('students')
    .update({ leaving_date: leavingDate })
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) {
    logger.error('student_leaving_date_update_failed', { studentId, error: error.message })
    return { ok: false, error: 'Could not update the leaving date.' }
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'Child not found, or they do not belong to your crèche.' }

  revalidatePath('/admin/places')
  revalidatePath(`/admin/students/${studentId}`)
  return { ok: true }
}
