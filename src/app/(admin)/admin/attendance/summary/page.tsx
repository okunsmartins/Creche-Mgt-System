import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  resolveDateRange,
  resolveGranularity,
  getClassAttendanceSummary,
  getClassAttendanceTrend,
} from '@/lib/attendance/summary'
import { AttendanceSummaryTable } from '@/components/attendance/AttendanceSummaryTable'
import { AttendanceRangeFilter } from '@/components/attendance/AttendanceRangeFilter'
import { AttendancePeriodRollup } from '@/components/attendance/AttendancePeriodRollup'
import { PrintButton } from '@/components/ui/PrintButton'

export const metadata: Metadata = { title: 'Attendance Summary' }

const BASE_PATH = '/admin/attendance/summary'

export default async function AdminAttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; from?: string; to?: string; g?: string }>
}) {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()
  const { classId, from, to, g } = await searchParams
  const range = resolveDateRange(from, to)
  const granularity = resolveGranularity(g)

  const { data: classes } = await adminClient
    .from('classes')
    .select('id, name')
    .eq('school_id', admin.schoolId!)
    .eq('is_active', true)
    .order('display_order')

  const classList = classes ?? []
  const selectedClass = classList.find((c) => c.id === classId) ?? classList[0] ?? null

  const [summary, periods] = selectedClass
    ? await Promise.all([
        getClassAttendanceSummary(adminClient, selectedClass.id, range.from, range.to),
        getClassAttendanceTrend(adminClient, selectedClass.id, range.from, range.to, granularity),
      ])
    : [{ students: [], totalSessions: 0 }, []]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance Summary</h1>
          <p className="mt-1 text-sm text-text-muted">
            {selectedClass ? `${selectedClass.name} · ` : ''}
            {formatRange(range.from, range.to)}
          </p>
        </div>
        <PrintButton label="Print summary" />
      </div>

      {/* Class tabs */}
      {classList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {classList.map((c) => {
            const active = selectedClass?.id === c.id
            const qs = new URLSearchParams({
              classId: c.id,
              from: range.from,
              to: range.to,
              g: granularity,
            }).toString()
            return (
              <Link
                key={c.id}
                href={`${BASE_PATH}?${qs}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                  active
                    ? 'bg-primary/15 text-primary ring-primary/40'
                    : 'bg-surface-raised text-text-muted ring-border hover:text-text-primary'
                }`}
              >
                {c.name}
              </Link>
            )
          })}
        </div>
      )}

      {selectedClass ? (
        <>
          <AttendanceRangeFilter
            basePath={BASE_PATH}
            from={range.from}
            to={range.to}
            extraParams={{ classId: selectedClass.id, g: granularity }}
          />
          <AttendanceSummaryTable
            students={summary.students}
            totalSessions={summary.totalSessions}
          />
          <AttendancePeriodRollup
            periods={periods}
            granularity={granularity}
            basePath={BASE_PATH}
            params={{ classId: selectedClass.id, from: range.from, to: range.to }}
          />
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-text-muted">No classes found.</p>
        </div>
      )}
    </div>
  )
}

function formatRange(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const f = new Date(from + 'T00:00:00').toLocaleDateString('en-IE', opts)
  const t = new Date(to + 'T00:00:00').toLocaleDateString('en-IE', opts)
  return `${f} – ${t}`
}
