'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { schoolHasSmsAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  resolveTeacherContext,
  getStudentClassId,
  canTeacherTargetAudience,
} from '@/lib/messages/recipients'
import { parentSmsSchema, type SmsActionState } from './schemas'
import { resolveSmsRecipients } from './recipients'
import { getSmsConfig, sendSms } from './client'
import { countSegments } from './segments'
import {
  quoteCharge,
  applyCharge,
  periodReset,
  periodStartOf,
  type SmsBalanceState,
} from './credits'

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

interface BalanceRow extends SmsBalanceState {
  period_start: string
}

/** Load the school's SMS balance, creating a default row + applying the monthly
 *  reset. Tenant-scoped by school_id. */
async function loadBalance(adminClient: AdminClient, schoolId: string): Promise<BalanceRow> {
  const { data } = await adminClient
    .from('school_sms_balance')
    .select('included_limit, included_used, period_start, credits, credits_expire_at')
    .eq('school_id', schoolId)
    .maybeSingle()

  let row = data as {
    included_limit: number
    included_used: number
    period_start: string
    credits: number
    credits_expire_at: string | null
  } | null

  if (!row) {
    const period_start = periodStartOf(new Date())
    await adminClient.from('school_sms_balance').insert({ school_id: schoolId, period_start })
    row = {
      included_limit: 100,
      included_used: 0,
      period_start,
      credits: 0,
      credits_expire_at: null,
    }
  }

  const reset = periodReset(row.period_start, new Date())
  if (reset) {
    await adminClient
      .from('school_sms_balance')
      .update({ included_used: 0, period_start: reset.periodStart })
      .eq('school_id', schoolId)
    row = { ...row, included_used: 0, period_start: reset.periodStart }
  }

  // Purchased credits past their 12-month window are no longer spendable.
  if (row.credits > 0 && row.credits_expire_at && new Date(row.credits_expire_at) < new Date()) {
    await adminClient
      .from('school_sms_balance')
      .update({ credits: 0, credits_expire_at: null })
      .eq('school_id', schoolId)
    row = { ...row, credits: 0, credits_expire_at: null }
  }

  return {
    includedLimit: row.included_limit,
    includedUsed: row.included_used,
    credits: row.credits,
    period_start: row.period_start,
  }
}

/**
 * Send an SMS to parents. Callable from admin + teacher SMS pages. Recipients
 * resolved server-side (tenant-scoped, valid Irish mobile, not opted out);
 * teachers restricted to their own classes. Billing is server-authoritative:
 * the affordability check runs on the full blast, and credits are debited for
 * the messages actually accepted by Twilio. Never trusts a client-supplied count.
 */
export async function sendParentSmsAction(
  _prev: SmsActionState,
  formData: FormData,
): Promise<SmsActionState> {
  const user = await requireAuth()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }

  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r))
  const isTeacher = user.roles.includes('teacher')
  if (!isAdmin && !isTeacher) return { error: 'You do not have permission to send texts.' }

  // SMS is gated behind the €44.99 Pro+SMS tier (server-authoritative entitlement).
  if (!(await schoolHasSmsAccess(user.schoolId))) {
    return { error: 'Texting parents requires the Pro + SMS plan. Upgrade to enable it.' }
  }

  const audienceType = formData.get('audienceType')
  const rawAudience =
    audienceType === 'class'
      ? { type: 'class', classId: String(formData.get('classId') ?? '') }
      : audienceType === 'student'
        ? { type: 'student', studentId: String(formData.get('studentId') ?? '') }
        : { type: 'school' }

  const parsed = parentSmsSchema.safeParse({ body: formData.get('body'), audience: rawAudience })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }
  const { body, audience } = parsed.data

  const adminClient = createSupabaseAdminClient()
  const schoolId = user.schoolId

  // Teacher authorization: own classes only; no school-wide blast.
  if (!isAdmin) {
    const ctx = await resolveTeacherContext(adminClient, schoolId, user.email)
    if (!ctx) return { error: 'No active teacher record found for your account.' }
    const studentClassId =
      audience.type === 'student'
        ? await getStudentClassId(adminClient, schoolId, audience.studentId)
        : null
    if (!canTeacherTargetAudience(audience, { teacherClassIds: ctx.classIds, studentClassId })) {
      return { error: 'You can only text parents of pupils in your own classes.' }
    }
  }

  if (!getSmsConfig()) return { error: 'Texting is not set up yet. Please contact support.' }

  const { recipients, noPhoneCount, optedOutCount } = await resolveSmsRecipients(
    adminClient,
    schoolId,
    audience,
  )
  if (recipients.length === 0) {
    return {
      error: 'No parents with a valid mobile number were found for the selected recipients.',
    }
  }

  const segments = countSegments(body).segments

  // Server-authoritative billing: check the FULL blast is affordable up front.
  const balance = await loadBalance(adminClient, schoolId)
  const fullQuote = quoteCharge(balance, recipients.length, segments)
  if (!fullQuote.affordable) {
    return {
      error: `Not enough SMS credits — this needs ${fullQuote.needed} credit${fullQuote.needed === 1 ? '' : 's'} and you're ${fullQuote.shortfall} short. Top up to send.`,
    }
  }

  // Audit row first so per-recipient status rows can reference it.
  const { data: msgRow } = await adminClient
    .from('sms_messages')
    .insert({
      school_id: schoolId,
      sender_id: user.id,
      sender_role: isAdmin ? 'admin' : 'teacher',
      audience_type: audience.type,
      class_id: audience.type === 'class' ? audience.classId : null,
      student_id: audience.type === 'student' ? audience.studentId : null,
      body,
      segments,
      recipient_count: recipients.length,
      credits_charged: 0,
    })
    .select('id')
    .single()
  const smsMessageId = (msgRow as { id: string } | null)?.id ?? null

  // Send per-recipient; charge only for messages Twilio accepted.
  let sent = 0
  let failed = 0
  await Promise.allSettled(
    recipients.map(async (r) => {
      const result = await sendSms(r.phone, body)
      if (result.ok) sent += 1
      else failed += 1
      await adminClient.from('sms_notifications').insert({
        sms_message_id: smsMessageId,
        school_id: schoolId,
        recipient_parent_id: r.parentId,
        recipient_phone: r.phone,
        status: result.ok ? ('sent' as const) : ('failed' as const),
        provider_message_sid: result.ok ? result.sid : null,
        segments,
        failure_details: result.ok ? null : result.error,
      })
    }),
  )

  // Debit credits for accepted messages only (allowance first, then credits).
  const creditsCharged = sent * segments
  if (creditsCharged > 0) {
    const chargeQuote = quoteCharge(balance, sent, segments)
    const after = applyCharge(balance, chargeQuote)
    await adminClient
      .from('school_sms_balance')
      .update({ included_used: after.includedUsed, credits: after.credits })
      .eq('school_id', schoolId)
  }
  if (smsMessageId) {
    await adminClient
      .from('sms_messages')
      .update({ credits_charged: creditsCharged })
      .eq('id', smsMessageId)
  }

  logger.info('parent_sms_sent', { schoolId, sent, failed, segments, creditsCharged })
  revalidatePath('/admin/sms')
  revalidatePath('/teacher/sms')
  return {
    success: true,
    sent,
    failed,
    noPhone: noPhoneCount,
    optedOut: optedOutCount,
    creditsCharged,
  }
}
