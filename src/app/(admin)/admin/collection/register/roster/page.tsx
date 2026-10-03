import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/ui/PrintButton'
import { assessRunStaffing, formatDays } from '@/lib/collection/collection'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Collection Roster' }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RosterChild {
  studentId: string
  childName: string
  collectors: { name: string; relationship: string }[]
}
interface RosterRun {
  runId: string
  name: string
  originSchoolName: string
  pickupTime: string | null
  methodLabel: string | null
  days: number[]
  childrenPerChaperone: number
  staffNames: string[]
  children: RosterChild[]
}

export default async function CollectionRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const { date: dateParam } = await searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '') ? dateParam! : todayISO()
  const db = createSupabaseAdminClient()

  const [{ data: runData }, { data: enrData }, { data: staffLinkData }] = await Promise.all([
    db
      .from('collection_runs')
      .select(
        'id, name, origin_school_name, pickup_time, days_of_week, children_per_chaperone, collection_methods(label)',
      )
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('name'),
    db
      .from('collection_enrolments')
      .select('student_id, collection_run_id, students(first_name, last_name)')
      .eq('school_id', admin.schoolId)
      .eq('status', 'approved'),
    db
      .from('collection_run_staff')
      .select('collection_run_id, teachers(first_name, last_name)')
      .eq('school_id', admin.schoolId),
  ])

  const runs = (runData ?? []) as unknown as {
    id: string
    name: string
    origin_school_name: string
    pickup_time: string | null
    days_of_week: number[] | null
    children_per_chaperone: number
    collection_methods: { label: string } | null
  }[]
  const enrolments = (enrData ?? []) as unknown as {
    student_id: string
    collection_run_id: string
    students: { first_name: string | null; last_name: string | null } | null
  }[]
  const staffLinks = (staffLinkData ?? []) as unknown as {
    collection_run_id: string
    teachers: { first_name: string | null; last_name: string | null } | null
  }[]

  // Approved collectors for the enrolled children.
  const studentIds = [...new Set(enrolments.map((e) => e.student_id))]
  let collectors: { student_id: string; full_name: string; relationship: string }[] = []
  if (studentIds.length > 0) {
    const { data } = await db
      .from('authorised_collectors')
      .select('student_id, full_name, relationship')
      .eq('school_id', admin.schoolId)
      .eq('status', 'approved')
      .in('student_id', studentIds)
    collectors = (data ?? []) as typeof collectors
  }

  const staffByRun = new Map<string, string[]>()
  for (const s of staffLinks) {
    const name = [s.teachers?.first_name, s.teachers?.last_name].filter(Boolean).join(' ')
    if (!name) continue
    const arr = staffByRun.get(s.collection_run_id) ?? []
    arr.push(name)
    staffByRun.set(s.collection_run_id, arr)
  }
  const collectorsByStudent = new Map<string, { name: string; relationship: string }[]>()
  for (const c of collectors) {
    const arr = collectorsByStudent.get(c.student_id) ?? []
    arr.push({ name: c.full_name, relationship: c.relationship })
    collectorsByStudent.set(c.student_id, arr)
  }

  const roster: RosterRun[] = runs.map((run) => ({
    runId: run.id,
    name: run.name,
    originSchoolName: run.origin_school_name,
    pickupTime: run.pickup_time,
    methodLabel: run.collection_methods?.label ?? null,
    days: run.days_of_week ?? [],
    childrenPerChaperone: run.children_per_chaperone,
    staffNames: staffByRun.get(run.id) ?? [],
    children: enrolments
      .filter((e) => e.collection_run_id === run.id)
      .map((e) => ({
        studentId: e.student_id,
        childName: [e.students?.first_name, e.students?.last_name].filter(Boolean).join(' ') || '—',
        collectors: collectorsByStudent.get(e.student_id) ?? [],
      }))
      .sort((a, b) => a.childName.localeCompare(b.childName)),
  }))

  const runsWithChildren = roster.filter((r) => r.children.length > 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Collection roster</h1>
          <p className="mt-1 text-sm text-text-muted">
            A printable sheet to carry on the run — tick each child off as they are collected and
            released.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/collection/register"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
          >
            ← Back to register
          </a>
          <PrintButton label="Print roster" />
        </div>
      </div>

      {/* Print header (only shows on paper). */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">School collection roster</h1>
        <p className="text-sm">{formatDate(date)}</p>
      </div>

      {runsWithChildren.length === 0 ? (
        <div className="no-print rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No children are enrolled on any active run, so there is nothing to print.
        </div>
      ) : (
        <div className="space-y-8">
          {runsWithChildren.map((run) => {
            const staffing = assessRunStaffing(
              run.children.length,
              run.staffNames.length,
              run.childrenPerChaperone,
            )
            return (
              <section key={run.runId} className="break-inside-avoid">
                <div className="mb-2 border-b-2 border-black pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-bold text-text-primary">{run.name}</h2>
                    <span className="text-sm text-text-secondary">{formatDate(date)}</span>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-text-secondary sm:grid-cols-3">
                    <div>
                      <dt className="inline font-medium">From: </dt>
                      <dd className="inline">{run.originSchoolName}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Pickup: </dt>
                      <dd className="inline">{run.pickupTime || '—'}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Method: </dt>
                      <dd className="inline">{run.methodLabel || '—'}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Days: </dt>
                      <dd className="inline">{formatDays(run.days)}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Children: </dt>
                      <dd className="inline">{run.children.length}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Chaperones: </dt>
                      <dd className="inline">
                        {run.staffNames.length} assigned / {staffing.requiredChaperones} required
                        {!staffing.ratioMet && (
                          <span className="font-semibold text-error"> ⚠ under ratio</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {run.staffNames.length > 0 && (
                    <p className="mt-1 text-sm text-text-secondary">
                      <span className="font-medium">Staff: </span>
                      {run.staffNames.join(', ')}
                    </p>
                  )}
                </div>

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-black text-left">
                      <th className="w-6 py-1 pr-2">#</th>
                      <th className="py-1 pr-2">Child</th>
                      <th className="w-20 py-1 pr-2 text-center">Collected</th>
                      <th className="py-1 pr-2">Released to (tick)</th>
                      <th className="w-40 py-1">Signature / time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.children.map((c, i) => (
                      <tr key={c.studentId} className="border-b border-border align-top">
                        <td className="py-2 pr-2">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium text-text-primary">{c.childName}</td>
                        <td className="py-2 pr-2 text-center">
                          <span className="inline-block h-4 w-4 border border-black align-middle" />
                        </td>
                        <td className="py-2 pr-2">
                          {c.collectors.length === 0 ? (
                            <span className="text-text-muted">No approved collector on file ⚠</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {c.collectors.map((col, j) => (
                                <li key={j} className="flex items-center gap-1.5">
                                  <span className="inline-block h-3 w-3 border border-black" />
                                  <span>
                                    {col.name}
                                    <span className="text-text-muted"> ({col.relationship})</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2">
                          <span className="inline-block min-h-[1.25rem] w-full border-b border-dotted border-black" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
