// Shared branded email layout — the crèche's own name in a header banner + a
// contextual subtitle, matching the parent-messaging / receipt templates. Every
// tenant-facing email should use this so communications are consistently branded.

/** Escape text before interpolating into email HTML. */
export function escapeEmailHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const esc = escapeEmailHtml

export interface BrandedEmailOptions {
  /** The crèche's own name — shown large in the header. */
  schoolName: string
  /** Contextual line under the name, e.g. "Fees & invoices" or "Message from …". */
  subtitle?: string
  /** Inner HTML of the white card (caller escapes any dynamic text it injects). */
  bodyHtml: string
  /** Optional extra footer line shown above the automated-message note. */
  footnote?: string
}

/**
 * Wrap body content in the standard branded email shell (purple header banner with
 * the crèche name + subtitle, white content card, muted footer). Returns full HTML.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const header = `
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">${esc(opts.schoolName)}</h1>
      ${opts.subtitle ? `<p style="color:#c9bdf0;margin:6px 0 0;font-size:14px;">${esc(opts.subtitle)}</p>` : ''}
    </div>`

  const card = `
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;color:#374151;font-size:14px;line-height:1.6;">
      ${opts.bodyHtml}
    </div>`

  const footer = `
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
      ${opts.footnote ? `${esc(opts.footnote)}<br>` : ''}
      Sent via the ${esc(opts.schoolName)} parent portal · Creche Wise
    </p>`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">${header}${card}${footer}</div></body></html>`
}
