import type { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { MessageHistoryItem } from '@/components/messages/MessageHistory'
import type { ParentMessageAudience } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

type SmsMessageRow = {
  id: string
  body: string
  audience_type: ParentMessageAudience
  class_id: string | null
  sender_id: string | null
  recipient_count: number
  created_at: string
}

function preview(body: string): string {
  const s = body.trim()
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

interface LoadSmsHistoryOptions {
  /** Restrict to one sender (teacher view — only their own texts). */
  senderId?: string
  /** Resolve + include the sender's name in each item (admin view). */
  withSender?: boolean
}

/**
 * Recent SMS blasts for the compose page. `sms_messages.class_id`/`sender_id`
 * have NO foreign keys (kept plain so audit rows survive class/profile deletion),
 * so PostgREST can't embed them — names are resolved with explicit tenant-scoped
 * lookups instead.
 */
export async function loadSmsHistory(
  adminClient: AdminClient,
  schoolId: string,
  opts: LoadSmsHistoryOptions = {},
): Promise<MessageHistoryItem[]> {
  let query = adminClient
    .from('sms_messages')
    .select('id, body, audience_type, class_id, sender_id, recipient_count, created_at')
    .eq('school_id', schoolId)
  if (opts.senderId) query = query.eq('sender_id', opts.senderId)
  const { data } = await query.order('created_at', { ascending: false }).limit(25)
  const rows = (data as SmsMessageRow[] | null) ?? []
  if (rows.length === 0) return []

  const classIds = [...new Set(rows.map((r) => r.class_id).filter((v): v is string => Boolean(v)))]
  const classNames = new Map<string, string>()
  if (classIds.length > 0) {
    const { data: cls } = await adminClient
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', classIds)
    for (const c of (cls as { id: string; name: string }[] | null) ?? []) {
      classNames.set(c.id, c.name)
    }
  }

  const senderNames = new Map<string, string>()
  if (opts.withSender) {
    const senderIds = [
      ...new Set(rows.map((r) => r.sender_id).filter((v): v is string => Boolean(v))),
    ]
    if (senderIds.length > 0) {
      const { data: profs } = await adminClient
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', senderIds)
      for (const p of (profs as
        | { id: string; first_name: string | null; last_name: string | null }[]
        | null) ?? []) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
        if (name) senderNames.set(p.id, name)
      }
    }
  }

  function audienceLabel(m: SmsMessageRow): string {
    if (m.audience_type === 'school') return 'All parents'
    if (m.audience_type === 'student') return "A pupil's parents"
    const name = m.class_id ? classNames.get(m.class_id) : undefined
    return name ? `Class: ${name}` : 'A class'
  }

  return rows.map((m) => ({
    id: m.id,
    subject: preview(m.body),
    audienceLabel: audienceLabel(m),
    recipientCount: m.recipient_count,
    createdAt: m.created_at,
    senderName: (opts.withSender && m.sender_id ? senderNames.get(m.sender_id) : undefined) as
      | string
      | undefined,
  }))
}
