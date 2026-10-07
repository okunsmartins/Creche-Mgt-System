'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

type Result = { ok: true } | { ok: false; error: string }

const todayISO = () => new Date().toISOString().slice(0, 10)

async function ownedStaff(teacherId: string, schoolId: string): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('teachers')
    .select('id')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return Boolean(data)
}

/** Record (or re-open) today's clock-in for a staff member. */
export async function clockInAction(teacherId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!(await ownedStaff(teacherId, schoolId)))
    return { ok: false, error: 'Staff member not found.' }

  const db = createSupabaseAdminClient()
  const { error } = await db.from('staff_attendance').upsert(
    {
      school_id: schoolId,
      teacher_id: teacherId,
      work_date: todayISO(),
      clock_in_at: new Date().toISOString(),
      clock_out_at: null,
      created_by: admin.id,
    },
    { onConflict: 'school_id,teacher_id,work_date' },
  )
  if (error) {
    logger.error('staff_clock_in_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not clock the staff member in.' }
  }
  revalidatePath('/admin/staff-attendance')
  return { ok: true }
}

/** Record today's clock-out for a staff member (must already be clocked in today). */
export async function clockOutAction(teacherId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('staff_attendance')
    .update({ clock_out_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('work_date', todayISO())
    .select('id')
  if (error) {
    logger.error('staff_clock_out_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not clock the staff member out.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'No clock-in for today to close.' }
  revalidatePath('/admin/staff-attendance')
  return { ok: true }
}

/** Undo today's clock record entirely (mistaken entry). */
export async function undoClockAction(teacherId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('staff_attendance')
    .delete()
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('work_date', todayISO())
  if (error) return { ok: false, error: 'Could not undo the clock record.' }
  revalidatePath('/admin/staff-attendance')
  return { ok: true }
}
