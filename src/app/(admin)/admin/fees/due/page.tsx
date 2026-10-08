import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { summariseDue, type DueInvoice, type DueBucket } from '@/lib/fees/due'
import { SendInvoiceButton } from '@/components/fees/SendInvoiceButton'

export const metadata: Metadata = { title: 'Fees Due' }

interface InvoiceRow {
  id: string
  student_id: string
  invoice_number: string
  net_parent_cents: number
  amount_paid_cents: number
  due_date: string
  status: string
  students: { first_name: string; last_name: string } | null
}

const BUCKET_BADGE: Record<
  DueBucket,
  { variant: 'error' | 'warning' | 'success' | 'default'; text: string }
> = {
  overdue: { variant: 'error', text: 'Overdue' },
  today: { variant: 'warning', text: 'Due today' },
  week: { variant: 'default', text: 'This week' },
  month: { variant: 'default', text: 'This month' },
  year: { variant: 'default', text: 'This year' },
  later: { variant: 'default', text: 'Later' },
}

export default async function FeesDuePage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data } = await db
    .from('invoices')
    .select(
      'id, student_id, invoice_number, net_parent_cents, amount_paid_cents, due_date, status, students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .in('status', ['issued', 'part_paid'])
  const rows = (data ?? []) as unknown as InvoiceRow[]

  const invoices: DueInvoice[] = rows.map((r) => ({
    invoiceId: r.id,
    studentId: r.student_id,
    studentName: r.students ? `${r.students.first_name} ${r.students.last_name}` : '—',
    invoiceNumber: r.invoice_number,
    netParentCents: r.net_parent_cents,
    amountPaidCents: r.amount_paid_cents,
    dueDate: r.due_date,
    status: r.status,
  }))

  const { items, totals } = summariseDue(invoices, todayISO)

  const cards = [
    { label: 'Overdue', value: totals.overdueCents, danger: true },
    { label: 'Due today', value: totals.todayCents, danger: false },
    { label: 'Due this week', value: totals.weekCents, danger: false },
    { label: 'Due this month', value: totals.monthCents, danger: false },
    { label: 'Due this year', value: totals.yearCents, danger: false },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Fees due</h1>
        <p className="mt-1 text-sm text-text-muted">
          Outstanding invoices by due date — today, this week, this month and this year. Weekly,
          monthly and yearly totals are cumulative from today; overdue is shown separately. Send a
          parent a link to view and pay from here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-text-muted">{c.label}</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                c.danger && c.value > 0 ? 'text-error' : 'text-text-primary'
              }`}
            >
              {formatCurrency(c.value)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-sm text-text-muted">
        {totals.childrenCount} {totals.childrenCount === 1 ? 'child has' : 'children have'} an
        outstanding balance.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          Nothing outstanding — every issued invoice is paid. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const badge = BUCKET_BADGE[it.bucket]
                return (
                  <tr key={it.invoiceId} className="border-b border-border/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/fees/${it.studentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {it.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{it.invoiceNumber}</td>
                    <td className="px-4 py-3">{it.dueDate}</td>
                    <td className="px-4 py-3">
                      <Badge variant={badge.variant}>{badge.text}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(it.outstandingCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SendInvoiceButton invoiceId={it.invoiceId} />
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
