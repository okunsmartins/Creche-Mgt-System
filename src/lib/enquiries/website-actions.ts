'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { escapeEmailHtml as esc, renderBrandedEmail } from '@/lib/email/layout'
import { logger } from '@/lib/logging'
import { parseWebsiteEnquiry } from './website'

export type WebsiteEnquiryState = { ok: true } | { ok: false; error: string } | null

/**
 * Public waiting-list / visit form on a crèche's own page. Anonymous, so the crèche
 * is resolved server-side from the request (subdomain, /s/<slug> path or session)
 * — never from a client-supplied id. Lands in that crèche's enquiries CRM as "new".
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

  // Best-effort heads-up to the crèche; the enquiry is already saved either way.
  if (school.email) {
    try {
      const rows = [
        ['Parent', e.parentName],
        ['Email', e.parentEmail],
        ['Phone', e.parentPhone],
        ['Child', e.childFirstName],
        ['Date of birth', e.childDob],
        ['Hoped-for start', e.desiredStartDate],
      ]
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${esc(k!)}</td><td style="padding:4px 0;font-weight:600">${esc(v!)}</td></tr>`,
        )
        .join('')
      const notes = e.notes
        ? `<p style="margin:16px 0 0;white-space:pre-line">${esc(e.notes)}</p>`
        : ''
      await getResend().emails.send({
        from: buildEmailFrom(school.name),
        to: school.email,
        replyTo: e.parentEmail,
        subject: `New waiting-list enquiry from ${e.parentName}`,
        html: renderBrandedEmail({
          schoolName: school.name,
          subtitle: 'New website enquiry',
          bodyHtml: `<p style="margin:0 0 12px">A parent has joined your waiting list through your Creche Wise page.</p><table style="border-collapse:collapse">${rows}</table>${notes}<p style="margin:16px 0 0">You'll find it under <strong>Enquiries</strong> in your admin portal. Reply to this email to answer the parent directly.</p>`,
        }),
      })
    } catch (err) {
      logger.warn('website_enquiry_notify_failed', {
        schoolId: school.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { ok: true }
}
