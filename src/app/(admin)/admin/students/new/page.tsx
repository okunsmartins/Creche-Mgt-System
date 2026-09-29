import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { StudentForm } from '@/components/students/StudentForm'
import { createStudentAction } from '@/lib/students/actions'
import type { ClassRow } from '@/types/database'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Add Child' }

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>

export default async function NewStudentPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const supabase = createSupabaseAdminClient()
  const classesResult = await supabase
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')

  const rawClasses = classesResult.data as ClassOption[] | null
  const classOptions: SelectOption[] = (rawClasses ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/students" className="hover:text-primary hover:underline">
          Children
        </Link>
        {' / '}
        <span className="text-text-primary">Add child</span>
      </nav>

      <h1 className="mb-6 text-2xl font-bold text-text-primary">Add child</h1>

      {classOptions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-text-muted">No rooms found.</p>
          <p className="mt-1 text-sm text-text-muted">
            Rooms must be created before adding children.
          </p>
        </div>
      ) : (
        <StudentForm action={createStudentAction} classes={classOptions} />
      )}
    </div>
  )
}
