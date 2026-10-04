import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getSchoolObservations, getSchoolStudentOptions } from '@/lib/observations/queries'
import { ObservationComposer } from '@/components/observations/ObservationComposer'
import { ObservationTimeline } from '@/components/observations/ObservationTimeline'

export const metadata: Metadata = { title: 'Learning Journals | Admin' }

export default async function AdminObservationsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const [studentOptions, students] = await Promise.all([
    getSchoolStudentOptions(admin.schoolId),
    getSchoolObservations(admin.schoolId),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Learning journals</h1>
        <p className="mt-1 text-sm text-text-muted">
          Record dated observations for each child, tag them to Aistear themes, and share them with
          parents.
        </p>
      </div>
      <ObservationComposer studentOptions={studentOptions} />
      <ObservationTimeline
        students={students}
        canManage
        emptyText="No observations recorded yet. Record your first one above."
      />
    </div>
  )
}
