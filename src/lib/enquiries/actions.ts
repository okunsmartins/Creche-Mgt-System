'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { renderBrandedEmail } from '@/lib/email/layout'
import { logger } from '@/lib/logging'
import { validateEnquiry, isEnquiryStatus } from './enquiries'

type Result = { ok: true } | { ok: false; error: string }

/** Escape admin/enquirer-controlled text before interpolating into email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function createEnquiryAction(input: {
  parentName: string
  parentEmail?: string
  parentPhone?: string
  childFirstName?: string
  childLastName?: string
  desiredStartDate?: string
  source?: string
  notes?: string
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateEnquiry({
    parentName: input.parentName,
    parentEmail: input.parentEmail ?? null,
  })
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  const { error } = await db.from('enquiries').insert({
    school_id: schoolId,
    parent_name: input.parentName.trim(),
    parent_email: input.parentEmail?.trim() || null,
    parent_phone: input.parentPhone?.trim() || null,
    child_first_name: input.childFirstName?.trim() || null,
    child_last_name: input.childLastName?.trim() || null,
    desired_start_date: input.desiredStartDate || null,
    source: input.source?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'new',
    created_by: admin.id,
  })
  if (error) {
    logger.error('enquiry_create_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not save the enquiry.' }
  }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}

export async function updateEnquiryStatusAction(id: string, status: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!isEnquiryStatus(status)) return { ok: false, error: 'Invalid status.' }
  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('enquiries')
    .update({ status })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not update the enquiry.' }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}

/**
 * Email the enquiring parent directly from the enquiries list. Sends the admin's
 * subject + message via Resend, branded as the crèche. School-scoped; marks a
 * still-"new" enquiry as "contacted" on a successful send.
 */
export async function sendEnquiryEmailAction(
  id: string,
  subject: string,
  message: string,
): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!

  const subj = subject?.trim()
  const body = message?.trim()
  if (!subj) return { ok: false, error: 'Enter a subject.' }
  if (!body) return { ok: false, error: 'Enter a message.' }

  const db = createSupabaseAdminClient()
  const { data: enquiry } = await db
    .from('enquiries')
    .select('id, parent_name, parent_email, status')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()
  const e = enquiry as {
    id: string
    parent_name: string
    parent_email: string | null
    status: string
  } | null
  if (!e) return { ok: false, error: 'Enquiry not found in this crèche.' }
  if (!e.parent_email) return { ok: false, error: 'This enquiry has no email address on record.' }

  const { data: schoolRow } = await db
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  const schoolName = (schoolRow as { name: string } | null)?.name ?? 'your crèche'

  const greeting = e.parent_name
    ? `Hi ${esc(e.parent_name.split(' ')[0] ?? e.parent_name)},`
    : 'Hi,'
  const bodyHtml = esc(body).replace(/\n/g, '<br>')
  const html = renderBrandedEmail({
    schoolName,
    subtitle: `Message from ${schoolName}`,
    bodyHtml: `<p style="margin:0 0 12px">${greeting}</p><div>${bodyHtml}</div>`,
  })

  const { error: sendError } = await getResend().emails.send({
    from: buildEmailFrom(schoolName),
    to: e.parent_email,
    subject: subj,
    html,
    text: `${e.parent_name ? `Hi ${e.parent_name},` : 'Hi,'}\n\n${body}\n\n${schoolName}`,
  })
  if (sendError) {
    logger.error('enquiry_email_failed', { id, error: sendError.message })
    return { ok: false, error: 'Could not send the email. Please try again.' }
  }

  // Nudge the pipeline forward: a "new" enquiry becomes "contacted" once emailed.
  if (e.status === 'new') {
    await db
      .from('enquiries')
      .update({ status: 'contacted' })
      .eq('id', id)
      .eq('school_id', schoolId)
  }

  logger.info('enquiry_email_sent', { schoolId, id })
  revalidatePath('/admin/enquiries')
  return { ok: true }
}

export async function deleteEnquiryAction(id: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()
  const { error } = await db.from('enquiries').delete().eq('id', id).eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not delete the enquiry.' }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}
