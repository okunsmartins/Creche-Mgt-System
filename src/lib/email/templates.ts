import { formatCurrency, formatDate } from '@/lib/utils'

export interface OrderEmailItem {
  studentName: string
  className: string
  teacherName?: string | undefined
  activityName: string
  amountCents: number
  verificationStatus?: string | undefined
}

export interface PayerReceiptData {
  schoolName: string
  payerName: string
  orderReference: string
  paymentReference: string
  paidAt: string
  totalCents: number
  items: OrderEmailItem[]
}

export interface SchoolNotificationData {
  schoolName: string
  payerName: string
  payerEmail: string
  orderReference: string
  paymentReference: string
  paidAt: string
  totalCents: number
  source: string
  items: OrderEmailItem[]
  adminOrderUrl: string
}

const SOURCE_LABEL: Record<string, string> = {
  registered_parent: 'Registered parent',
  guest_code: 'Guest (pupil code)',
  guest_manual: 'Guest (manual entry)',
}

// ─── Shared HTML primitives ───────────────────────────────────────────────────

function htmlHeader(schoolName: string): string {
  return `
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Admin Portal</p>
    </div>`
}

// §12.1: showVerification adds a per-item verification/manual-review column for school notification
// Teacher column is shown whenever any item has a teacherName.
function htmlItemsTable(items: OrderEmailItem[], showVerification = false): string {
  const showTeacher = items.some((i) => !!i.teacherName)
  // cols: Child + Class + [Teacher] + Activity + [Verification] + Amount
  const dataCols = 3 + (showTeacher ? 1 : 0) + (showVerification ? 1 : 0)

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(item.studentName)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${esc(item.className)}</td>
        ${showTeacher ? `<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${esc(item.teacherName ?? '—')}</td>` : ''}
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(item.activityName)}</td>
        ${showVerification ? `<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${esc(item.verificationStatus ?? '—')}</td>` : ''}
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">${formatCurrency(item.amountCents)}</td>
      </tr>`,
    )
    .join('')

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Child</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Class</th>
          ${showTeacher ? '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Teacher</th>' : ''}
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Activity</th>
          ${showVerification ? '<th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Verification</th>' : ''}
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="${dataCols}" style="padding:10px 12px;font-size:14px;font-weight:600;text-align:right;">Total</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:700;text-align:right;">${formatCurrency(
            items.reduce((s, i) => s + i.amountCents, 0),
          )}</td>
        </tr>
      </tfoot>
    </table>`
}

function htmlFooter(schoolName: string): string {
  return `
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
      This is an automated message from ${esc(schoolName)} Admin Portal.<br>
      Please do not reply to this email.
    </p>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Portal</title></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">${body}</div></body></html>`
}

// ─── Payer receipt ────────────────────────────────────────────────────────────

export function buildPayerReceiptEmail(data: PayerReceiptData): {
  subject: string
  html: string
  text: string
} {
  // §12.3: subject format includes school name per spec example
  const subject = `${data.schoolName} payment receipt – ${data.orderReference}`

  const html = wrap(`
    ${htmlHeader(data.schoolName)}
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;">Payment Confirmed</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Thank you, ${esc(data.payerName)}. Your payment has been received.</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.orderReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payment reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.paymentReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payment status</td>
            <td style="font-size:13px;font-weight:600;color:#166534;text-align:right;padding:4px 0;">Paid</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Date paid</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${esc(formatDate(data.paidAt, true))}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Total paid</td>
            <td style="font-size:16px;font-weight:700;color:#573c9b;text-align:right;padding:4px 0;">${formatCurrency(data.totalCents)}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size:14px;font-weight:600;margin:0 0 4px;">Payment details</h3>
      ${htmlItemsTable(data.items)}

      <p style="font-size:13px;color:#6b7280;margin-top:20px;">
        Please retain this email as your payment receipt. If you have any queries, please contact the school office directly.
      </p>
    </div>
    ${htmlFooter(data.schoolName)}
  `)

  const text = [
    `${data.schoolName} PAYMENT RECEIPT – ${data.orderReference}`,
    ``,
    `Thank you, ${data.payerName}. Your payment to ${data.schoolName} has been received.`,
    ``,
    `Order reference:   ${data.orderReference}`,
    `Payment reference: ${data.paymentReference}`,
    `Payment status:    Paid`,
    `Date paid:         ${formatDate(data.paidAt, true)}`,
    `Total paid:        ${formatCurrency(data.totalCents)}`,
    ``,
    `ITEMS:`,
    ...data.items.map(
      (i) =>
        `  • ${i.studentName} | ${i.className}${i.teacherName ? ` | ${i.teacherName}` : ''} | ${i.activityName} – ${formatCurrency(i.amountCents)}`,
    ),
    ``,
    `Please retain this email as your payment receipt.`,
    `If you have any queries, please contact the school office directly.`,
    ``,
    `This is an automated message from ${data.schoolName} Admin Portal.`,
  ].join('\n')

  return { subject, html, text }
}

