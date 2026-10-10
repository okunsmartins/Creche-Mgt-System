'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { logger } from '@/lib/logging'
import { getPortalOwnerEmail } from '@/lib/tenant/owner'
import { parseWebsiteEnquiry } from './website'
import { buildCrecheNotificationEmail, buildParentConfirmationEmail } from './website-emails'

export type WebsiteEnquiryState = { ok: true } | { ok: false; error: string } | null

/** Max form submissions per email address, per crèche, per hour (anti-abuse). */
const MAX_PER_EMAIL_PER_HOUR = 3

/**
 * Public waiting-list / visit form on any crèche's own page. Anonymous, so the crèche
 * is resolved server-side from the request (subdomain, /s/<slug> path or session)
 * — never from a client-supplied id. The enquiry lands in that crèche's Enquiries CRM
 * as "new"; the family gets a branded confirmation and the crèche team a heads-up.
 */
export async function submitWebsiteEnquiryAction(
  _prev: WebsiteEnquiryState,
  formData: FormData,
): Promise<WebsiteEnquiryState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(`website-enquiry:${ip}`).allowed) {
    return { ok: false, error: 'Too many requests. Please wait a minute and try again.' }
  }

  const { school } = await getPublicViewerContext()
  if (!school) return { ok: false, error: 'This form only works on a crèche’s own page.' }

  const parsed = parseWebsiteEnquiry(formData)
  if (parsed.ok === 'spam') return { ok: true }
  if (!parsed.ok) return parsed
  const e = parsed.enquiry

  const db = createSupabaseAdminClient()

  // Anti-abuse: the form emails whatever address is typed in, so cap repeats per
  // address. Over the cap we quietly accept without saving or emailing again.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recent } = await db
    .from('enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', school.id)
    // Escape LIKE wildcards so the match is exact (case-insensitive).
    .ilike(
      'parent_email',
      e.parentEmail.replace(/[\\%_]/g, (c) => `\\${c}`),
    )
    .gte('created_at', since)
  if ((recent ?? 0) >= MAX_PER_EMAIL_PER_HOUR) {
    logger.warn('website_enquiry_throttled', { schoolId: school.id })
    return { ok: true }
  }

  const { error } = await db.from('enquiries').insert({
    school_id: school.id,
    parent_name: e.parentName,
    parent_email: e.parentEmail,
    parent_phone: e.parentPhone,
    child_first_name: e.childFirstName,
    child_dob: e.childDob,
    desired_start_date: e.desiredStartDate,
    notes: e.notes,
    source: 'Website',
    status: 'new',
    created_by: null,
  })
  if (error) {
    logger.error('website_enquiry_failed', { schoolId: school.id, error: error.message })
    return { ok: false, error: 'Sorry, we couldn’t send your enquiry. Please try again.' }
  }
  logger.info('website_enquiry_received', { schoolId: school.id })
  revalidatePath('/admin/enquiries')

  // Emails are best-effort: the enquiry is already saved either way.
  // Platform rule: the crèche is notified at the email that SET UP its portal (its
  // first admin). Its public contact email is only a fallback if that account is
  // gone. Never a platform address, so enquiries can't leave the crèche.
  const ownerEmail = await getPortalOwnerEmail(db, school.id)
  const team = [ownerEmail ?? school.email].filter((x): x is string => !!x)
  // Parents reply to the crèche's public contact email if it has one, else the owner.
  const replyContact = school.email ?? ownerEmail ?? null
  const from = buildEmailFrom(school.name)
  const resend = getResend()

  const parentMail = buildParentConfirmationEmail(school.name, e, replyContact)
  const crecheMail = buildCrecheNotificationEmail(school.name, e)

  const results = await Promise.allSettled([
    resend.emails.send({
      from,
      to: e.parentEmail,
      ...(replyContact ? { replyTo: replyContact } : {}),
      subject: parentMail.subject,
      html: parentMail.html,
      text: parentMail.text,
    }),
    team.length
      ? resend.emails.send({
          from,
          to: team,
          replyTo: e.parentEmail,
          subject: crecheMail.subject,
          html: crecheMail.html,
          text: crecheMail.text,
        })
      : Promise.resolve(null),
  ])

  results.forEach((r, i) => {
    const which = i === 0 ? 'parent' : 'creche'
    const failed =
      r.status === 'rejected'
        ? String(r.reason)
        : (r.value as { error?: { message?: string } | null } | null)?.error?.message
    if (failed)
      logger.warn('website_enquiry_email_failed', { schoolId: school.id, which, error: failed })
  })
  if (!team.length) logger.warn('website_enquiry_no_creche_recipient', { schoolId: school.id })

  return { ok: true }
}
