import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Users } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ActivityForm } from '@/components/activities/ActivityForm'
import { ActivityStatusActions } from '@/components/activities/ActivityStatusActions'
import { StatusBadge } from '@/components/ui/Badge'
import { updateActivityAction } from '@/lib/activities/actions'
import { formatCurrency } from '@/lib/utils'
import type {
  ActivityRow,
  ClassRow,
  ActivityClassEligibilityRow,
  ActivityPupilEligibilityRow,
  StudentRow,
} from '@/types/database'

export const metadata: Metadata = { title: 'Edit Activity' }

type ActivityDetail = Pick<
  ActivityRow,
  | 'id'
  | 'name'
  | 'description'
  | 'amount_cents'
  | 'accounting_code'
  | 'opens_at'
  | 'closes_at'
  | 'publication_status'
  | 'is_active'
>

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>
type StudentOption = Pick<StudentRow, 'id' | 'first_name' | 'last_name' | 'class_id'>

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditActivityPage({ params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const [activityResult, classesResult, eligibilityResult, pupilEligibilityResult, studentsResult] =
    await Promise.all([
      supabase
        .from('activities')
        .select(
          'id, name, description, amount_cents, accounting_code, opens_at, closes_at, publication_status, is_active',
        )
        .eq('id', id)
        .eq('school_id', admin.schoolId)
        .single(),
      supabase
        .from('classes')
        .select('id, name, display_order')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true)
        .order('display_order'),
      supabase.from('activity_class_eligibility').select('class_id').eq('activity_id', id),
      supabase.from('activity_pupil_eligibility').select('student_id').eq('activity_id', id),
      supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true)
        .order('last_name'),
    ])

  const activity = activityResult.data as ActivityDetail | null
  const classes = classesResult.data as ClassOption[] | null
  const eligibility = eligibilityResult.data as
    | Pick<ActivityClassEligibilityRow, 'class_id'>[]
    | null
  const pupilEligibility = pupilEligibilityResult.data as
    | Pick<ActivityPupilEligibilityRow, 'student_id'>[]
    | null
  const students = studentsResult.data as StudentOption[] | null

  if (!activity) notFound()

  const selectedClassIds = (eligibility ?? []).map((e) => e.class_id)
  const selectedPupilIds = (pupilEligibility ?? []).map((e) => e.student_id)

  // Truncate ISO timestamptz to "YYYY-MM-DDTHH:mm" for datetime-local inputs
  const toDatetimeLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : null)

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/activities" className="hover:text-primary hover:underline">
          Activities
        </Link>
        {' / '}
        <span className="text-text-primary">{activity.name}</span>
      </nav>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{activity.name}</h1>
        <StatusBadge status={activity.publication_status} />
        <Link
          href={`/admin/activities/${activity.id}/attendees`}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Attendees &amp; email
        </Link>
      </div>
      <p className="mb-6 text-sm text-text-muted">{formatCurrency(activity.amount_cents)}</p>

      {activity.publication_status !== 'archived' ? (
        <ActivityForm
          action={updateActivityAction}
          classes={classes ?? []}
          students={students ?? []}
          activity={{
            id: activity.id,
            name: activity.name,
            description: activity.description,
            amountEuros: (activity.amount_cents / 100).toFixed(2),
            accountingCode: activity.accounting_code,
            opensAt: toDatetimeLocal(activity.opens_at),
            closesAt: toDatetimeLocal(activity.closes_at),
            classIds: selectedClassIds,
            pupilIds: selectedPupilIds,
          }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">This activity is archived and cannot be edited.</p>
        </div>
      )}

      <hr className="my-8 border-border" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Publication status</h2>
        <p className="text-sm text-text-muted">
          {activity.publication_status === 'draft' &&
            'Draft activities are not visible to parents. Publish when ready.'}
          {activity.publication_status === 'published' &&
            'This activity is live. Parents can see and pay for it. Close to stop new payments, or archive to permanently remove it.'}
          {activity.publication_status === 'closed' &&
            'This activity is closed. Parents cannot see or pay for it, but it can be re-published at any time.'}
          {activity.publication_status === 'archived' &&
            'This activity is archived and no longer visible to parents.'}
        </p>
        <ActivityStatusActions
          activityId={activity.id}
          currentStatus={activity.publication_status}
        />
      </section>
    </div>
  )
}
