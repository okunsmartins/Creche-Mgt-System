import type { Metadata } from 'next'
import { Inbox } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSchoolSubmissions } from '@/lib/assignments/queries'
import { StudentSubmissionsList } from '@/components/assignments/StudentSubmissionsList'
import { AssignmentClassFilter } from '@/components/assignments/AssignmentClassFilter'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Assignments | Admin' }

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No school is associated with your account.
        </p>
      </div>
    )
  }

  const { classId } = await searchParams
  const supabase = createSupabaseAdminClient()
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')
  const classes = (classData as { id: string; name: string }[] | null) ?? []
  // Only honour a classId the admin actually owns; otherwise show all.
  const activeClassId = classId && classes.some((c) => c.id === classId) ? classId : undefined

  const students = await getSchoolSubmissions(admin.schoolId, activeClassId)
  const classOptions: SelectOption[] = classes.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Assignments</h1>
        <p className="mt-1 text-sm text-text-muted">
          Work parents have uploaded for pupils across the school
          {students.length > 0 ? ', newest first' : ''}.
        </p>
      </div>

      {classes.length > 0 && (
        <AssignmentClassFilter classes={classOptions} selected={activeClassId ?? ''} />
      )}

      {students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-8 text-sm text-text-muted">
          <Inbox className="h-4 w-4" aria-hidden="true" />
          {activeClassId
            ? 'No assignments have been uploaded for this class yet.'
            : 'No assignments have been uploaded yet.'}
        </div>
      ) : (
        <StudentSubmissionsList students={students} />
      )}
    </div>
  )
}
