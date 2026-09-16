import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherContext } from '@/lib/messages/recipients'
import { ParentMessageForm, type ClassOption } from '@/components/messages/ParentMessageForm'
import { MessageHistory, type MessageHistoryItem } from '@/components/messages/MessageHistory'
import { getMessagingStudents } from '@/lib/messages/students'
import type { ParentMessageAudience } from '@/types/database'

export const metadata: Metadata = { title: 'Messages | Teacher' }

type ClassRowLite = { id: string; name: string }
type MessageRow = {
  id: string
  subject: string
  audience_type: ParentMessageAudience
  recipient_count: number
  created_at: string
  classes: { name: string } | null
}

export default async function TeacherMessagesPage() {
  const teacher = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const schoolId = teacher.schoolId!

  const ctx = await resolveTeacherContext(adminClient, schoolId, teacher.email)
  const classIds = ctx?.classIds ?? []

  let classes: ClassOption[] = []
  if (classIds.length > 0) {
    const { data: classData } = await adminClient
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', classIds)
      .order('display_order')
    classes = ((classData as ClassRowLite[] | null) ?? []).map((c) => ({ id: c.id, label: c.name }))
  }

  const students = await getMessagingStudents(adminClient, schoolId, classIds)

  const { data: msgData } = await adminClient
    .from('parent_messages')
    .select('id, subject, audience_type, recipient_count, created_at, classes(name)')
    .eq('school_id', schoolId)
    .eq('sender_id', teacher.id)
    .order('created_at', { ascending: false })
    .limit(25)

  const history: MessageHistoryItem[] = ((msgData as MessageRow[] | null) ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    audienceLabel: m.classes?.name ? `Class: ${m.classes.name}` : "A pupil's parents",
    recipientCount: m.recipient_count,
    createdAt: m.created_at,
  }))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Message parents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Email the parents of pupils in your class{classes.length === 1 ? '' : 'es'}.
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="card p-6 text-sm text-text-muted">
          You are not assigned to any classes yet, so there are no parents to message. Ask your
          administrator to assign you to a class.
        </div>
      ) : (
        <ParentMessageForm allowSchoolWide={false} classes={classes} students={students} />
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Your recent messages
        </h2>
        <MessageHistory items={history} />
      </div>
    </div>
  )
}
