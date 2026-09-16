import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { StudentAttendanceSummary } from '@/lib/attendance/summary'

interface Props {
  students: StudentAttendanceSummary[]
  totalSessions: number
}

/** Colour band for an attendance rate. Late counts as present, so these read on
 *  the combined (present + late) figure. */
function rateClasses(rate: number | null): string {
  if (rate === null) return 'text-text-muted'
  if (rate >= 95) return 'text-emerald-400'
  if (rate >= 85) return 'text-amber-400'
  return 'text-red-400'
}

export function AttendanceSummaryTable({ students, totalSessions }: Props) {
  // Only a class with no roster at all has nothing to show. A class with
  // students but no sessions in range still renders the table (rates as "—")
  // so the Attendance % column never disappears — we just flag the empty range.
  if (students.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-text-muted">No students in this class.</p>
      </div>
    )
  }

  // Class-level totals
  const totals = students.reduce(
    (acc, s) => {
      acc.present += s.present
      acc.late += s.late
      acc.absent += s.absent
      return acc
    },
    { present: 0, late: 0, absent: 0 },
  )

  return (
    <div className="space-y-4">
      {/* Empty-range notice — the table still renders so the % column stays visible */}
      {totalSessions === 0 && (
        <div className="rounded-2xl bg-amber-500/10 px-5 py-4 ring-1 ring-amber-500/20">
          <p className="text-sm text-amber-300">
            No attendance sessions recorded in this period. Try a wider date range or a different
            month — percentages show once there are sessions to count.
          </p>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-border">
          {totalSessions} session{totalSessions === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
          <CheckCircle2 className="h-3.5 w-3.5" /> {totals.present} Present
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
          <Clock className="h-3.5 w-3.5" /> {totals.late} Late
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
          <XCircle className="h-3.5 w-3.5" /> {totals.absent} Absent
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                Student
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Present
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-400">
                Late
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-red-400">
                Absent
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-text-muted">
                Attendance
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr
                key={s.studentId}
                className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
              >
                <td className="px-4 py-3 font-medium text-text-primary">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-400">
                  {s.present}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-amber-400">{s.late}</td>
                <td className="px-4 py-3 text-center font-semibold text-red-400">{s.absent}</td>
                <td
                  className={`px-4 py-3 text-right font-bold tabular-nums ${rateClasses(s.attendanceRate)}`}
                >
                  {s.attendanceRate === null ? '—' : `${s.attendanceRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        Attendance % counts late arrivals as present. Only absences reduce the rate.
      </p>
    </div>
  )
}
