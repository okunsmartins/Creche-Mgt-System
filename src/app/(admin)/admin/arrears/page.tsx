import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { summariseArrears, type ArrearsInvoice } from '@/lib/fees/arrears'
import { SendArrearsReminderButton } from '@/components/fees/SendArrearsReminderButton'

export const metadata: Metadata = { title: 'Arrears' }

interface InvoiceRow {
  student_id: string
  net_parent_cents: number
  amount_paid_cents: number
  due_date: string
  status: string
  students: { first_name: string; last_name: string } | null
}

export default async function ArrearsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data } = await db
    .from('invoices')
    .select(
      'student_id, net_parent_cents, amount_paid_cents, due_date, status, students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .in('status', ['issued', 'part_paid'])
  const rows = (data ?? []) as unknown as InvoiceRow[]

  const invoices: ArrearsInvoice[] = rows.map((r) => ({
    studentId: r.student_id,
    studentName: r.students ? `${r.students.first_name} ${r.students.last_name}` : '—',
    netParentCents: r.net_parent_cents,
    amountPaidCents: r.amount_paid_cents,
    dueDate: r.due_date,
    status: r.status,
  }))
  const summary = summariseArrears(invoices, todayISO)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Arrears</h1>
        <p className="mt-1 text-sm text-text-muted">
          Outstanding fees across the crèche — amounts owed after ECCE/NCS subvention.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">Total outstanding</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {formatCurrency(summary.totalOutstandingCents)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">Overdue</p>
          <p
            className={`mt-1 text-2xl font-bold ${summary.overdueCents > 0 ? 'text-error' : 'text-text-primary'}`}
          >
            {formatCurrency(summary.overdueCents)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">Children in arrears</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.childrenInArrears}</p>
        </div>
      </div>

      {summary.byChild.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          Nothing outstanding — every issued invoice is paid. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3">Oldest due</th>
                <th className="px-4 py-3 text-right">Invoices</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {summary.byChild.map((c) => (
                <tr key={c.studentId} className="border-b border-border/50">
                  <td className="px-4 py-3 font-medium">{c.studentName}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(c.outstandingCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.overdueCents > 0 ? (
                      <Badge variant="error">{formatCurrency(c.overdueCents)}</Badge>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.oldestDueDate ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{c.invoiceCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <SendArrearsReminderButton
                        studentId={c.studentId}
                        childName={c.studentName}
                        amountLabel={formatCurrency(c.outstandingCents)}
                      />
                      <Link
                        href={`/admin/fees/${c.studentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
