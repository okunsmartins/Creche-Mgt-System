import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ParentMessageForm, type ClassOption } from '@/components/messages/ParentMessageForm'
import { MessageHistory, type MessageHistoryItem } from '@/components/messages/MessageHistory'
import { getMessagingStudents } from '@/lib/messages/students'
import type { ParentMessageAudience } from '@/types/database'

export const metadata: Metadata = { title: 'Messages | Admin' }

type ClassRowLite = { id: string; name: string }
type MessageRow = {
  id: string
  subject: string
  audience_type: ParentMessageAudience
  class_id: string | null
  recipient_count: number
  created_at: string
  profiles: { first_name: string | null; last_name: string | null } | null
  classes: { name: string } | null
}

function audienceLabel(row: MessageRow): string {
  switch (row.audience_type) {
    case 'school':
      return 'All parents'
    case 'class':
      return row.classes?.name ? `Class: ${row.classes.name}` : 'A class'
    case 'student':
      return "A pupil's parents"
  }
}

export default async function AdminMessagesPage() {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()
  const schoolId = admin.schoolId!

  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')
  const classes: ClassOption[] = ((classData as ClassRowLite[] | null) ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }))

  const students = await getMessagingStudents(adminClient, schoolId, null)

  const { data: msgData } = await adminClient
    .from('parent_messages')
    .select(
      'id, subject, audience_type, class_id, recipient_count, created_at, profiles!sender_id(first_name, last_name), classes(name)',
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(25)

  const history: MessageHistoryItem[] = ((msgData as MessageRow[] | null) ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    audienceLabel: audienceLabel(m),
    recipientCount: m.recipient_count,
    createdAt: m.created_at,
    senderName:
      [m.profiles?.first_name, m.profiles?.last_name].filter(Boolean).join(' ').trim() || undefined,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Message parents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Email all parents in the school or the parents of a particular class.
        </p>
      </div>

      <ParentMessageForm allowSchoolWide classes={classes} students={students} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Recent messages
        </h2>
        <MessageHistory items={history} />
      </div>
    </div>
  )
}
