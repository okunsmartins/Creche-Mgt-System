import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { PayLateFeeButton } from '@/components/fees/PayLateFeeButton'

export const metadata: Metadata = { title: 'Late Fees' }

interface LateRow {
  id: string
  student_id: string
  collected_at: string
  minutes_late: number
  fee_cents: number
  amount_paid_cents: number
  paid_at: string | null
  students: { first_name: string; last_name: string } | null
}

export default async function ParentLateFeesPage() {
  const parent = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  const { data: links } = await db
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parent.id)
    .eq('is_active', true)
  const childIds = (links ?? []).map((l) => (l as { student_id: string }).student_id)

  let fees: LateRow[] = []
  if (childIds.length > 0) {
    const { data } = await db
      .from('late_collections')
      .select(
        'id, student_id, collected_at, minutes_late, fee_cents, amount_paid_cents, paid_at, students(first_name, last_name)',
      )
      .in('student_id', childIds)
      .gt('fee_cents', 0)
      .order('collected_at', { ascending: false })
    fees = (data ?? []) as unknown as LateRow[]
  }

  const outstandingCents = fees.reduce(
    (sum, f) => sum + Math.max(0, f.fee_cents - f.amount_paid_cents),
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Late collection fees</h1>
        <p className="mt-1 text-sm text-text-muted">
          Fees for collections after your crèche’s cut-off time. Pay online with the{' '}
          <strong>Pay now</strong> button.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-text-muted">Total outstanding</p>
        <p className="mt-1 text-3xl font-bold text-text-primary">
          {formatCurrency(outstandingCents)}
        </p>
      </div>

      {fees.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No late collection fees. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 text-right">Late</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => {
                const child = f.students ? `${f.students.first_name} ${f.students.last_name}` : '—'
                const outstanding = Math.max(0, f.fee_cents - f.amount_paid_cents)
                const paid = outstanding <= 0
                return (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{child}</td>
                    <td className="px-4 py-3">{f.collected_at.replace('T', ' ').slice(0, 16)}</td>
                    <td className="px-4 py-3 text-right">{f.minutes_late} min</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(f.fee_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={paid ? 'success' : 'warning'}>{paid ? 'Paid' : 'Due'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {paid ? null : <PayLateFeeButton lateFeeId={f.id} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
