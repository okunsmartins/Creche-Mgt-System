import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { actualMinutes } from './timesheets'
import type { PayrollLine } from './payroll'

/**
 * Per-staff payroll summary for a pay period: approved timesheet hours + shift count,
 * one line per staff member (sorted by name). Only APPROVED entries count. School-scoped.
 */
export async function getPayrollSummary(
  schoolId: string,
  from: string,
  to: string,
): Promise<PayrollLine[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('staff_timesheets')
    .select('teacher_id, actual_start, actual_end, teachers(first_name, last_name, email)')
    .eq('school_id', schoolId)
    .eq('status', 'APPROVED')
    .gte('work_date', from)
    .lte('work_date', to)

  const rows =
    (data as unknown as
      | {
          teacher_id: string
          actual_start: string
          actual_end: string
          teachers: {
            first_name: string | null
            last_name: string | null
            email: string | null
          } | null
        }[]
      | null) ?? []

  const byTeacher = new Map<string, PayrollLine>()
  for (const r of rows) {
    const line = byTeacher.get(r.teacher_id) ?? {
      name:
        [r.teachers?.first_name, r.teachers?.last_name].filter(Boolean).join(' ') || 'Staff member',
      email: r.teachers?.email ?? null,
      approvedMinutes: 0,
      entries: 0,
    }
    line.approvedMinutes += actualMinutes(r.actual_start, r.actual_end)
    line.entries += 1
    byTeacher.set(r.teacher_id, line)
  }

  return [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name))
}
