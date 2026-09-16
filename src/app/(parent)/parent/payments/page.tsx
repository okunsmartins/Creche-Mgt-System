import type { Metadata } from 'next'
import Link from 'next/link'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ParentPaymentForm } from '@/components/orders/ParentPaymentForm'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { paidByMonth, ordersByStatus } from '@/lib/charts/aggregate'
import type {
  ActivityRow,
  ActivityClassEligibilityRow,
  OrderRow,
  StudentRow,
  ClassRow,
} from '@/types/database'

export const metadata: Metadata = { title: 'Payments' }

// ─── Payment history view ─────────────────────────────────────────────────────

type OrderSummary = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'total_cents'
  | 'amount_paid_cents'
  | 'status'
  | 'source'
  | 'created_at'
>

async function PaymentHistory({ userId }: { userId: string }) {
  // Use admin client: auth.uid() is null in Server Component contexts; RLS
  // policy parents_read_own_orders would return 0 rows. Scope manually to userId.
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('orders')
    .select('id, order_reference, total_cents, amount_paid_cents, status, source, created_at')
    .eq('payer_profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const orders = (data as OrderSummary[] | null) ?? []

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-text-muted">No payments yet.</p>
        <Link
          href="/parent/activities"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          View available activities
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Payments by month"
          data={paidByMonth(orders)}
          formatValue={formatCurrency}
        />
        <DonutChart title="Orders by status" data={ordersByStatus(orders)} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Date</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const isPartiallyPaid = order.status === 'partially_paid'
              const remainingCents = order.total_cents - order.amount_paid_cents
              return (
                <tr key={order.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">
                    {order.order_reference}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {isPartiallyPaid ? (
                      <div>
                        <p className="font-medium text-text-primary">
                          {formatCurrency(order.total_cents)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatCurrency(order.amount_paid_cents)} paid
                          {' · '}
                          {formatCurrency(remainingCents)} due
                        </p>
                      </div>
                    ) : (
                      <span className="font-medium text-text-primary">
                        {formatCurrency(order.total_cents)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isPartiallyPaid ? (
                      <Link
                        href={`/parent/payments/${order.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Pay balance
                      </Link>
                    ) : (
                      <Link
                        href={`/parent/payments/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Activity payment view ────────────────────────────────────────────────────

type ActivityDetail = Pick<
  ActivityRow,
  | 'id'
  | 'name'
  | 'description'
  | 'amount_cents'
  | 'publication_status'
  | 'is_active'
  | 'opens_at'
  | 'closes_at'
>

type EligibilityEntry = Pick<ActivityClassEligibilityRow, 'class_id'>

type LinkedStudent = Pick<StudentRow, 'id' | 'first_name' | 'last_name' | 'class_id'> & {
  classes: Pick<ClassRow, 'name'> | null
}

async function ActivityPaymentView({ activityId, userId }: { activityId: string; userId: string }) {
  // Activities: use server client — public_read_published_activities RLS does not
  // use auth.uid(), so it works correctly in Server Component contexts.
  // parent_student_links: use admin client — its RLS uses auth.uid() which is null here.
  const serverClient = await createSupabaseServerClient()
  const adminClient = createSupabaseAdminClient()

  // Fetch activity via RLS — filters to published, active, open activities (FR-ACT-005)
  const { data: activityData } = await serverClient
    .from('activities')
    .select(
      'id, name, description, amount_cents, publication_status, is_active, opens_at, closes_at',
    )
    .eq('id', activityId)
    .single()

  const activity = activityData as ActivityDetail | null

  if (!activity) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <p className="text-text-secondary">
          This activity is not currently available for payment.{' '}
          <Link href="/parent/activities" className="text-primary hover:underline">
            View activities
          </Link>
        </p>
      </div>
    )
  }

  // Fetch eligible class IDs for this activity
  const { data: eligibilityData } = await adminClient
    .from('activity_class_eligibility')
    .select('class_id')
    .eq('activity_id', activityId)

  const eligibleClassIds = new Set(
    ((eligibilityData as EligibilityEntry[] | null) ?? []).map((e) => e.class_id),
  )

  // Fetch parent's linked active students with class info
  const { data: linksData } = await adminClient
    .from('parent_student_links')
    .select('students(id, first_name, last_name, class_id, classes(name))')
    .eq('parent_id', userId)
    .eq('is_active', true)

  type RawLink = { students: LinkedStudent | null }
  const links = (linksData as RawLink[] | null) ?? []

  const eligibleStudents = links
    .map((l) => l.students)
    .filter((s): s is LinkedStudent => s !== null && eligibleClassIds.has(s.class_id))
    .map((s) => ({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      className: (s.classes as { name: string } | null)?.name ?? 'Unknown',
    }))

  return (
    <div className="space-y-4">
      {activity.description && (
        <p className="text-sm text-text-secondary">{activity.description}</p>
      )}
      <ParentPaymentForm
        activityId={activityId}
        activityName={activity.name}
        amountCents={activity.amount_cents}
        eligibleStudents={eligibleStudents}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ParentPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ activityId?: string }>
}) {
  const user = await requireVerifiedAuth()
  const { activityId } = await searchParams

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {activityId ? (
        <>
          <div className="mb-6">
            <Link href="/parent/activities" className="text-sm text-text-muted hover:underline">
              ← Back to activities
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-text-primary">Make a payment</h1>
          </div>
          <ActivityPaymentView activityId={activityId} userId={user.id} />
        </>
      ) : (
        <>
          <h1 className="mb-6 text-2xl font-bold text-text-primary">Payment History</h1>
          <PaymentHistory userId={user.id} />
        </>
      )}
    </div>
  )
}
