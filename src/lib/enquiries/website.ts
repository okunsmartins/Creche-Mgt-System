// Public website waiting-list / visit enquiry (a crèche's own parent-facing page).
// Pure parsing + validation so it can be unit-tested. No DB.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

export interface WebsiteEnquiry {
  parentName: string
  parentEmail: string
  parentPhone: string | null
  childFirstName: string | null
  childDob: string | null
  desiredStartDate: string | null
  /** Days needed, wanting a visit and the free-text message, folded into one note. */
  notes: string | null
}

export type WebsiteEnquiryResult =
  | { ok: true; enquiry: WebsiteEnquiry }
  | { ok: false; error: string }
  /** Honeypot tripped — pretend success, store nothing. */
  | { ok: 'spam' }

function text(fd: FormData, key: string, max: number): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function validDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export function parseWebsiteEnquiry(fd: FormData): WebsiteEnquiryResult {
  // Hidden field real visitors never fill in.
  if (text(fd, 'website', 200)) return { ok: 'spam' }

  const parentName = text(fd, 'parentName', 120)
  const parentEmail = text(fd, 'parentEmail', 200)
  const parentPhone = text(fd, 'parentPhone', 40)
  const childFirstName = text(fd, 'childFirstName', 80)
  const childDob = text(fd, 'childDob', 10)
  const desiredStartDate = text(fd, 'desiredStartDate', 10)
  const message = text(fd, 'message', 2000)
  const wantsVisit = fd.get('wantsVisit') === 'on'
  const days = fd
    .getAll('days')
    .filter((d): d is string => typeof d === 'string')
    .filter((d) => (WEEKDAYS as readonly string[]).includes(d))

  if (!parentName) return { ok: false, error: 'Please enter your name.' }
  if (!parentEmail || !EMAIL_RE.test(parentEmail))
    return { ok: false, error: 'Please enter a valid email address so we can reply.' }
  if (childDob && !validDate(childDob))
    return { ok: false, error: "Please enter your child's date of birth as a full date." }
  if (desiredStartDate && !validDate(desiredStartDate))
    return { ok: false, error: 'Please enter the start date as a full date.' }

  const noteParts = [
    days.length ? `Days needed: ${days.join(', ')}` : null,
    wantsVisit ? 'Would like to visit the crèche.' : null,
    message || null,
  ].filter((p): p is string => p !== null)

  return {
    ok: true,
    enquiry: {
      parentName,
      parentEmail,
      parentPhone: parentPhone || null,
      childFirstName: childFirstName || null,
      childDob: childDob || null,
      desiredStartDate: desiredStartDate || null,
      notes: noteParts.length ? noteParts.join('\n') : null,
    },
  }
}
