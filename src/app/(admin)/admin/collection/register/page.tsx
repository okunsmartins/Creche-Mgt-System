import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { RegisterPanel, type RegisterRunGroup } from '@/components/collection/RegisterPanel'

export const metadata: Metadata = { title: 'Collection Register' }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function CollectionRegisterPage({
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

  const [{ data: runData }, { data: enrData }, { data: regData }] = await Promise.all([
    db
      .from('collection_runs')
      .select('id, name, origin_school_name')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('name'),
    db
      .from('collection_enrolments')
      .select('student_id, collection_run_id, students(first_name, last_name)')
      .eq('school_id', admin.schoolId)
      .eq('status', 'approved'),
    db
      .from('collection_register')
      .select('collection_run_id, student_id, status')
      .eq('school_id', admin.schoolId)
      .eq('date', date),
  ])

  const runs = (runData ?? []) as { id: string; name: string; origin_school_name: string }[]
  const enrolments = (enrData ?? []) as unknown as {
    student_id: string
    collection_run_id: string
    students: { first_name: string | null; last_name: string | null } | null
  }[]
  const register = (regData ?? []) as {
    collection_run_id: string
    student_id: string
    status: string
  }[]

  // Approved collectors for the enrolled children (for the "released to" picker).
  const studentIds = [...new Set(enrolments.map((e) => e.student_id))]
  let collectors: { id: string; student_id: string; full_name: string }[] = []
  if (studentIds.length > 0) {
    const { data } = await db
      .from('authorised_collectors')
      .select('id, student_id, full_name')
      .eq('school_id', admin.schoolId)
      .eq('status', 'approved')
      .in('student_id', studentIds)
    collectors = (data ?? []) as typeof collectors
  }

  const statusByKey = new Map(
    register.map((r) => [`${r.collection_run_id}:${r.student_id}`, r.status]),
  )
  const collectorsByStudent = new Map<string, { id: string; name: string }[]>()
  for (const c of collectors) {
    const arr = collectorsByStudent.get(c.student_id) ?? []
    arr.push({ id: c.id, name: c.full_name })
    collectorsByStudent.set(c.student_id, arr)
  }

  const groups: RegisterRunGroup[] = runs.map((run) => ({
    runId: run.id,
    runName: run.name,
    originSchoolName: run.origin_school_name,
    children: enrolments
      .filter((e) => e.collection_run_id === run.id)
      .map((e) => ({
        studentId: e.student_id,
        childName: [e.students?.first_name, e.students?.last_name].filter(Boolean).join(' ') || '—',
        status: statusByKey.get(`${run.id}:${e.student_id}`) ?? 'scheduled',
        collectors: collectorsByStudent.get(e.student_id) ?? [],
      }))
      .sort((a, b) => a.childName.localeCompare(b.childName)),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Collection register</h1>
        <p className="mt-1 text-sm text-text-muted">
          Mark each child collected from school, then released to an authorised collector.
        </p>
      </div>
      <RegisterPanel groups={groups} date={date} />
    </div>
  )
}
