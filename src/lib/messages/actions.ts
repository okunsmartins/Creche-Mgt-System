'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { logger } from '@/lib/logging'
import { parentMessageSchema, type ParentMessageActionState } from './schemas'
import { buildParentMessageEmail } from './template'
import {
  resolveRecipients,
  resolveTeacherContext,
  getStudentClassId,
  canTeacherTargetAudience,
  type Recipient,
} from './recipients'
import type { ParentMessageSenderRole } from '@/types/database'

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

async function getSchoolName(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  schoolId: string,
) {
  const { data } = await adminClient.from('schools').select('name').eq('id', schoolId).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'Your school'
}

/**
 * Send a free-text email to parents. Callable from the admin and teacher
 * message pages. Recipients are resolved server-side from IDs; teachers are
 * restricted to parents of pupils in their own classes. Emails are sent
 * per-recipient (never a shared To/CC) so the parent list never leaks, and each
 * send is recorded in email_notifications + a parent_messages audit row.
 */
export async function sendParentMessageAction(
  _prev: ParentMessageActionState,
  formData: FormData,
): Promise<ParentMessageActionState> {
  const user = await requireAuth()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }

  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r))
  const isTeacher = user.roles.includes('teacher')
  if (!isAdmin && !isTeacher) return { error: 'You do not have permission to send messages.' }

  // Parse audience from form fields (type + the relevant id).
  const audienceType = formData.get('audienceType')
  const rawAudience =
    audienceType === 'class'
      ? { type: 'class', classId: String(formData.get('classId') ?? '') }
      : audienceType === 'student'
        ? { type: 'student', studentId: String(formData.get('studentId') ?? '') }
        : { type: 'school' }

  const parsed = parentMessageSchema.safeParse({
    subject: formData.get('subject'),
    body: formData.get('body'),
    audience: rawAudience,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }
  const { subject, body, audience } = parsed.data

  const adminClient = createSupabaseAdminClient()
  const schoolId = user.schoolId
  const senderRole: ParentMessageSenderRole = isAdmin ? 'admin' : 'teacher'

  // Teacher authorization: restrict to their own classes; no school-wide blast.
  if (senderRole === 'teacher') {
    const ctx = await resolveTeacherContext(adminClient, schoolId, user.email)
    if (!ctx) return { error: 'No active teacher record found for your account.' }
    const studentClassId =
      audience.type === 'student'
        ? await getStudentClassId(adminClient, schoolId, audience.studentId)
        : null
    const allowed = canTeacherTargetAudience(audience, {
      teacherClassIds: ctx.classIds,
      studentClassId,
    })
    if (!allowed) return { error: 'You can only message parents of pupils in your own classes.' }
  }

  const recipients = await resolveRecipients(adminClient, schoolId, audience)
  if (recipients.length === 0) {
    return { error: 'No parents with an email address were found for the selected recipients.' }
  }

  // Record the composed message (audit) first so we can attach per-parent inbox
  // rows. recipient_count = the number of parents addressed (the in-app inbox
  // delivers to all of them; per-email delivery status lives in email_notifications).
  const { data: messageRow, error: auditError } = await adminClient
    .from('parent_messages')
    .insert({
      school_id: schoolId,
      sender_id: user.id,
      sender_role: senderRole,
      audience_type: audience.type,
      class_id: audience.type === 'class' ? audience.classId : null,
      student_id: audience.type === 'student' ? audience.studentId : null,
      subject,
      body,
      recipient_count: recipients.length,
    })
    .select('id')
    .single()
  if (auditError) {
    logger.error('parent_message_audit_insert_failed', { schoolId, error: auditError.message })
  }
  const messageId = (messageRow as { id: string } | null)?.id ?? null

  // In-app inbox: one row per recipient so parents see the message in the portal.
  if (messageId) {
    const { error: inboxError } = await adminClient.from('parent_message_recipients').insert(
      recipients.map((r) => ({
        message_id: messageId,
        parent_id: r.parentId,
        school_id: schoolId,
      })),
    )
    if (inboxError) {
      logger.error('parent_message_inbox_insert_failed', { schoolId, error: inboxError.message })
    }
  }

  // Email delivery (best-effort; logged per-recipient in email_notifications).
  const schoolName = await getSchoolName(adminClient, schoolId)
  const senderName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ').trim() || user.email
  const email = buildParentMessageEmail({ schoolName, senderName, subject, body })
  await sendToRecipients(adminClient, schoolId, schoolName, recipients, email, user.email)

  logger.info('parent_message_sent', {
    schoolId,
    senderRole,
    audience: audience.type,
    recipients: recipients.length,
  })
  revalidatePath('/admin/messages')
  revalidatePath('/teacher/messages')
  return { success: true, recipientCount: recipients.length }
}

/**
 * Mark one of the logged-in parent's inbox messages as read. Scoped to the
 * caller's own rows (parent_id = user.id) so a parent cannot touch another's.
 */
export async function markMessageReadAction(recipientId: string): Promise<void> {
  const user = await requireAuth()
  if (!user.schoolId) return
  const adminClient = createSupabaseAdminClient()
  await adminClient
    .from('parent_message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .eq('parent_id', user.id)
    .is('read_at', null)
  revalidatePath('/parent/messages')
}

async function sendToRecipients(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  schoolId: string,
  schoolName: string,
  recipients: Recipient[],
  email: { subject: string; html: string; text: string },
  replyTo: string,
): Promise<number> {
  const resend = getResend()
  const from = buildEmailFrom(schoolName)
  let sentCount = 0

  const results = await Promise.allSettled(
    recipients.map(async (r) => {
      const { data, error } = await resend.emails.send({
        from,
        to: r.email,
        replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })
      await adminClient.from('email_notifications').insert({
        order_id: null,
        school_id: schoolId,
        type: 'parent_message' as const,
        recipient_email: r.email,
        subject: email.subject,
        status: error ? ('failed' as const) : ('sent' as const),
        provider_message_id: error ? null : (data?.id ?? null),
        failure_details: error ? error.message : null,
        last_attempted_at: new Date().toISOString(),
        sent_at: error ? null : new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      sentCount += 1
    }),
  )

  const failures = results.filter((r) => r.status === 'rejected').length
  if (failures > 0) logger.warn('parent_message_partial_failure', { schoolId, failures })
  return sentCount
}
