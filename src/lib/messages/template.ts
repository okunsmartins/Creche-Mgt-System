function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ParentMessageEmailData {
  schoolName: string
  senderName: string
  subject: string
  body: string
}

/**
 * Branded wrapper for a free-text message from a teacher/admin to a parent.
 * The body is user-supplied plain text — escaped, with newlines preserved as
 * line breaks so no HTML can be injected.
 */
export function buildParentMessageEmail(data: ParentMessageEmailData): {
  subject: string
  html: string
  text: string
} {
  const bodyHtml = esc(data.body).replace(/\r?\n/g, '<br>')
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(data.schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Message from ${esc(data.senderName)}</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 12px;">${esc(data.subject)}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.6;">${bodyHtml}</div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Sent by ${esc(data.senderName)} via the ${esc(data.schoolName)} Admin Portal. Reply to this email to respond directly.</p>
  </div></body></html>`

  const text = [
    `${data.schoolName} — message from ${data.senderName}`,
    ``,
    data.subject,
    ``,
    data.body,
    ``,
    `— Sent via the ${data.schoolName} Admin Portal. Reply to this email to respond directly.`,
  ].join('\n')

  return { subject: data.subject, html, text }
}
