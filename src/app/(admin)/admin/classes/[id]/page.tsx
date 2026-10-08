import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { updateClassAction } from '@/lib/classes/actions'
import { ClassEditForm } from '@/components/classes/ClassEditForm'
import type { ClassRow, TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Edit Room | Admin' }

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  const [classResult, teachersResult] = await Promise.all([
    adminClient
      .from('classes')
      .select('id, name, display_order, academic_year, capacity, is_active, teacher_id')
      .eq('id', id)
      .eq('school_id', admin.schoolId!)
      .single(),
    adminClient
      .from('teachers')
      .select('id, first_name, last_name, display_name, is_active')
      .eq('school_id', admin.schoolId!)
      .eq('is_active', true)
      .order('last_name'),
  ])

  if (!classResult.data) notFound()

  const cls = classResult.data as Pick<
    ClassRow,
    'id' | 'name' | 'display_order' | 'academic_year' | 'capacity' | 'is_active' | 'teacher_id'
  >
  const teachers =
    (teachersResult.data as
      | Pick<TeacherRow, 'id' | 'first_name' | 'last_name' | 'display_name' | 'is_active'>[]
      | null) ?? []

  const boundAction = updateClassAction.bind(null, id)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/classes" className="text-sm text-primary hover:underline">
          ← Rooms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Edit {cls.name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Update the staff assignment and status for this room.
        </p>
      </div>

      <div className="card p-6">
        <ClassEditForm action={boundAction} cls={cls} teachers={teachers} />
      </div>
    </div>
  )
}