// ─── Deposit receipt ─────────────────────────────────────────────────────────

export interface DepositReceiptData {
  schoolName: string
  payerName: string
  orderReference: string
  paymentReference: string
  paidAt: string
  depositCents: number
  totalCents: number
  remainingCents: number
  items: OrderEmailItem[]
}

export function buildDepositReceiptEmail(data: DepositReceiptData): {
  subject: string
  html: string
  text: string
} {
  const subject = `${data.schoolName} deposit received – ${data.orderReference}`

  const html = wrap(`
    ${htmlHeader(data.schoolName)}
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;">Deposit Received</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Thank you, ${esc(data.payerName)}. Your deposit has been received. The remaining balance is due separately.</p>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.orderReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payment reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.paymentReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payment status</td>
            <td style="font-size:13px;font-weight:600;color:#92400e;text-align:right;padding:4px 0;">Deposit paid</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Date paid</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${esc(formatDate(data.paidAt, true))}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Deposit paid</td>
            <td style="font-size:16px;font-weight:700;color:#92400e;text-align:right;padding:4px 0;">${formatCurrency(data.depositCents)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order total</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${formatCurrency(data.totalCents)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#d97706;font-weight:600;padding:4px 0;">Balance remaining</td>
            <td style="font-size:14px;font-weight:700;color:#d97706;text-align:right;padding:4px 0;">${formatCurrency(data.remainingCents)}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size:14px;font-weight:600;margin:0 0 4px;">Items</h3>
      ${htmlItemsTable(data.items)}

      <p style="font-size:13px;color:#6b7280;margin-top:20px;">
        Please retain this email as your deposit receipt. You will receive a separate payment request for the remaining balance. If you have any queries, please contact the school office directly.
      </p>
    </div>
    ${htmlFooter(data.schoolName)}
  `)

  const text = [
    `${data.schoolName} DEPOSIT RECEIVED – ${data.orderReference}`,
    ``,
    `Thank you, ${data.payerName}. Your deposit to ${data.schoolName} has been received.`,
    ``,
    `Order reference:   ${data.orderReference}`,
    `Payment reference: ${data.paymentReference}`,
    `Payment status:    Deposit paid`,
    `Date paid:         ${formatDate(data.paidAt, true)}`,
    `Deposit paid:      ${formatCurrency(data.depositCents)}`,
    `Order total:       ${formatCurrency(data.totalCents)}`,
    `Balance remaining: ${formatCurrency(data.remainingCents)}`,
    ``,
    `ITEMS:`,
    ...data.items.map(
      (i) =>
        `  • ${i.studentName} | ${i.className}${i.teacherName ? ` | ${i.teacherName}` : ''} | ${i.activityName} – ${formatCurrency(i.amountCents)}`,
    ),
    ``,
    `Please retain this email as your deposit receipt.`,
    `You will receive a separate payment request for the remaining balance.`,
    `If you have any queries, please contact the school office directly.`,
    ``,
    `This is an automated message from ${data.schoolName} Admin Portal.`,
  ].join('\n')

  return { subject, html, text }
}

// ─── Refund notice ───────────────────────────────────────────────────────────

export interface RefundNoticeData {
  schoolName: string
  payerName: string
  orderReference: string
  refundReference: string
  refundedAt: string
  refundAmountCents: number
  remainingPaidCents: number
  totalCents: number
}

