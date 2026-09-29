'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

type Result = { ok: true } | { ok: false; error: string }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function ownedChild(studentId: string, schoolId: string) {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return Boolean(data)
}

/** Record (or re-open) today's arrival for a child. */
export async function checkInAction(studentId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!(await ownedChild(studentId, schoolId))) return { ok: false, error: 'Child not found.' }
  const db = createSupabaseAdminClient()

  const { error } = await db.from('daily_check_ins').upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      date: todayISO(),
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      status: 'present',
      created_by: admin.id,
    },
    { onConflict: 'student_id,date' },
  )
  if (error) {
    logger.error('check_in_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not check the child in.' }
  }
  logger.info('child_checked_in', { schoolId })
  revalidatePath('/admin/check-in')
  revalidatePath('/admin/ratios')
  return { ok: true }
}

/** Record today's departure for a child (must have a row for today). */
export async function checkOutAction(studentId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { data, error } = await db
    .from('daily_check_ins')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('date', todayISO())
    .select('id')
  if (error) {
    logger.error('check_out_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not check the child out.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'No check-in for today to close.' }
  revalidatePath('/admin/check-in')
  revalidatePath('/admin/ratios')
  return { ok: true }
}

/** Undo today's check-in entirely (mistaken entry). */
export async function undoCheckInAction(studentId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const { error } = await db
    .from('daily_check_ins')
    .delete()
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('date', todayISO())
  if (error) return { ok: false, error: 'Could not undo the check-in.' }
  revalidatePath('/admin/check-in')
  revalidatePath('/admin/ratios')
  return { ok: true }
}
