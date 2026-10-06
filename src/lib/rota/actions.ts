'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { validateShiftTimes } from './rota'

export type RotaActionResult = { ok: boolean; error?: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Create a planned staff shift. Admin + school-scoped; validates staff/room + times. */
export async function createShiftAction(input: {
  teacherId: string
  classId?: string | null
  shiftDate: string
  startTime: string
  endTime: string
  label?: string
}): Promise<RotaActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!input.teacherId) return { ok: false, error: 'Choose a staff member.' }
  if (!ISO_DATE.test(input.shiftDate)) return { ok: false, error: 'Choose a valid date.' }
  const timeError = validateShiftTimes(input.startTime, input.endTime)
  if (timeError) return { ok: false, error: timeError }

  const db = createSupabaseAdminClient()

  // The staff member must belong to this crèche.
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('id', input.teacherId)
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  if (!teacher) return { ok: false, error: 'Staff member not found in this crèche.' }

  // If a room is given it must belong to this crèche too.
  let classId: string | null = null
  if (input.classId) {
    const { data: room } = await db
      .from('classes')
      .select('id')
      .eq('id', input.classId)
      .eq('school_id', admin.schoolId)
      .maybeSingle()
    if (!room) return { ok: false, error: 'Room not found in this crèche.' }
    classId = input.classId
  }

  const { error } = await db.from('staff_shifts').insert({
    school_id: admin.schoolId,
    teacher_id: input.teacherId,
    class_id: classId,
    shift_date: input.shiftDate,
    start_time: input.startTime,
    end_time: input.endTime,
    label: input.label?.trim() || null,
    created_by: admin.id,
  })
  if (error) {
    logger.error('rota_shift_create_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not add the shift. Please try again.' }
  }
  revalidatePath('/admin/rota')
  return { ok: true }
}

/** Delete a planned shift (verify-then-act, school-scoped). */
export async function deleteShiftAction(shiftId: string): Promise<RotaActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('staff_shifts')
    .delete()
    .eq('id', shiftId)
    .eq('school_id', admin.schoolId)
    .select('id')
  if (error) {
    logger.error('rota_shift_delete_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not remove the shift.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'Shift not found.' }
  revalidatePath('/admin/rota')
  return { ok: true }
}
