import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { schoolHasSmsAccess } from '@/lib/subscriptions/access'
import { UpgradePrompt } from '@/components/subscriptions/UpgradePrompt'
import { ParentSmsForm, type SmsClassOption } from '@/components/sms/ParentSmsForm'
import { MessageHistory } from '@/components/messages/MessageHistory'
import { getMessagingStudents } from '@/lib/messages/students'
import { loadSmsBalanceView } from '@/lib/sms/balance'
import { countOptedOutParents } from '@/lib/sms/recipients'
import { loadSmsHistory } from '@/lib/sms/history'
import { getSmsConfig } from '@/lib/sms/client'

export const metadata: Metadata = { title: 'Text parents | Admin' }

type ClassRowLite = { id: string; name: string }

export default async function AdminSmsPage() {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!

  if (!(await schoolHasSmsAccess(schoolId))) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Text parents</h1>
          <p className="mt-1 text-sm text-text-muted">
            Send SMS straight to parents&apos; phones for urgent notices.
          </p>
        </div>
        <UpgradePrompt
          title="Texting parents is a Pro + SMS feature"
          description="Upgrade to the Pro + SMS plan (€44.99/mo) to text parents. It includes a monthly allowance of texts, with credit top-ups when you need more."
          cta="Upgrade to Pro + SMS"
          href="/admin/subscription"
        />
      </div>
    )
  }

  const adminClient = createSupabaseAdminClient()

  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')
  const classes: SmsClassOption[] = ((classData as ClassRowLite[] | null) ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }))

  const [balance, optedOutCount, history, students] = await Promise.all([
    loadSmsBalanceView(adminClient, schoolId),
    countOptedOutParents(adminClient, schoolId),
    loadSmsHistory(adminClient, schoolId, { withSender: true }),
    getMessagingStudents(adminClient, schoolId, null),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Text parents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Text all parents in the school or the parents of a particular class.
        </p>
      </div>

      {!getSmsConfig() && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Texting isn&apos;t fully set up yet. You can draft a message, but sending is disabled
          until your SMS provider is configured.
        </div>
      )}

      <ParentSmsForm
        allowSchoolWide
        classes={classes}
        students={students}
        balance={balance}
        optedOutCount={optedOutCount}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Recent texts
        </h2>
        <MessageHistory items={history} />
      </div>
    </div>
  )
}
