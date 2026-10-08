'use server'

import { revalidatePath } from 'next/cache'
import { requireParent } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { resolveSchoolAdminEmail } from '@/lib/email/send'
import { buildEmailFrom } from '@/lib/email/from'
import { getResend } from '@/lib/email/client'
import { validateEnquiry } from './enquiries'

type Result = { ok: true } | { ok: false; error: string }
const ISO = /^\d{4}-\d{2}-\d{2}$/

export interface ParentEnquiryInput {
  childFirstName?: string
  childLastName?: string
  childDob?: string
  desiredStartDate?: string
  message: string
}

/**
 * A logged-in parent submits an enquiry (e.g. a place for another child). It lands in the
 * crèche's Enquiries / waiting-list CRM (source "Parent portal") and the admin is emailed.
 * The parent's name/email come from their account, not the form.
 */
export async function submitParentEnquiryAction(input: ParentEnquiryInput): Promise<Result> {
  const parent = await requireParent()
  if (!parent.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  const message = input.message?.trim() ?? ''
  if (message === '') return { ok: false, error: 'Please enter your enquiry.' }
  if (input.childDob && !ISO.test(input.childDob))
    return { ok: false, error: 'Invalid date of birth.' }
  if (input.desiredStartDate && !ISO.test(input.desiredStartDate))
    return { ok: false, error: 'Invalid preferred start date.' }

  const parentName =
    [parent.profile?.firstName, parent.profile?.lastName].filter(Boolean).join(' ') || parent.email
  const check = validateEnquiry({ parentName, parentEmail: parent.email })
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  const { error } = await db.from('enquiries').insert({
    school_id: parent.schoolId,
    parent_name: parentName,
    parent_email: parent.email,
    child_first_name: input.childFirstName?.trim() || null,
    child_last_name: input.childLastName?.trim() || null,
    child_dob: input.childDob || null,
    desired_start_date: input.desiredStartDate || null,
    source: 'Parent portal',
    notes: message,
    status: 'new',
    created_by: parent.id,
  })
  if (error) {
    logger.error('parent_enquiry_create_failed', {
      schoolId: parent.schoolId,
      error: error.message,
    })
    return { ok: false, error: 'Could not submit your enquiry. Please try again.' }
  }

  // Best-effort notification to the crèche admin — never blocks the submission.
  try {
    const to = await resolveSchoolAdminEmail(parent.schoolId, db)
    const childLine =
      [input.childFirstName, input.childLastName].filter(Boolean).join(' ').trim() || '—'
    await getResend().emails.send({
      from: buildEmailFrom(parent.schoolName),
      to,
      subject: `New parent enquiry${parent.schoolName ? ` — ${parent.schoolName}` : ''}`,
      html: `<p>A parent submitted an enquiry via the portal.</p>
<ul>
  <li><strong>From:</strong> ${parentName} (${parent.email})</li>
  <li><strong>Child:</strong> ${childLine}</li>
  <li><strong>Preferred start:</strong> ${input.desiredStartDate || '—'}</li>
</ul>
<p><strong>Message:</strong><br>${message.replace(/</g, '&lt;')}</p>
<p>See it under Enquiries in your admin portal.</p>`,
    })
  } catch (e) {
    logger.error('parent_enquiry_admin_email_failed', {
      schoolId: parent.schoolId,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  revalidatePath('/admin/enquiries')
  return { ok: true }
}
