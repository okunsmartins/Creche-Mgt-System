import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { updateTeacherAction } from '@/lib/teachers/actions'
import { TeacherForm } from '@/components/teachers/TeacherForm'
import { TeacherLoginPanel } from '@/components/teachers/TeacherLoginPanel'
import type { TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Edit Staff | Admin' }

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  const { data } = await adminClient
    .from('teachers')
    .select('id, first_name, last_name, display_name, email, is_active, profile_id')
    .eq('id', id)
    .eq('school_id', admin.schoolId!)
    .single()

  if (!data) notFound()

  const teacher = data as TeacherRow
  const boundAction = updateTeacherAction.bind(null, id)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/teachers" className="text-sm text-primary hover:underline">
          ← Staff
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">
          Edit {teacher.first_name} {teacher.last_name}
        </h1>
      </div>

      <div className="card p-6">
        <TeacherForm action={boundAction} teacher={teacher} submitLabel="Save changes" />
      </div>

      <TeacherLoginPanel
        teacherId={teacher.id}
        hasLogin={!!teacher.profile_id}
        email={teacher.email}
      />
    </div>
  )
}
