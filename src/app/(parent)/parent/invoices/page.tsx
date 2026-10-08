import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { PayInvoiceButton } from '@/components/fees/PayInvoiceButton'

export const metadata: Metadata = { title: 'Fees & Invoices' }

interface InvoiceRow {
  id: string
  invoice_number: string
  student_id: string
  period_start: string
  period_end: string
  due_date: string
  net_parent_cents: number
  amount_paid_cents: number
  status: string
  students: { first_name: string; last_name: string } | null
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default'> = {
  paid: 'success',
  part_paid: 'warning',
  issued: 'default',
}

export default async function ParentInvoicesPage() {
  const parent = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  // Parent's linked children (scope manually — auth.uid() is NULL in RSC).
  const { data: links } = await db
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parent.id)
    .eq('is_active', true)
  const childIds = (links ?? []).map((l) => (l as { student_id: string }).student_id)

  let invoices: InvoiceRow[] = []
  if (childIds.length > 0) {
    // Parents only ever see issued invoices (never drafts).
    const { data } = await db
      .from('invoices')
      .select(
        'id, invoice_number, student_id, period_start, period_end, due_date, net_parent_cents, amount_paid_cents, status, students(first_name, last_name)',
      )
      .in('student_id', childIds)
      .in('status', ['issued', 'part_paid', 'paid'])
      .order('due_date')
    invoices = (data ?? []) as unknown as InvoiceRow[]
  }

  const outstandingCents = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + Math.max(0, i.net_parent_cents - i.amount_paid_cents), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Fees &amp; Invoices</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your invoices, with ECCE/NCS subvention already applied. Amounts shown are what you pay
          after funding.
        </p>
      </div>

      {/* Outstanding summary */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-text-muted">Total outstanding</p>
        <p className="mt-1 text-3xl font-bold text-text-primary">
          {formatCurrency(outstandingCents)}
        </p>
        {outstandingCents > 0 && (
          <p className="mt-2 text-sm text-text-muted">
            Pay online with the <strong>Pay now</strong> button next to each invoice. If card
            payment isn’t available yet, you’ll see a note — contact your crèche in that case.
          </p>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No invoices yet. When your crèche issues invoices, they’ll appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const child = inv.students
                  ? `${inv.students.first_name} ${inv.students.last_name}`
                  : '—'
                return (
                  <tr key={inv.id} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{child}</td>
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      {inv.period_start} → {inv.period_end}
                    </td>
                    <td className="px-4 py-3">{inv.due_date}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(inv.net_parent_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                        {inv.status === 'part_paid' ? 'Part paid' : inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.status === 'issued' || inv.status === 'part_paid' ? (
                        <PayInvoiceButton invoiceId={inv.id} />
                      ) : null}
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
