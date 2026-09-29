'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { validateDailyRecord } from './records'

type Result = { ok: true } | { ok: false; error: string }

/** Add a care record for a child today. */
export async function addDailyRecordAction(input: {
  studentId: string
  type: string
  note: string
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateDailyRecord({ type: input.type, note: input.note })
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found.' }

  const { error } = await db.from('daily_records').insert({
    school_id: schoolId,
    student_id: input.studentId,
    date: new Date().toISOString().slice(0, 10),
    type: input.type,
    note: input.note?.trim() || null,
    created_by: admin.id,
  })
  if (error) {
    logger.error('daily_record_add_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not save the record.' }
  }
  revalidatePath('/admin/daily-records')
  return { ok: true }
}

/** Delete a care record (mistaken entry), tenant-scoped. */
export async function deleteDailyRecordAction(recordId: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('daily_records')
    .delete()
    .eq('id', recordId)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not delete the record.' }
  revalidatePath('/admin/daily-records')
  return { ok: true }
}
