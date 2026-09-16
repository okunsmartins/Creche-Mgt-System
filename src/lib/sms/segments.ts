/**
 * SMS segment counting (GSM-7 vs UCS-2), which determines how many credits a
 * message costs — 1 credit per segment. This mirrors how Twilio splits a body:
 *  - GSM-7 (all chars in the GSM 03.38 set): 160 chars single, 153/segment when
 *    multipart. A few "extended" chars cost 2 septets.
 *  - UCS-2 (any non-GSM char, e.g. an emoji or ’ smart-quote): 70 units single,
 *    67/segment multipart (UTF-16 code units).
 *
 * The multipart split is the standard `ceil(len / perSegment)` approximation —
 * good enough to preview cost and charge credits.
 */

// GSM 03.38 basic character set (each = 1 septet).
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
// GSM extension chars (each = 2 septets, still GSM-7).
const GSM_EXTENDED = '^{}\\[~]|€\f'

export type SmsEncoding = 'GSM-7' | 'UCS-2'

export interface SegmentInfo {
  encoding: SmsEncoding
  /** Septets (GSM-7) or UTF-16 code units (UCS-2). */
  units: number
  /** Number of SMS segments (= credits charged per recipient). */
  segments: number
}

/** Count the SMS segments for a message body. */
export function countSegments(body: string): SegmentInfo {
  let septets = 0
  let isGsm = true
  for (const ch of body) {
    if (GSM_BASIC.includes(ch)) septets += 1
    else if (GSM_EXTENDED.includes(ch)) septets += 2
    else {
      isGsm = false
      break
    }
  }

  if (isGsm) {
    const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153)
    return { encoding: 'GSM-7', units: septets, segments }
  }

  const units = body.length // UTF-16 code units (astral chars already count as 2)
  const segments = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67)
  return { encoding: 'UCS-2', units, segments }
}
