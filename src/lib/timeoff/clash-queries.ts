import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { clashDaysInRange, type LeaveInterval, type ClashDay } from './clash'

type Row = {
  teacher_id: string
  start_date: string
  end_date: string
  teachers: { first_name: string | null; last_name: string | null } | null
}

/**
 * Upcoming days (from `fromISO` for `horizonDays`) where 2+ staff are on APPROVED leave at
 * once — a potential staffing shortage flagged on the dashboard. School-scoped.
 */
export async function getUpcomingTimeOffClashes(
  schoolId: string,
  fromISO: string,
  horizonDays = 30,
): Promise<ClashDay[]> {
  const to = new Date(`${fromISO}T00:00:00Z`)
  to.setUTCDate(to.getUTCDate() + horizonDays)
  const toISO = to.toISOString().slice(0, 10)

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('time_off_requests')
    .select('teacher_id, start_date, end_date, teachers(first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('status', 'approved')
    .gte('end_date', fromISO)
    .lte('start_date', toISO)

  const intervals: LeaveInterval[] = ((data as Row[] | null) ?? []).map((r) => ({
    teacherId: r.teacher_id,
    name:
      [r.teachers?.first_name, r.teachers?.last_name].filter(Boolean).join(' ') || 'Staff member',
    start: r.start_date,
    end: r.end_date,
  }))

  return clashDaysInRange(intervals, fromISO, toISO)
}
