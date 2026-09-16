'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from './client'
import { buildEmailFrom } from './from'
import { logger } from '@/lib/logging'

export type ActivityEmailRecipient = {
  email: string
  name: string
}

export type ActivityEmailState = {
  success?: string
  error?: string
  sentCount?: number
} | null

const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
})

const inputSchema = z.object({
  activityId: z.string().uuid(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
})

const MAX_RECIPIENTS = 500

export async function sendActivityEmailAction(
  _prev: ActivityEmailState,
  formData: FormData,
): Promise<ActivityEmailState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school associated with your account.' }

  const parsed = inputSchema.safeParse({
    activityId: formData.get('activityId'),
    subject: (formData.get('subject') as string | null)?.trim(),
    body: (formData.get('body') as string | null)?.trim(),
  })
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Invalid input.' }
  }
  const { activityId, subject, body } = parsed.data

  const recipientsRaw = formData.get('recipients') as string
  let recipients: ActivityEmailRecipient[]
  try {
    const raw: unknown = JSON.parse(recipientsRaw)
    const result = z.array(recipientSchema).min(1).max(MAX_RECIPIENTS).safeParse(raw)
    if (!result.success) {
      return { error: 'Invalid recipient data.' }
    }
    recipients = result.data
  } catch {
    return { error: 'Invalid recipient data.' }
  }

  const adminClient = createSupabaseAdminClient()

  // Verify activity belongs to this school
  const { data: activity } = await adminClient
    .from('activities')
    .select('id, name')
    .eq('id', activityId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!activity) return { error: 'Activity not found.' }

  // Per-tenant sender: parents see the email as coming from their own school.
  const { data: school } = await adminClient
    .from('schools')
    .select('name')
    .eq('id', admin.schoolId)
    .maybeSingle()
  const schoolName = (school as { name: string } | null)?.name ?? null

  const resend = getResend()
  const from = buildEmailFrom(schoolName)

  // Convert plain text body to minimal HTML
  const htmlBody = body
    .split('\n')
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 12px;font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${line}</p>`
        : '',
    )
    .join('')

  let sentCount = 0
  const failures: string[] = []
  let firstErrorMessage: string | null = null

  for (const recipient of recipients) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: recipient.email,
        subject,
        text: body,
        html: `<div>${htmlBody}</div>`,
      })
      if (error) {
        failures.push(recipient.email)
        if (!firstErrorMessage) firstErrorMessage = error.message
        logger.warn('activity_email_send_failed', {
          activityId,
          email: recipient.email,
          error: error.message,
        })
      } else {
        sentCount++
      }
    } catch (err) {
      failures.push(recipient.email)
      if (!firstErrorMessage) firstErrorMessage = String(err)
      logger.error('activity_email_exception', {
        activityId,
        email: recipient.email,
        error: String(err),
      })
    }
  }

  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email ?? '',
    action: 'activity.email_sent',
    resource_type: 'activity',
    resource_id: activityId,
    metadata: {
      activity_name: activity.name,
      subject,
      sent_count: sentCount,
      failed_count: failures.length,
      recipient_count: recipients.length,
    },
    correlation_id: null,
    ip_address: null,
  })

  if (sentCount === 0) {
    const detail = firstErrorMessage ? `: ${firstErrorMessage}` : ''
    return { error: `Failed to send emails${detail}` }
  }

  if (failures.length > 0) {
    return {
      success: `Sent to ${sentCount} parent${sentCount !== 1 ? 's' : ''}. ${failures.length} could not be delivered.`,
      sentCount,
    }
  }

  return {
    success: `Email sent to ${sentCount} parent${sentCount !== 1 ? 's' : ''}.`,
    sentCount,
  }
}
