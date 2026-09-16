import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { getSlipDetail, teacherOwnsSlip } from '@/lib/permission-slips/queries'
import { SlipResponsesTable } from '@/components/permission-slips/SlipResponsesTable'

export const metadata: Metadata = { title: 'Permission Slip | Teacher' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function TeacherSlipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const teacher = await requireTeacher()
  if (!teacher.schoolId) notFound()
  const schoolId = teacher.schoolId
  const { id } = await params

  const adminClient = createSupabaseAdminClient()
  const resolved = await resolveTeacherClasses(adminClient, teacher.email)
  const classIds = (resolved?.classes ?? []).map((c) => c.id)

  // A teacher may only view a slip that belongs to one of their own classes.
  if (!(await teacherOwnsSlip(schoolId, classIds, id))) notFound()

  const detail = await getSlipDetail(id, schoolId)
  if (!detail) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-sm text-text-muted">
        <Link href="/teacher/permission-slips" className="hover:text-primary hover:underline">
          Permission slips
        </Link>
        {' / '}
        <span className="text-text-primary">{detail.title}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">{detail.title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {detail.audienceLabel}
          {detail.dueDate ? ` · due ${formatDate(detail.dueDate)}` : ''}
        </p>
        {detail.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
            {detail.description}
          </p>
        )}
      </div>

      <SlipResponsesTable tally={detail.tally} students={detail.students} />
    </div>
  )
}
