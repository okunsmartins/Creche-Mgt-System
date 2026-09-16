import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/Badge'
import { MatchPupilForm } from '@/components/reconciliation/MatchPupilForm'
export const metadata: Metadata = { title: 'Reconciliation' }

export default async function AdminReconciliationPage() {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()

  type QueueItem = {
    id: string
    item_reference: string
    student_name_snapshot: string
    class_name_snapshot: string
    pupil_code_snapshot: string | null
    activity_name_snapshot: string
    verification_status: string
    orders: {
      id: string
      order_reference: string
      guest_payer_name: string | null
      guest_payer_email: string | null
      school_id: string
    }
  }

  interface StudentOption {
    id: string
    first_name: string
    last_name: string
    pupil_payment_code: string
    class_name: string
  }

  const [queueResult, studentsResult] = await Promise.all([
    adminClient
      .from('order_items')
      .select(
        'id, item_reference, student_name_snapshot, class_name_snapshot, pupil_code_snapshot, activity_name_snapshot, verification_status, orders!inner(id, order_reference, guest_payer_name, guest_payer_email, school_id)',
      )
      .eq('orders.school_id', admin.schoolId!)
      .eq('verification_status', 'manual_review')
      .order('created_at', { ascending: false })
      .limit(100),
    adminClient
      .from('students')
      .select('id, first_name, last_name, pupil_payment_code, classes(name)')
      .eq('school_id', admin.schoolId!)
      .eq('is_active', true)
      .order('last_name')
      .limit(500),
  ])

  const queue = (queueResult.data as unknown as QueueItem[]) ?? []

  type StudentQueryRow = {
    id: string
    first_name: string
    last_name: string
    pupil_payment_code: string
    classes: { name: string } | null
  }
  const students: StudentOption[] = (
    (studentsResult.data as unknown as StudentQueryRow[]) ?? []
  ).map((s) => ({
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    pupil_payment_code: s.pupil_payment_code,
    class_name: s.classes?.name ?? '',
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Manual Reconciliation</h1>
        <p className="mt-1 text-sm text-text-muted">
          Match unverified order items to the correct pupil record. The original payment snapshot is
          preserved — only the verification status changes.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <p className="text-sm font-medium text-text-primary">All items verified</p>
          <p className="mt-1 text-xs text-text-muted">
            No order items are awaiting manual reconciliation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {queue.length} item{queue.length !== 1 ? 's' : ''} awaiting review
          </p>
          {queue.map((item) => (
            <div
              key={item.id}
              className="space-y-3 rounded-lg border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-text-muted">{item.item_reference}</p>
                  <p className="mt-1 font-medium text-text-primary">
                    {item.activity_name_snapshot}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Order <span className="font-mono">{item.orders?.order_reference ?? '—'}</span>
                    {item.orders?.guest_payer_name && ` · ${item.orders.guest_payer_name}`}
                  </p>
                </div>
                <StatusBadge status={item.verification_status} />
              </div>

              <div className="rounded-md bg-surface px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Submitted as: </span>
                {item.student_name_snapshot}
                {item.class_name_snapshot && ` · ${item.class_name_snapshot}`}
                {item.pupil_code_snapshot && ` · code: ${item.pupil_code_snapshot}`}
              </div>

              <MatchPupilForm
                orderItemId={item.id}
                snapshotName={item.student_name_snapshot}
                snapshotClass={item.class_name_snapshot}
                students={students}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
