import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherObservations, getTeacherStudentOptions } from '@/lib/observations/queries'
import { ObservationComposer } from '@/components/observations/ObservationComposer'
import { ObservationTimeline } from '@/components/observations/ObservationTimeline'

export const metadata: Metadata = { title: 'Learning Journals | Teacher' }

export default async function TeacherObservationsPage() {
  const teacher = await requireTeacher()
  const [studentOptions, { hasClasses, students }] = await Promise.all([
    getTeacherStudentOptions(teacher.email),
    getTeacherObservations(teacher.email),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Learning journals</h1>
        <p className="mt-1 text-sm text-text-muted">
          Record observations for the children in your class and share them with their parents.
        </p>
      </div>

      {!hasClasses ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          You have no class assigned yet. Ask your administrator to assign you to a room.
        </div>
      ) : (
        <>
          <ObservationComposer studentOptions={studentOptions} />
          <ObservationTimeline
            students={students}
            canManage
            emptyText="No observations yet. Record your first one above."
          />
        </>
      )}
    </div>
  )
}
