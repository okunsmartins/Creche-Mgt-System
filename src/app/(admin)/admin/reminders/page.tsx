import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  selectFeeReminders,
  DEFAULT_REMINDER_CONFIG,
  type ReminderInvoice,
  type ReminderKind,
} from '@/lib/fees/reminders'

export const metadata: Metadata = { title: 'Reminders' }

interface InvoiceRow {
  id: string
  student_id: string
  net_parent_cents: number
  amount_paid_cents: number
  due_date: string
  status: string
  students: { first_name: string; last_name: string } | null
}

const KIND_BADGE: Record<ReminderKind, { variant: 'error' | 'warning' | 'default'; text: string }> =
  {
    overdue: { variant: 'error', text: 'Overdue' },
    due_today: { variant: 'warning', text: 'Due today' },
    due_soon: { variant: 'default', text: 'Due soon' },
  }

export default async function RemindersPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data } = await db
    .from('invoices')
    .select(
      'id, student_id, net_parent_cents, amount_paid_cents, due_date, status, students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .in('status', ['issued', 'part_paid'])
  const rows = (data ?? []) as unknown as InvoiceRow[]

  const invoices: ReminderInvoice[] = rows.map((r) => ({
    invoiceId: r.id,
    studentId: r.student_id,
    studentName: r.students ? `${r.students.first_name} ${r.students.last_name}` : '—',
    netParentCents: r.net_parent_cents,
    amountPaidCents: r.amount_paid_cents,
    dueDate: r.due_date,
    status: r.status,
  }))

  const reminders = selectFeeReminders(invoices, todayISO, DEFAULT_REMINDER_CONFIG)
  // Overdue first, then due today, then due soon.
  const order: Record<ReminderKind, number> = { overdue: 0, due_today: 1, due_soon: 2 }
  reminders.sort((a, b) => order[a.kind] - order[b.kind] || a.dueDate.localeCompare(b.dueDate))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payment reminders</h1>
        <p className="mt-1 text-sm text-text-muted">
          Invoices due within {DEFAULT_REMINDER_CONFIG.dueSoonDays} days or overdue. This is a
          preview of who would be reminded — automated sending is enabled once email/SMS is
          configured.
        </p>
      </div>

      {reminders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          Nothing due soon or overdue. 🎉
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => {
                const badge = KIND_BADGE[r.kind]
                return (
                  <tr key={r.invoiceId} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{r.studentName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={badge.variant}>{badge.text}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.dueDate}
                      <span className="ml-1 text-text-muted">
                        (
                        {r.daysUntilDue < 0
                          ? `${-r.daysUntilDue}d ago`
                          : r.daysUntilDue === 0
                            ? 'today'
                            : `in ${r.daysUntilDue}d`}
                        )
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(r.outstandingCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/fees/${r.studentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View →
                      </Link>
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
