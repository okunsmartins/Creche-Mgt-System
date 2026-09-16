import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ActivityForm } from '@/components/activities/ActivityForm'
import { createActivityAction } from '@/lib/activities/actions'
import type { ClassRow, StudentRow } from '@/types/database'

export const metadata: Metadata = { title: 'New Activity' }

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>
type StudentOption = Pick<StudentRow, 'id' | 'first_name' | 'last_name' | 'class_id'>

export default async function NewActivityPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const supabase = createSupabaseAdminClient()
  const [classesResult, studentsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, display_order')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('students')
      .select('id, first_name, last_name, class_id')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('last_name'),
  ])

  const classes = classesResult.data as ClassOption[] | null
  const students = studentsResult.data as StudentOption[] | null

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/activities" className="hover:text-primary hover:underline">
          Activities
        </Link>
        {' / '}
        <span className="text-text-primary">New activity</span>
      </nav>

      <h1 className="mb-6 text-2xl font-bold text-text-primary">New activity</h1>

      <ActivityForm
        action={createActivityAction}
        classes={classes ?? []}
        students={students ?? []}
      />
    </div>
  )
}
