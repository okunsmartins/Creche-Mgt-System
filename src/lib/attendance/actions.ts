'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/auth/guards'
import { logger } from '@/lib/logging'

const recordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late']),
  note: z.string().max(255).optional(),
})

const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  records: z.array(recordSchema).min(1),
})

export type MarkAttendanceState = { error?: string } | null

export async function markAttendanceAction(
  _prev: MarkAttendanceState,
  formData: FormData,
): Promise<MarkAttendanceState> {
  const user = await requireTeacher()
  const adminClient = createSupabaseAdminClient()

  const raw = {
    classId: formData.get('classId'),
    sessionDate: formData.get('sessionDate'),
    notes: formData.get('notes') || undefined,
    records: (() => {
      try {
        return JSON.parse((formData.get('records') as string) ?? '[]')
      } catch {
        return []
      }
    })(),
  }

  const parsed = markAttendanceSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Invalid form data.' }
  const { classId, sessionDate, notes, records } = parsed.data

  // Resolve teacher record by email — no school_id filter because teacher
  // profiles created via SQL insert may not have school_id set on their profile.
  const { data: teacherRecord } = await adminClient
    .from('teachers')
    .select('id, school_id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()

  if (!teacherRecord)
    return { error: 'Teacher record not found. Contact the school administrator.' }

  const schoolId = teacherRecord.school_id
  if (!schoolId) {
    logger.error('attendance_teacher_missing_school_id', { email: user.email })
    return {
      error: 'Your teacher account is not linked to a school. Contact the school administrator.',
    }
  }

  // Verify teacher is assigned to this class
  const { data: classRecord } = await adminClient
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherRecord.id)
    .maybeSingle()

  if (!classRecord) return { error: 'You are not assigned to this class.' }

  // Resolve or create the session for this class + date (idempotent re-marking)
  const { data: existing } = await adminClient
    .from('attendance_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('session_date', sessionDate)
    .maybeSingle()

  let sessionId: string

  if (existing) {
    // Update notes on the existing session
    const { error: updateErr } = await adminClient
      .from('attendance_sessions')
      .update({ notes: notes ?? null, teacher_id: teacherRecord.id })
      .eq('id', existing.id)
    if (updateErr) {
      logger.error('attendance_session_update_failed', {
        code: updateErr.code,
        message: updateErr.message,
        details: updateErr.details,
      })
      return { error: 'Failed to update session. Please try again.' }
    }
    sessionId = existing.id
  } else {
    // Insert a new session
    const { data: created, error: insertErr } = await adminClient
      .from('attendance_sessions')
      .insert({
        school_id: schoolId,
        class_id: classId,
        teacher_id: teacherRecord.id,
        session_date: sessionDate,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertErr || !created) {
      logger.error('attendance_session_insert_failed', {
        code: insertErr?.code,
        message: insertErr?.message,
        details: insertErr?.details,
        hint: insertErr?.hint,
      })
      return { error: 'Failed to create session. Please try again.' }
    }
    sessionId = created.id
  }

  // Replace all records for this session
  await adminClient.from('attendance_records').delete().eq('session_id', sessionId)

  const inserts = records.map((r) => ({
    session_id: sessionId,
    student_id: r.studentId,
    school_id: schoolId,
    status: r.status,
    note: r.note ?? null,
  }))

  const { error: recordsErr } = await adminClient.from('attendance_records').insert(inserts)

  if (recordsErr) {
    logger.error('attendance_records_insert_failed', {
      code: recordsErr.code,
      message: recordsErr.message,
      details: recordsErr.details,
    })
    return { error: 'Failed to save attendance records. Please try again.' }
  }

  logger.info('attendance_marked', { session_id: sessionId, record_count: inserts.length })
  redirect('/teacher/attendance')
}
