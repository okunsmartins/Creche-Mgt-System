import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { TeacherStatusToggle } from '@/components/teachers/TeacherStatusToggle'
import type { TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Staff | Admin' }

export default async function TeachersPage() {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('teachers')
    .select('id, first_name, last_name, display_name, email, is_active, created_at')
    .eq('school_id', admin.schoolId!)
    .order('last_name')
    .order('first_name')

  const teachers = (data as TeacherRow[] | null) ?? []
  const active = teachers.filter((t) => t.is_active).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff</h1>
          <p className="mt-1 text-sm text-text-muted">
            {active} active · {teachers.length} total
          </p>
        </div>
        <Link
          href="/admin/teachers/new"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Add staff member
        </Link>
      </div>

      {teachers.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-text-muted">No staff have been added yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Name
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted sm:table-cell">
                  Email
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
              {teachers.map((teacher) => {
                const displayName =
                  teacher.display_name ?? `${teacher.first_name} ${teacher.last_name}`
                return (
                  <tr key={teacher.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{displayName}</p>
                      <p className="mt-0.5 text-xs text-text-muted md:hidden">
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      {teacher.email ?? <span className="text-text-muted">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <TeacherStatusToggle
                        teacherId={teacher.id}
                        currentStatus={teacher.is_active}
                        firstName={teacher.first_name}
                        lastName={teacher.last_name}
                        displayName={teacher.display_name}
                        email={teacher.email}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/teachers/${teacher.id}`}
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
