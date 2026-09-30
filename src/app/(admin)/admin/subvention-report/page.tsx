import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { summariseProviderReceivables, type ReceivableInvoice } from '@/lib/fees/receivables'

export const metadata: Metadata = { title: 'Subvention report' }

interface InvoiceRow {
  student_id: string
  provider_receivable_ecce_cents: number
  provider_receivable_ncs_cents: number
  status: string
  students: { first_name: string; last_name: string } | null
}
interface RegRow {
  student_id: string
  scheme: 'ECCE' | 'NCS'
  chick_code: string | null
}

export default async function SubventionReportPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const [{ data: invData }, { data: regData }] = await Promise.all([
    db
      .from('invoices')
      .select(
        'student_id, provider_receivable_ecce_cents, provider_receivable_ncs_cents, status, students(first_name, last_name)',
      )
      .eq('school_id', admin.schoolId)
      .in('status', ['issued', 'part_paid', 'paid']),
    db
      .from('child_funding_registrations')
      .select('student_id, scheme, chick_code')
      .eq('school_id', admin.schoolId)
      .eq('status', 'ACTIVE'),
  ])

  const rows = (invData ?? []) as unknown as InvoiceRow[]
  const invoices: ReceivableInvoice[] = rows.map((r) => ({
    studentId: r.student_id,
    studentName: r.students ? `${r.students.first_name} ${r.students.last_name}` : '—',
    providerReceivableEcceCents: r.provider_receivable_ecce_cents,
    providerReceivableNcsCents: r.provider_receivable_ncs_cents,
    status: r.status,
  }))
  const summary = summariseProviderReceivables(invoices)

  // Registration context per child (ECCE flag, NCS CHICK).
  const regs = new Map<string, { ecce: boolean; ncsChick: string | null }>()
  for (const r of (regData ?? []) as RegRow[]) {
    const entry = regs.get(r.student_id) ?? { ecce: false, ncsChick: null }
    if (r.scheme === 'ECCE') entry.ecce = true
    if (r.scheme === 'NCS') entry.ncsChick = r.chick_code
    regs.set(r.student_id, entry)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Subvention report</h1>
        <p className="mt-1 text-sm text-text-muted">
          Provider receivables from the state (ECCE capitation + NCS subsidy) across issued invoices
          — reconcile against what Pobal pays.{' '}
          <strong>Confirm figures against your Pobal statements.</strong>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="ECCE capitation" value={formatCurrency(summary.totalEcceCents)} />
        <Stat label="NCS subsidy" value={formatCurrency(summary.totalNcsCents)} />
        <Stat label="Total receivable" value={formatCurrency(summary.totalCents)} strong />
      </div>

      {summary.byChild.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No subvention receivable yet. It accrues as ECCE/NCS-funded invoices are issued.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Schemes</th>
                <th className="px-4 py-3 text-right">ECCE</th>
                <th className="px-4 py-3 text-right">NCS</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byChild.map((c) => {
                const reg = regs.get(c.studentId)
                return (
                  <tr key={c.studentId} className="border-b border-border/50">
                    <td className="px-4 py-3 font-medium">{c.studentName}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {reg?.ecce && <Badge variant="info">ECCE</Badge>}
                        {reg?.ncsChick != null && (
                          <Badge variant="success">
                            NCS {reg.ncsChick ? `· ${reg.ncsChick}` : ''}
                          </Badge>
                        )}
                        {!reg?.ecce && reg?.ncsChick == null && (
                          <span className="text-text-muted">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.ecceCents)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(c.ncsCents)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(c.totalCents)}
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

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${strong ? 'text-primary' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  )
}
