'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher, requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { timeOffRequestSchema, type TimeOffActionState, type TimeOffReviewState } from './schemas'
import { sendTimeOffRequestedEmail, sendTimeOffReviewedEmail } from './emails'
import type { AuditAction, TimeOffStatus } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/** Best-effort audit-log write — never blocks the action on failure. */
async function audit(
  adminClient: AdminClient,
  params: {
    schoolId: string
    actorId: string
    actorEmail: string
    action: AuditAction
    resourceId: string
    metadata?: Record<string, string | number | boolean | null>
  },
): Promise<void> {
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: 'time_off_request',
    resource_id: params.resourceId,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('audit_log_failed', { action: params.action, error: error.message })
}

/** Teacher submits a new time-off request (status = pending). */
export async function createTimeOffRequestAction(
  _prev: TimeOffActionState,
  formData: FormData,
): Promise<TimeOffActionState> {
  const user = await requireTeacher()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }

  const parsed = timeOffRequestSchema.safeParse({
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    reason: formData.get('reason') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }
  const { startDate, endDate, reason } = parsed.data

  const adminClient = createSupabaseAdminClient()

  // Resolve the teacher record from the login email (same pattern as attendance).
  const { data: teacher } = await adminClient
    .from('teachers')
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle()
  const teacherId = (teacher as { id: string } | null)?.id
  if (!teacherId) return { error: 'No active teacher record found for your account.' }

  const { data: inserted, error } = await adminClient
    .from('time_off_requests')
    .insert({
      school_id: user.schoolId,
      teacher_id: teacherId,
      start_date: startDate,
      end_date: endDate,
      reason: reason ?? null,
      status: 'pending' as const,
    })
    .select('id')
    .single()
  if (error || !inserted) {
    logger.error('time_off_create_failed', { schoolId: user.schoolId, error: error?.message })
    return { error: 'Could not submit your request. Please try again.' }
  }
  const requestId = (inserted as { id: string }).id

  const teacherName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ').trim() || user.email

  // Audit + notify the admin — best-effort, never blocks the response.
  await audit(adminClient, {
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'time_off.requested',
    resourceId: requestId,
    metadata: { start_date: startDate, end_date: endDate },
  })
  await sendTimeOffRequestedEmail(
    user.schoolId,
    { teacherName, startDate, endDate, reason: reason ?? null },
    adminClient,
  )

  revalidatePath('/teacher/time-off')
  revalidatePath('/admin/time-off')
  return { success: true }
}

/**
 * Admin approves or rejects a pending request. Scoped to the admin's school and
 * gated on `status = 'pending'` so a request can't be re-reviewed or acted on
 * across tenants. Records reviewer + timestamp (and an optional note, e.g. why a
 * request was rejected), audit-logs the decision, and emails the teacher the
 * outcome (the note is included in the email).
 */
export async function reviewTimeOffRequestAction(
  requestId: string,
  decision: TimeOffStatus,
  reviewNote?: string,
): Promise<TimeOffReviewState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Invalid decision.' }

  // Optional note (server-validated): trimmed, empty → null, capped at 500 chars.
  const note = typeof reviewNote === 'string' ? reviewNote.trim() : ''
  if (note.length > 500) return { error: 'Note must be 500 characters or fewer.' }

  const adminClient = createSupabaseAdminClient()
  const { data: updated, error } = await adminClient
    .from('time_off_requests')
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note.length > 0 ? note : null,
    })
    .eq('id', requestId)
    .eq('school_id', user.schoolId)
    .eq('status', 'pending')
    .select('id, start_date, end_date, review_note, teachers(email)')

  if (error) {
    logger.error('time_off_review_failed', { requestId, error: error.message })
    return { error: 'Could not update the request. Please try again.' }
  }
  if (!updated || updated.length === 0) {
    return { error: 'Request not found, or it has already been reviewed.' }
  }

  type ReviewedRow = {
    start_date: string
    end_date: string
    review_note: string | null
    teachers: { email: string | null } | null
  }
  const row = updated[0] as unknown as ReviewedRow

  await audit(adminClient, {
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: decision === 'approved' ? 'time_off.approved' : 'time_off.rejected',
    resourceId: requestId,
    metadata: { start_date: row.start_date, end_date: row.end_date },
  })

  const teacherEmail = row.teachers?.email
  if (teacherEmail) {
    await sendTimeOffReviewedEmail(
      teacherEmail,
      user.schoolId,
      {
        decision,
        startDate: row.start_date,
        endDate: row.end_date,
        reviewNote: row.review_note,
      },
      adminClient,
    )
  }

  revalidatePath('/admin/time-off')
  revalidatePath('/teacher/time-off')
  return { success: true }
}