export function buildRefundNoticeEmail(data: RefundNoticeData): {
  subject: string
  html: string
  text: string
} {
  const subject = `${data.schoolName} refund processed – ${data.orderReference}`
  const isFullRefund = data.remainingPaidCents <= 0

  const html = wrap(`
    ${htmlHeader(data.schoolName)}
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;">Refund Processed</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">
        ${esc(data.payerName)}, a refund has been processed for your order.
      </p>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.orderReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Refund reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.refundReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Date</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${esc(formatDate(data.refundedAt, true))}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Refunded amount</td>
            <td style="font-size:16px;font-weight:700;color:#dc2626;text-align:right;padding:4px 0;">${formatCurrency(data.refundAmountCents)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order total</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${formatCurrency(data.totalCents)}</td>
          </tr>
          ${
            !isFullRefund
              ? `<tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Remaining paid</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${formatCurrency(data.remainingPaidCents)}</td>
          </tr>`
              : ''
          }
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Status</td>
            <td style="font-size:13px;font-weight:600;color:#dc2626;text-align:right;padding:4px 0;">${isFullRefund ? 'Fully refunded' : 'Partially refunded'}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;">
        Refunds typically appear on your statement within 5–10 business days depending on your bank.
        If you have any queries, please contact the school office directly.
      </p>
    </div>
    ${htmlFooter(data.schoolName)}
  `)

  const text = [
    `${data.schoolName} REFUND PROCESSED – ${data.orderReference}`,
    ``,
    `${data.payerName}, a refund has been processed for your order.`,
    ``,
    `Order reference:   ${data.orderReference}`,
    `Refund reference:  ${data.refundReference}`,
    `Date:              ${formatDate(data.refundedAt, true)}`,
    `Refunded amount:   ${formatCurrency(data.refundAmountCents)}`,
    `Order total:       ${formatCurrency(data.totalCents)}`,
    ...(!isFullRefund ? [`Remaining paid:    ${formatCurrency(data.remainingPaidCents)}`] : []),
    `Status:            ${isFullRefund ? 'Fully refunded' : 'Partially refunded'}`,
    ``,
    `Refunds typically appear on your statement within 5–10 business days.`,
    `If you have any queries, please contact the school office directly.`,
    ``,
    `This is an automated message from ${data.schoolName} Admin Portal.`,
  ].join('\n')

  return { subject, html, text }
}

// ─── School notification ──────────────────────────────────────────────────────

export function buildSchoolNotificationEmail(data: SchoolNotificationData): {
  subject: string
  html: string
  text: string
} {
  // §12.1: school name in subject for consistency with payer receipt pattern
  const subject = `${data.schoolName} – New payment received – ${data.orderReference}`
  const sourceLabel = SOURCE_LABEL[data.source] ?? data.source

  const html = wrap(`
    ${htmlHeader(data.schoolName)}
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;">New Payment Received</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">A payment has been confirmed via Stripe.</p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payer</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${esc(data.payerName)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payer email</td>
            <td style="font-size:13px;text-align:right;padding:4px 0;">${esc(data.payerEmail)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Source</td>
            <td style="font-size:13px;text-align:right;padding:4px 0;">${esc(sourceLabel)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Order reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.orderReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Payment reference</td>
            <td style="font-size:13px;font-family:monospace;font-weight:600;text-align:right;padding:4px 0;">${esc(data.paymentReference)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Date paid</td>
            <td style="font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${esc(formatDate(data.paidAt, true))}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:4px 0;">Total</td>
            <td style="font-size:16px;font-weight:700;color:#573c9b;text-align:right;padding:4px 0;">${formatCurrency(data.totalCents)}</td>
          </tr>
        </table>
      </div>

      <h3 style="font-size:14px;font-weight:600;margin:0 0 4px;">Items</h3>
      ${htmlItemsTable(data.items, true)}

      <div style="margin-top:20px;">
        <a href="${esc(data.adminOrderUrl)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">
          View order in admin
        </a>
      </div>
    </div>
    ${htmlFooter(data.schoolName)}
  `)

  const text = [
    `${data.schoolName} – NEW PAYMENT RECEIVED – ${data.orderReference}`,
    ``,
    `A payment has been confirmed via Stripe.`,
    ``,
    `Payer:             ${data.payerName}`,
    `Payer email:       ${data.payerEmail}`,
    `Source:            ${sourceLabel}`,
    `Order reference:   ${data.orderReference}`,
    `Payment reference: ${data.paymentReference}`,
    `Date paid:         ${formatDate(data.paidAt, true)}`,
    `Total:             ${formatCurrency(data.totalCents)}`,
    ``,
    `ITEMS:`,
    ...data.items.map(
      (i) =>
        `  • ${i.studentName} | ${i.className}${i.teacherName ? ` | ${i.teacherName}` : ''} | ${i.activityName}${i.verificationStatus ? ` [${i.verificationStatus}]` : ''} – ${formatCurrency(i.amountCents)}`,
    ),
    ``,
    `View order: ${data.adminOrderUrl}`,
    ``,
    `This is an automated message from ${data.schoolName} Admin Portal.`,
  ].join('\n')

  return { subject, html, text }
}
