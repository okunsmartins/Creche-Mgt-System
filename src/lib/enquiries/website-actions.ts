'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { logger } from '@/lib/logging'
import { parseWebsiteEnquiry } from './website'
import { buildCrecheNotificationEmail, buildParentConfirmationEmail } from './website-emails'

export type WebsiteEnquiryState = { ok: true } | { ok: false; error: string } | null

/** Max form submissions per email address, per crèche, per hour (anti-abuse). */
const MAX_PER_EMAIL_PER_HOUR = 3

type Db = ReturnType<typeof createSupabaseAdminClient>

/**
 * Where to tell the crèche about a new enquiry: its contact email if set, else the
 * login emails of its admins (school_admin / super_admin) — never a platform address,
 * so one crèche's enquiries can't reach anyone outside it.
 */
async function crecheRecipients(db: Db, schoolId: string, schoolEmail: string | null) {
  if (schoolEmail) return [schoolEmail]
  const { data: roleRows } = await db
    .from('roles')
    .select('id')
    .in('name', ['school_admin', 'super_admin'])
  const roleIds = ((roleRows as { id: string }[] | null) ?? []).map((r) => r.id)
  if (!roleIds.length) return []
  const { data: urRows } = await db
    .from('user_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .in('role_id', roleIds)
  const userIds = [
    ...new Set(((urRows as { user_id: string }[] | null) ?? []).map((r) => r.user_id)),
  ]
  if (!userIds.length) return []
  const { data: profiles } = await db
    .from('profiles')
    .select('email, is_active')
    .in('id', userIds)
    .eq('school_id', schoolId)
  return ((profiles as { email: string | null; is_active: boolean }[] | null) ?? [])
    .filter((p) => p.is_active && p.email)
    .map((p) => p.email as string)
    .slice(0, 5)
}

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
  const team = await crecheRecipients(db, school.id, school.email)
  const from = buildEmailFrom(school.name)
  const resend = getResend()

  const parentMail = buildParentConfirmationEmail(school.name, e, school.email ?? team[0] ?? null)
  const crecheMail = buildCrecheNotificationEmail(school.name, e)

  const results = await Promise.allSettled([
    resend.emails.send({
      from,
      to: e.parentEmail,
      ...(school.email || team[0] ? { replyTo: school.email ?? team[0]! } : {}),
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
