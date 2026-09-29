import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/Badge'
import type { ClassRow, TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Rooms | Admin' }

type ClassWithTeacher = Pick<
  ClassRow,
  'id' | 'name' | 'display_order' | 'academic_year' | 'is_active' | 'teacher_id'
> & {
  teachers: Pick<TeacherRow, 'first_name' | 'last_name' | 'display_name'> | null
}

export default async function ClassesPage() {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('classes')
    .select(
      'id, name, display_order, academic_year, is_active, teacher_id, teachers(first_name, last_name, display_name)',
    )
    .eq('school_id', admin.schoolId!)
    .order('display_order')

  const classes = (data as ClassWithTeacher[] | null) ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rooms</h1>
          <p className="mt-1 text-sm text-text-muted">
            Assign staff and manage room status for the current year.
          </p>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-text-muted">No rooms found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Room
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted sm:table-cell">
                  Academic year
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Lead staff
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted md:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((cls) => {
                const teacher = cls.teachers
                const teacherName = teacher
                  ? (teacher.display_name ?? `${teacher.first_name} ${teacher.last_name}`)
                  : null

                return (
                  <tr key={cls.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{cls.name}</p>
                      <p className="mt-0.5 text-xs text-text-muted md:hidden">
                        {cls.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      {cls.academic_year ?? <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {teacherName ?? <span className="text-text-muted">Unassigned</span>}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <StatusBadge status={cls.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/classes/${cls.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
