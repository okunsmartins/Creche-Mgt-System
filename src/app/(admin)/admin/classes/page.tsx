import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import type { ClassRow, TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Rooms | Admin' }

type ClassWithTeacher = Pick<
  ClassRow,
  'id' | 'name' | 'display_order' | 'academic_year' | 'is_active' | 'teacher_id' | 'capacity'
> & {
  teachers: Pick<TeacherRow, 'first_name' | 'last_name' | 'display_name'> | null
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>
}) {
  const admin = await requireAdmin()
  const { created } = await searchParams
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('classes')
    .select(
      'id, name, display_order, academic_year, is_active, teacher_id, capacity, teachers(first_name, last_name, display_name)',
    )
    .eq('school_id', admin.schoolId!)
    .order('display_order')

  const classes = (data as ClassWithTeacher[] | null) ?? []

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rooms</h1>
          <p className="mt-1 text-sm text-text-muted">
            Add, rename and set up your rooms — capacity, lead staff and status.
          </p>
        </div>
        <Link
          href="/admin/classes/new"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white shadow-[inset_0_-4px_0_#1b4fae] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add room
        </Link>
      </div>

      {created && (
        <div className="mb-4">
          <Alert variant="success">Room added. Click Rename / edit to change it any time.</Alert>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-bold text-text-primary">No rooms yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Add your first room to start checking children in and tracking ratios.
          </p>
          <Link
            href="/admin/classes/new"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add room
          </Link>
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
                  Places
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted lg:table-cell">
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
                      {cls.capacity ?? <span className="text-text-muted">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
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
                        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-primary hover:underline"
                        aria-label={`Rename or edit ${cls.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Rename / edit
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
