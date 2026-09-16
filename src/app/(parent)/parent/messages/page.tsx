import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ParentInbox, type InboxMessage } from '@/components/messages/ParentInbox'
import type { ParentMessageSenderRole } from '@/types/database'

export const metadata: Metadata = { title: 'Messages' }

type InboxRow = {
  id: string
  read_at: string | null
  created_at: string
  parent_messages: {
    subject: string
    body: string
    created_at: string
    sender_role: ParentMessageSenderRole
    profiles: { first_name: string | null; last_name: string | null } | null
  } | null
}

function senderLabel(row: InboxRow): string {
  const p = row.parent_messages?.profiles
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  return row.parent_messages?.sender_role === 'teacher' ? 'Your teacher' : 'The school'
}

export default async function ParentMessagesPage() {
  const user = await requireVerifiedAuth()

  // Admin client scoped to the user id — auth.uid() is null in Server Components,
  // so the RLS policy would return 0 rows (same pattern as parent payments/orders).
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('parent_message_recipients')
    .select(
      'id, read_at, created_at, parent_messages(subject, body, created_at, sender_role, profiles!sender_id(first_name, last_name))',
    )
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = (data as InboxRow[] | null) ?? []
  const messages: InboxMessage[] = rows
    .filter((r) => r.parent_messages !== null)
    .map((r) => ({
      recipientId: r.id,
      subject: r.parent_messages!.subject,
      body: r.parent_messages!.body,
      senderName: senderLabel(r),
      createdAt: r.parent_messages!.created_at,
      read: r.read_at !== null,
    }))

  const unread = messages.filter((m) => !m.read).length

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Messages</h1>
        <p className="mt-1 text-sm text-text-muted">
          Messages from your school and your child&apos;s teacher.
          {unread > 0 ? ` You have ${unread} unread.` : ''}
        </p>
      </div>

      <ParentInbox messages={messages} />
    </div>
  )
}
