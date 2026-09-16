import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ProgrammeForm } from '@/components/programmes/ProgrammeForm'
import { createProgrammeAction } from '@/lib/programmes/actions'
import type { ClassRow } from '@/types/database'

export const metadata: Metadata = { title: 'New Programme' }

export default async function NewProgrammePage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const supabase = createSupabaseAdminClient()
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')

  const classes = (classData as Pick<ClassRow, 'id' | 'name' | 'display_order'>[] | null) ?? []

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/programmes" className="hover:text-primary hover:underline">
          Programmes
        </Link>
        {' / '}
        <span className="text-text-primary">New programme</span>
      </nav>

      <h1 className="mb-6 text-2xl font-bold text-text-primary">New programme</h1>

      <ProgrammeForm action={createProgrammeAction} classes={classes} />
    </div>
  )
}
