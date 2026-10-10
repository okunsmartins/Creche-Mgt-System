import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createClassAction } from '@/lib/classes/actions'
import { ClassEditForm } from '@/components/classes/ClassEditForm'
import type { TeacherRow } from '@/types/database'

export const metadata: Metadata = { title: 'Add Room | Admin' }

export default async function NewClassPage() {
  const admin = await requireAdmin()
  const { data } = await createSupabaseAdminClient()
    .from('teachers')
    .select('id, first_name, last_name, display_name, is_active')
    .eq('school_id', admin.schoolId!)
    .eq('is_active', true)
    .order('last_name')
  const teachers =
    (data as
      | Pick<TeacherRow, 'id' | 'first_name' | 'last_name' | 'display_name' | 'is_active'>[]
      | null) ?? []

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/classes" className="text-sm text-primary hover:underline">
          ← Rooms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Add a room</h1>
        <p className="mt-1 text-sm text-text-muted">
          Name the room, set how many places it has and, if you like, its lead staff member. You can
          rename or change it at any time.
        </p>
      </div>

      <div className="card p-6">
        <ClassEditForm action={createClassAction} teachers={teachers} />
      </div>
    </div>
  )
}
