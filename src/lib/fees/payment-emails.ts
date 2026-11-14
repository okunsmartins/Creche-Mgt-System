// Email content for online fee payments: the parent's receipt, and the alert to the
// crèche when more was received than was owed. Pure builders (unit-tested); sending
// lives in record-payment.ts.

import { renderBrandedEmail, escapeEmailHtml as esc } from '@/lib/email/layout'
import { formatCurrency } from '@/lib/utils'

export interface FeeReceiptData {
  schoolName: string
  childName: string
  /** e.g. "Invoice INV-2026-000025" or "Late collection fee". */
  subjectLabel: string
  amountCents: number
  /** Still owed on this invoice/fee after the payment (0 = fully paid). */
  balanceCents: number
  paidAtISO: string
  /** Where the parent can see their invoices (or late fees). */
  portalUrl: string
}

/** Button label matching the page the portal link opens. */
const portalLinkLabel = (url: string): string =>
  url.endsWith('/late-fees') ? 'View your late fees' : 'View your invoices'

const providerDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  })

function rowsHtml(rows: [string, string][]): string {
  return `<table style="border-collapse:collapse;margin:16px 0;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`,
    )
    .join('')}</table>`
}

/** Receipt the parent(s) get after paying an invoice or late fee online. */
export function buildFeeReceiptEmail(d: FeeReceiptData): {
  subject: string
  html: string
  text: string
} {
  const amount = formatCurrency(d.amountCents)
  const subject = `Payment received: ${amount} for ${d.childName}`
  const rows: [string, string][] = [
    ['For', d.subjectLabel],
    ['Child', d.childName],
    ['Amount paid', amount],
    ['Date', providerDate(d.paidAtISO)],
    ['Still to pay', d.balanceCents > 0 ? formatCurrency(d.balanceCents) : 'Nothing, fully paid'],
  ]
  const html = renderBrandedEmail({
    schoolName: d.schoolName,
    subtitle: 'Payment receipt',
    bodyHtml: `
      <p style="margin:0 0 12px">Hi,</p>
      <p>Thank you. ${esc(d.schoolName)} has received your payment.</p>
      ${rowsHtml(rows)}
      <p style="margin:16px 0">
        <a href="${d.portalUrl}" style="display:inline-block;background:#573c9b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          ${portalLinkLabel(d.portalUrl)}
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;margin:0">Please keep this email as your receipt. For any questions, contact the crèche directly.</p>`,
  })
  const text = [
    'Hi,',
    '',
    `Thank you. ${d.schoolName} has received your payment.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `${portalLinkLabel(d.portalUrl)}: ${d.portalUrl}`,
    '',
    'Please keep this email as your receipt.',
  ].join('\n')
  return { subject, html, text }
}

export interface OverpaymentAlertData {
  schoolName: string
  childName: string
  subjectLabel: string
  excessCents: number
  provider: 'stripe' | 'revolut'
  /** Stripe checkout session id or Revolut order id of the payment that caused it. */
  reference: string
  /** The admin fees page for this child. */
  adminUrl: string
}

/** Alert to the crèche: money was received beyond what was owed and should be refunded. */
export function buildOverpaymentAlertEmail(d: OverpaymentAlertData): {
  subject: string
  html: string
  text: string
} {
  const excess = formatCurrency(d.excessCents)
  const providerName = d.provider === 'stripe' ? 'Stripe' : 'Revolut Business'
  const subject = `Action needed: ${excess} overpaid for ${d.childName}`
  const rows: [string, string][] = [
    ['For', d.subjectLabel],
    ['Child', d.childName],
    ['Paid too much by', excess],
    ['Paid through', providerName],
    ['Payment reference', d.reference],
  ]
  const html = renderBrandedEmail({
    schoolName: d.schoolName,
    subtitle: 'Payment needs attention',
    bodyHtml: `
      <p style="margin:0 0 12px">Hi,</p>
      <p>A parent paid <strong>${esc(excess)} more than was owed</strong>. This usually means the same
         fee was paid twice, or it was paid after the invoice was voided.</p>
      ${rowsHtml(rows)}
      <p>Please refund ${esc(excess)} to the parent from your ${esc(providerName)} dashboard, using the
         payment reference above.</p>
      <p style="margin:16px 0">
        <a href="${d.adminUrl}" style="display:inline-block;background:#573c9b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          View this child's fees
        </a>
      </p>`,
  })
  const text = [
    'Hi,',
    '',
    `A parent paid ${excess} more than was owed. This usually means the same fee was paid twice, or it was paid after the invoice was voided.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Please refund ${excess} to the parent from your ${providerName} dashboard, using the payment reference above.`,
    `View this child's fees: ${d.adminUrl}`,
  ].join('\n')
  return { subject, html, text }
}

export interface FeeRefundData {
  schoolName: string
  childName: string
  /** e.g. "Invoice INV-2026-000025" or "Late collection fee". */
  subjectLabel: string
  amountCents: number
  refundedAtISO: string
  portalUrl: string
}

/** Notice the parent(s) get when the crèche refunds an online fee payment. */
export function buildFeeRefundEmail(d: FeeRefundData): {
  subject: string
  html: string
  text: string
} {
  const amount = formatCurrency(d.amountCents)
  const subject = `Refund: ${amount} for ${d.childName}`
  const rows: [string, string][] = [
    ['For', d.subjectLabel],
    ['Child', d.childName],
    ['Amount refunded', amount],
    ['Date', providerDate(d.refundedAtISO)],
  ]
  const label = portalLinkLabel(d.portalUrl)
  const html = renderBrandedEmail({
    schoolName: d.schoolName,
    subtitle: 'Refund',
    bodyHtml: `
      <p style="margin:0 0 12px">Hi,</p>
      <p>${esc(d.schoolName)} has refunded part or all of your payment. It goes back to the card or account you paid with, usually within 5–10 working days.</p>
      ${rowsHtml(rows)}
      <p style="margin:16px 0">
        <a href="${d.portalUrl}" style="display:inline-block;background:#573c9b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
          ${label}
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;margin:0">For any questions, contact the crèche directly.</p>`,
  })
  const text = [
    'Hi,',
    '',
    `${d.schoolName} has refunded part or all of your payment. It goes back to the card or account you paid with, usually within 5–10 working days.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `${label}: ${d.portalUrl}`,
  ].join('\n')
  return { subject, html, text }
}
