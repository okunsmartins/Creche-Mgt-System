import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { requireParent } from '@/lib/auth/guards'
import { getParentChildrenAttendance } from '@/lib/attendance/parent'
import { Badge } from '@/components/ui/Badge'
import { AbsenceReasonForm } from '@/components/attendance/AbsenceReasonForm'

export const metadata: Metadata = { title: 'Attendance' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function rateTone(rate: number): string {
  if (rate >= 95) return 'text-success'
  if (rate >= 90) return 'text-warning'
  return 'text-error'
}

export default async function ParentAttendancePage() {
  const parent = await requireParent()
  const children = await getParentChildrenAttendance(parent.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Attendance</h1>
      <p className="mb-6 text-sm text-text-muted">
        Your child&apos;s attendance record. Late arrivals count as present.
      </p>

      {children.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-text-muted">
            You have no linked children yet. Link a child to see their attendance.
          </p>
          <Link
            href="/parent/children"
            className="mt-3 inline-block font-semibold text-primary hover:underline"
          >
            Go to My Children →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {children.map((c) => {
            const s = c.summary
            return (
              <section
                key={s.studentId}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <h2 className="flex items-baseline gap-2 text-lg font-semibold text-text-primary">
                    {s.firstName} {s.lastName}
                    {c.className && (
                      <span className="text-sm font-normal text-text-muted">{c.className}</span>
                    )}
                  </h2>
                  <div className="text-right">
                    {s.attendanceRate === null ? (
                      <span className="text-sm text-text-muted">No sessions recorded yet</span>
                    ) : (
                      <>
                        <span className={`text-2xl font-bold ${rateTone(s.attendanceRate)}`}>
                          {s.attendanceRate}%
                        </span>
                        <span className="ml-1 text-xs text-text-muted">attendance</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
                  <div className="px-3 py-4">
                    <p className="text-2xl font-bold text-text-primary">{s.present}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-text-muted">
                      Present
                    </p>
                  </div>
                  <div className="px-3 py-4">
                    <p className="text-2xl font-bold text-warning">{s.late}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-text-muted">Late</p>
                  </div>
                  <div className="px-3 py-4">
                    <p className="text-2xl font-bold text-error">{s.absent}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-text-muted">Absent</p>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {c.recentFlags.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-text-muted">
                      <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
                      {s.totalMarked === 0
                        ? 'No attendance recorded yet.'
                        : 'No absences or late marks recorded.'}
                    </p>
                  ) : (
                    <>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Recent absences &amp; late marks
                      </h3>
                      <p className="mb-3 text-xs text-text-muted">
                        Add a reason so the school knows why your child was out.
                      </p>
                      <ul className="space-y-3">
                        {c.recentFlags.map((f) => (
                          <li
                            key={f.recordId}
                            className="rounded-lg border border-border px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <Badge variant={f.status === 'late' ? 'warning' : 'error'}>
                                  {f.status === 'late' ? 'Late' : 'Absent'}
                                </Badge>
                                <span className="text-text-primary">{formatDate(f.date)}</span>
                              </span>
                              {f.note && (
                                <span className="text-xs text-text-muted">Teacher: {f.note}</span>
                              )}
                            </div>
                            <AbsenceReasonForm
                              recordId={f.recordId}
                              initialReason={f.parentReason}
                            />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
