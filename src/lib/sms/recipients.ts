import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { parentIdsForAudience } from '@/lib/messages/recipients'
import type { ParentMessageAudienceInput } from '@/lib/messages/schemas'
import { normalizeIrishMobile, pickSmsPhone } from './phone'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface SmsRecipient {
  parentId: string
  phone: string // E.164
  name: string
}

export interface SmsRecipientResolution {
  /** Deliverable recipients (valid Irish mobile, not opted out). */
  recipients: SmsRecipient[]
  /** Parents in the audience with no usable mobile number. */
  noPhoneCount: number
  /** Parents who have opted out of SMS. */
  optedOutCount: number
}

/**
 * Resolve deliverable SMS recipients for an audience. Reuses the email feature's
 * tenant-scoped audience→parent-ids resolution, then keeps only parents with a
 * valid Irish mobile who have not opted out. The counts let the UI show
 * "texting N parents (M skipped: no mobile / opted out)".
 */
export async function resolveSmsRecipients(
  adminClient: AdminClient,
  schoolId: string,
  audience: ParentMessageAudienceInput,
): Promise<SmsRecipientResolution> {
  const parentIds = await parentIdsForAudience(adminClient, schoolId, audience)
  if (parentIds.length === 0) return { recipients: [], noPhoneCount: 0, optedOutCount: 0 }

  const { data } = await adminClient
    .from('profiles')
    .select('id, first_name, last_name, phone, sms_opt_out')
    .in('id', parentIds)
    .eq('is_active', true)

  // Fallback number: the child-level `parent_mobile` captured on a linked child, used when
  // a parent has no usable mobile on their own profile. (Common in a crèche: staff enter
  // the parent's number on the child, but the parent account has no phone set.)
  const { data: linkData } = await adminClient
    .from('parent_student_links')
    .select('parent_id, students(parent_mobile)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('parent_id', parentIds)

  type LinkRow = {
    parent_id: string
    students: { parent_mobile: string | null } | { parent_mobile: string | null }[] | null
  }
  const fallbackByParent = new Map<string, string>()
  for (const row of (linkData as LinkRow[] | null) ?? []) {
    if (fallbackByParent.has(row.parent_id)) continue
    const stu = Array.isArray(row.students) ? row.students[0] : row.students
    const mobile = normalizeIrishMobile(stu?.parent_mobile ?? null)
    if (mobile) fallbackByParent.set(row.parent_id, mobile)
  }

  type Row = {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    sms_opt_out: boolean
  }

  const recipients: SmsRecipient[] = []
  let noPhoneCount = 0
  let optedOutCount = 0

  for (const p of (data as Row[] | null) ?? []) {
    const pick = pickSmsPhone(p.phone, fallbackByParent.get(p.id) ?? null, p.sms_opt_out)
    if ('skip' in pick) {
      if (pick.skip === 'opted_out') optedOutCount += 1
      else noPhoneCount += 1
      continue
    }
    recipients.push({
      parentId: p.id,
      phone: pick.phone,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Parent/Guardian',
    })
  }

  return { recipients, noPhoneCount, optedOutCount }
}

/**
 * Count school-wide parents who have opted out of SMS (informational, for the
 * compose page). Tenant-scoped: resolves the school's parent ids first, then
 * counts opted-out profiles among them.
 */
export async function countOptedOutParents(
  adminClient: AdminClient,
  schoolId: string,
): Promise<number> {
  const parentIds = await parentIdsForAudience(adminClient, schoolId, { type: 'school' })
  if (parentIds.length === 0) return 0
  const { count } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('id', parentIds)
    .eq('sms_opt_out', true)
    .eq('is_active', true)
  return count ?? 0
}
