import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { getStudentDocuments } from '@/lib/documents/queries'
import { TeacherStudentPicker } from '@/components/documents/TeacherStudentPicker'
import { StudentDocumentUploader } from '@/components/documents/StudentDocumentUploader'
import { DocumentFileRow } from '@/components/documents/DocumentFileRow'
import { DocumentDeleteButton } from '@/components/documents/DocumentDeleteButton'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Reports | Teacher' }

export default async function TeacherReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const teacher = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const resolved = await resolveTeacherClasses(adminClient, teacher.email)
  const classIds = (resolved?.classes ?? []).map((c) => c.id)
  const schoolId = teacher.schoolId

  // Students across the teacher's own classes (the only pupils they can manage).
  const { data: studentData } =
    classIds.length > 0
      ? await adminClient
          .from('students')
          .select('id, first_name, last_name')
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('last_name')
      : { data: [] }
  const students =
    (studentData as { id: string; first_name: string; last_name: string }[] | null) ?? []
  const studentOptions: SelectOption[] = students.map((s) => ({
    value: s.id,
    label: `${s.first_name} ${s.last_name}`,
  }))

  const { studentId } = await searchParams
  const selected = studentId && students.some((s) => s.id === studentId) ? studentId : ''

  const [testResults, reportCards] =
    selected && schoolId
      ? await Promise.all([
          getStudentDocuments(selected, 'test_result', schoolId),
          getStudentDocuments(selected, 'report_card', schoolId),
        ])
      : [[], []]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="mt-1 text-sm text-text-muted">
          Upload test results and report cards for pupils in your class. Their parents can view
          them.
        </p>
      </div>

      {classIds.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          You have no class assigned yet, so there are no pupils to manage.
        </p>
      ) : (
        <>
          <TeacherStudentPicker students={studentOptions} selected={selected} />

          {!selected ? (
            <p className="rounded-md border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
              Choose a pupil above to upload or view their reports.
            </p>
          ) : (
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-text-primary">Test results</h2>
                {testResults.length > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {testResults.map((d) => (
                      <DocumentFileRow
                        key={d.id}
                        doc={d}
                        action={<DocumentDeleteButton documentId={d.id} />}
                      />
                    ))}
                  </ul>
                )}
                <StudentDocumentUploader
                  studentId={selected}
                  category="test_result"
                  titleLabel="Title (optional)"
                  titlePlaceholder="e.g. Maths test – October"
                />
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold text-text-primary">Report cards</h2>
                {reportCards.length > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {reportCards.map((d) => (
                      <DocumentFileRow
                        key={d.id}
                        doc={d}
                        action={<DocumentDeleteButton documentId={d.id} />}
                      />
                    ))}
                  </ul>
                )}
                <StudentDocumentUploader
                  studentId={selected}
                  category="report_card"
                  titleLabel="Title (optional)"
                  titlePlaceholder="e.g. End-of-year report"
                  showTerm
                />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}
