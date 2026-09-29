import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'

export const metadata: Metadata = { title: 'Fees & invoices' }

interface StudentRow {
  id: string
  first_name: string
  last_name: string
  is_active: boolean
}
interface ScheduleRow {
  student_id: string
  name: string
  frequency: string
  flat_amount_cents: number | null
  provider_hourly_rate_cents: number | null
  status: string
}

export default async function AdminFeesPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const { data: studentsData } = await db
    .from('students')
    .select('id, first_name, last_name, is_active')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('last_name')
  const students = (studentsData ?? []) as StudentRow[]

  // fee_schedules may not exist yet (migration 071); degrade gracefully.
  const { data: schedulesData } = await db
    .from('fee_schedules')
    .select('student_id, name, frequency, flat_amount_cents, provider_hourly_rate_cents, status')
    .eq('school_id', admin.schoolId)
  const byStudent = new Map<string, ScheduleRow>()
  for (const s of (schedulesData ?? []) as ScheduleRow[]) {
    if (!byStudent.has(s.student_id)) byStudent.set(s.student_id, s)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Fees &amp; invoices</h1>
        <p className="mt-1 text-sm text-text-muted">
          Set each child’s fee schedule, record their ECCE/NCS funding, and generate subvention-netted invoices.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-4 py-3">Child</th>
              <th className="px-4 py-3">Fee schedule</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                  No children yet. Import or add children first.
                </td>
              </tr>
            )}
            {students.map((s) => {
              const sched = byStudent.get(s.id)
              return (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="px-4 py-3 font-medium">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-4 py-3">
                    {sched ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="success">{sched.frequency}</Badge>
                        {sched.name}
                      </span>
                    ) : (
                      <span className="text-text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sched
                      ? sched.flat_amount_cents != null
                        ? `${formatCurrency(sched.flat_amount_cents)}/period`
                        : `${formatCurrency(sched.provider_hourly_rate_cents ?? 0)}/hr`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/fees/${s.id}`} className="font-medium text-primary hover:underline">
                      Manage billing →
                    </Link>
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
