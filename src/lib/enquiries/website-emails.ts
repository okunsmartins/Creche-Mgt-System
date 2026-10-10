// Emails sent when a family submits a crèche's public waiting-list / visit form.
// Pure builders (no I/O) so they can be unit-tested. Every dynamic value is
// HTML-escaped; both emails use the crèche-branded layout.

import { escapeEmailHtml as esc, renderBrandedEmail } from '@/lib/email/layout'
import type { WebsiteEnquiry } from './website'

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/** The details the family gave, as label/value pairs (empty ones left out). */
function detailRows(e: WebsiteEnquiry, includeContact: boolean): [string, string][] {
  const rows: [string, string | null][] = [
    ...(includeContact
      ? ([
          ['Parent', e.parentName],
          ['Email', e.parentEmail],
          ['Phone', e.parentPhone],
        ] as [string, string | null][])
      : []),
    ['Child', e.childFirstName],
    ['Date of birth', e.childDob ? formatDate(e.childDob) : null],
    ['Hoped-for start', e.desiredStartDate ? formatDate(e.desiredStartDate) : null],
    ['Days needed', e.days.length ? e.days.join(', ') : null],
    ['Would like a visit', e.wantsVisit ? 'Yes' : null],
  ]
  return rows.filter((r): r is [string, string] => !!r[1])
}

function rowsHtml(rows: [string, string][]): string {
  if (!rows.length) return ''
  return `<table style="border-collapse:collapse;margin:8px 0 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#6b7280;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`
}

function messageHtml(message: string | null, label: string): string {
  if (!message) return ''
  return `<p style="margin:16px 0 4px;color:#6b7280">${esc(label)}</p><blockquote style="margin:0;padding:10px 14px;border-left:4px solid #c9bdf0;background:#f7f5fd;white-space:pre-line">${esc(message)}</blockquote>`
}

/**
 * Confirmation to the family who filled in the form. `replyContact` is where a reply
 * goes (the crèche's email), shown so the family knows how to follow up.
 */
export function buildParentConfirmationEmail(
  schoolName: string,
  e: WebsiteEnquiry,
  replyContact: string | null,
): BuiltEmail {
  const firstName = e.parentName.split(/\s+/)[0] || e.parentName
  const child = e.childFirstName ? `${e.childFirstName}'s` : 'your'
  const subject = `Thanks for your enquiry — ${schoolName}`
  const visitLine = e.wantsVisit
    ? `<p style="margin:12px 0 0">You asked to visit — we'll suggest a few times that suit.</p>`
    : ''
  const contactLine = replyContact
    ? `<p style="margin:16px 0 0">Questions in the meantime? Just reply to this email or write to <a href="mailto:${esc(replyContact)}" style="color:#573c9b">${esc(replyContact)}</a>.</p>`
    : `<p style="margin:16px 0 0">Questions in the meantime? Just reply to this email.</p>`
  const rows = detailRows(e, false)

  const html = renderBrandedEmail({
    schoolName,
    subtitle: 'Waiting list & visits',
    bodyHtml:
      `<p style="margin:0 0 12px">Hi ${esc(firstName)},</p>` +
      `<p style="margin:0">Thank you for your interest in ${esc(schoolName)}. We've received ${esc(child)} enquiry and the team will be in touch soon.</p>` +
      visitLine +
      (rows.length
        ? `<p style="margin:16px 0 0;font-weight:700">What you told us</p>${rowsHtml(rows)}`
        : '') +
      messageHtml(e.message, 'Your message') +
      contactLine,
    footnote: 'You received this because this email address was entered on our waiting-list form.',
  })

  const text = [
    `Hi ${firstName},`,
    '',
    `Thank you for your interest in ${schoolName}. We've received ${child} enquiry and the team will be in touch soon.`,
    ...(e.wantsVisit ? ['', "You asked to visit — we'll suggest a few times that suit."] : []),
    ...(rows.length ? ['', 'What you told us:', ...rows.map(([k, v]) => `- ${k}: ${v}`)] : []),
    ...(e.message ? ['', 'Your message:', e.message] : []),
    '',
    replyContact
      ? `Questions? Reply to this email or write to ${replyContact}.`
      : 'Questions? Just reply to this email.',
    '',
    schoolName,
  ].join('\n')

  return { subject, html, text }
}

/** Heads-up to the crèche team that a new enquiry arrived (reply goes to the parent). */
export function buildCrecheNotificationEmail(schoolName: string, e: WebsiteEnquiry): BuiltEmail {
  const subject = `New ${e.wantsVisit ? 'visit request' : 'waiting-list enquiry'} from ${e.parentName}`
  const rows = detailRows(e, true)
  const html = renderBrandedEmail({
    schoolName,
    subtitle: 'New website enquiry',
    bodyHtml:
      `<p style="margin:0 0 4px">A family has joined your waiting list through your Creche Wise page.</p>` +
      rowsHtml(rows) +
      messageHtml(e.message, 'Their message') +
      `<p style="margin:16px 0 0">It's saved under <strong>Enquiries</strong> in your admin portal. Reply to this email to answer ${esc(e.parentName)} directly.</p>`,
  })
  const text = [
    'A family has joined your waiting list through your Creche Wise page.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(e.message ? ['', 'Their message:', e.message] : []),
    '',
    `It's saved under Enquiries in your admin portal. Reply to this email to answer ${e.parentName} directly.`,
  ].join('\n')
  return { subject, html, text }
}
