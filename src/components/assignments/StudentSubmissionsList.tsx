import { AssignmentFileRow } from './AssignmentFileRow'
import type { StudentSubmissions } from '@/lib/assignments/sort'

/**
 * Read-only submission inbox shared by the teacher and admin views: one block
 * per student who has uploaded work, each file with a signed "View" link. No
 * delete — staff can view a pupil's submissions but only the parent removes them.
 */
export function StudentSubmissionsList({ students }: { students: StudentSubmissions[] }) {
  return (
    <div className="space-y-6">
      {students.map((s) => (
        <div key={s.studentId}>
          <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-text-primary">
            {s.firstName} {s.lastName}
            {s.className && (
              <span className="text-sm font-normal text-text-muted">{s.className}</span>
            )}
            <span className="text-sm font-normal text-text-muted">
              · {s.assignments.length} {s.assignments.length === 1 ? 'file' : 'files'}
            </span>
          </h2>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {s.assignments.map((a) => (
              <AssignmentFileRow key={a.id} assignment={a} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
