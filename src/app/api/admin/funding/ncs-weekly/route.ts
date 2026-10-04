import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { fundingEnabled } from '@/lib/funding/access'
import { reportingWeekStart, latestCompletedWeekStart } from '@/lib/funding/week'

/**
 * NCS weekly-return CSV export for one reporting week. Admin + funding.export +
 * tenant feature flag; school-scoped. Generated from the immutable weekly snapshots.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })
  if (!admin.permissions.includes('funding.export'))
    return new Response('You do not have permission to export funding data.', { status: 403 })
  if (!(await fundingEnabled(admin.schoolId)))
    return new Response('The Funding & Hive Centre is not enabled.', { status: 403 })

  const weekParam = request.nextUrl.searchParams.get('week')
  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? reportingWeekStart(weekParam)
      : latestCompletedWeekStart()

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select(
      'claimed_minutes, actual_attendance_minutes, under_attended, full_week_absent, consecutive_under_attendance_weeks, consecutive_absence_weeks, threshold_event, risk_state, calculation_version, students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .eq('week_start', weekStart)
  const rows =
    (data as unknown as
      | {
          claimed_minutes: number
          actual_attendance_minutes: number
          under_attended: boolean
          full_week_absent: boolean
          consecutive_under_attendance_weeks: number
          consecutive_absence_weeks: number
          threshold_event: string
          risk_state: string
          calculation_version: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []

  const h = (m: number) => (m / 60).toFixed(2)
  const header = [
    'Week start',
    'Child',
    'Claimed hours',
    'Attended hours',
    'Under-attended',
    'Full-week absent',
    'Consecutive under weeks',
    'Consecutive absence weeks',
    'Threshold event',
    'Risk state',
    'Rules version',
  ]
  const body = rows.map((r) => [
    weekStart,
    [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    h(r.claimed_minutes),
    h(r.actual_attendance_minutes),
    r.under_attended ? 'Yes' : 'No',
    r.full_week_absent ? 'Yes' : 'No',
    String(r.consecutive_under_attendance_weeks),
    String(r.consecutive_absence_weeks),
    r.threshold_event,
    r.risk_state,
    r.calculation_version,
  ])
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="ncs-weekly-return-${weekStart}.csv"`,
    },
  })
}
