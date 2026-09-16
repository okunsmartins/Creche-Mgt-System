import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { schoolHasSmsAccess } from '@/lib/subscriptions/access'
import { resolveTeacherContext } from '@/lib/messages/recipients'
import { UpgradePrompt } from '@/components/subscriptions/UpgradePrompt'
import { ParentSmsForm, type SmsClassOption } from '@/components/sms/ParentSmsForm'
import { MessageHistory } from '@/components/messages/MessageHistory'
import { getMessagingStudents } from '@/lib/messages/students'
import { loadSmsBalanceView } from '@/lib/sms/balance'
import { countOptedOutParents } from '@/lib/sms/recipients'
import { loadSmsHistory } from '@/lib/sms/history'
import { getSmsConfig } from '@/lib/sms/client'

export const metadata: Metadata = { title: 'Text parents | Teacher' }

type ClassRowLite = { id: string; name: string }

export default async function TeacherSmsPage() {
  const teacher = await requireTeacher()
  const schoolId = teacher.schoolId!

  if (!(await schoolHasSmsAccess(schoolId))) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Text parents</h1>
          <p className="mt-1 text-sm text-text-muted">Send SMS to the parents of your class.</p>
        </div>
        <UpgradePrompt
          title="Texting parents is a Pro + SMS feature"
          description="Your school needs the Pro + SMS plan to text parents. Ask your administrator to upgrade."
          cta="See plans"
        />
      </div>
    )
  }

  const adminClient = createSupabaseAdminClient()
  const ctx = await resolveTeacherContext(adminClient, schoolId, teacher.email)
  const classIds = ctx?.classIds ?? []

  let classes: SmsClassOption[] = []
  if (classIds.length > 0) {
    const { data: classData } = await adminClient
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', classIds)
      .order('display_order')
    classes = ((classData as ClassRowLite[] | null) ?? []).map((c) => ({ id: c.id, label: c.name }))
  }

  const [balance, optedOutCount, history, students] = await Promise.all([
    loadSmsBalanceView(adminClient, schoolId),
    countOptedOutParents(adminClient, schoolId),
    loadSmsHistory(adminClient, schoolId, { senderId: teacher.id }),
    getMessagingStudents(adminClient, schoolId, classIds),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Text parents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Text the parents of pupils in your class{classes.length === 1 ? '' : 'es'}.
        </p>
      </div>

      {!getSmsConfig() && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Texting isn&apos;t fully set up yet. You can draft a message, but sending is disabled
          until your school&apos;s SMS provider is configured.
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card p-6 text-sm text-text-muted">
          You are not assigned to any classes yet, so there are no parents to text. Ask your
          administrator to assign you to a class.
        </div>
      ) : (
        <ParentSmsForm
          allowSchoolWide={false}
          classes={classes}
          students={students}
          balance={balance}
          optedOutCount={optedOutCount}
        />
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Your recent texts
        </h2>
        <MessageHistory items={history} />
      </div>
    </div>
  )
}
