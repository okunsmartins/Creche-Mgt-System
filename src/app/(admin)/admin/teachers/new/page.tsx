import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createTeacherAction } from '@/lib/teachers/actions'
import { TeacherForm } from '@/components/teachers/TeacherForm'

export const metadata: Metadata = { title: 'Add Teacher | Admin' }

export default async function NewTeacherPage() {
  await requireAdmin()
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/teachers" className="text-sm text-primary hover:underline">
          ← Teachers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Add teacher</h1>
      </div>

      <div className="card p-6">
        <TeacherForm action={createTeacherAction} />
      </div>
    </div>
  )
}
