import type { Metadata } from 'next'
import { Inbox } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherSubmissions } from '@/lib/assignments/queries'
import { StudentSubmissionsList } from '@/components/assignments/StudentSubmissionsList'

export const metadata: Metadata = { title: 'Assignments | Teacher' }

export default async function TeacherAssignmentsPage() {
  const teacher = await requireTeacher()
  const { hasClasses, students } = await getTeacherSubmissions(teacher.email)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Assignments</h1>
        <p className="mt-1 text-sm text-text-muted">
          Work parents have uploaded for pupils in your class
          {students.length > 0 ? ', newest first' : ''}.
        </p>
      </div>

      {!hasClasses ? (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          You have no class assigned yet, so there are no pupils to show.
        </p>
      ) : students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-8 text-sm text-text-muted">
          <Inbox className="h-4 w-4" aria-hidden="true" />
          No assignments have been uploaded yet.
        </div>
      ) : (
        <StudentSubmissionsList students={students} />
      )}
    </div>
  )
}
