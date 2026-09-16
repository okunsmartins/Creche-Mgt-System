import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Users } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ProgrammeForm } from '@/components/programmes/ProgrammeForm'
import { ProgrammeStatusActions } from '@/components/programmes/ProgrammeStatusActions'
import { StatusBadge } from '@/components/ui/Badge'
import { updateProgrammeAction } from '@/lib/programmes/actions'
import { formatCurrency } from '@/lib/utils'
import type {
  ProgrammeRow,
  ClassRow,
  ProgrammeClassEligibilityRow,
  PricingModel,
} from '@/types/database'

export const metadata: Metadata = { title: 'Edit Programme' }

type ProgrammeDetail = Pick<
  ProgrammeRow,
  | 'id'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'pricing_model'
  | 'days_of_week'
  | 'session_time'
  | 'term_start'
  | 'term_end'
  | 'max_enrolments'
  | 'publication_status'
  | 'is_active'
>

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>

interface PageProps {
  params: Promise<{ id: string }>
}

const PRICING_LABEL: Record<string, string> = {
  per_term: 'per term',
  per_month: 'per month',
  per_session: 'per session',
}

export default async function EditProgrammePage({ params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const [programmeResult, classesResult, eligibilityResult] = await Promise.all([
    supabase
      .from('programmes')
      .select(
        'id, name, description, price_cents, pricing_model, days_of_week, session_time, term_start, term_end, max_enrolments, publication_status, is_active',
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
    supabase.from('programme_class_eligibility').select('class_id').eq('programme_id', id),
  ])

  const programme = programmeResult.data as ProgrammeDetail | null
  const classes = classesResult.data as ClassOption[] | null
  const eligibility = eligibilityResult.data as
    | Pick<ProgrammeClassEligibilityRow, 'class_id'>[]
    | null

  if (!programme) notFound()

  const selectedClassIds = (eligibility ?? []).map((e) => e.class_id)

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/programmes" className="hover:text-primary hover:underline">
          Programmes
        </Link>
        {' / '}
        <span className="text-text-primary">{programme.name}</span>
      </nav>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{programme.name}</h1>
        <StatusBadge status={programme.publication_status} />
        <Link
          href={`/admin/programmes/${programme.id}/enrolments`}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Enrolments
        </Link>
      </div>
      <p className="mb-6 text-sm text-text-muted">
        {formatCurrency(programme.price_cents)} {PRICING_LABEL[programme.pricing_model]}
      </p>

      {programme.publication_status !== 'archived' ? (
        <ProgrammeForm
          action={updateProgrammeAction}
          classes={classes ?? []}
          programme={{
            id: programme.id,
            name: programme.name,
            description: programme.description,
            priceEuros: (programme.price_cents / 100).toFixed(2),
            pricingModel: programme.pricing_model as PricingModel,
            daysOfWeek: programme.days_of_week,
            sessionTime: programme.session_time,
            termStart: programme.term_start,
            termEnd: programme.term_end,
            maxEnrolments: programme.max_enrolments,
            classIds: selectedClassIds,
          }}
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">
            This programme is archived and cannot be edited.
          </p>
        </div>
      )}

      <hr className="my-8 border-border" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Publication status</h2>
        <p className="text-sm text-text-muted">
          {programme.publication_status === 'draft' &&
            'Draft programmes are not visible to parents. Publish when ready.'}
          {programme.publication_status === 'published' &&
            'This programme is live. Parents can see it and enrol their children. Close to stop new enrolments, or archive to permanently remove it.'}
          {programme.publication_status === 'closed' &&
            'This programme is closed. Parents cannot see or enrol in it, but it can be re-published at any time.'}
          {programme.publication_status === 'archived' &&
            'This programme is archived and no longer visible to parents.'}
        </p>
        <ProgrammeStatusActions
          programmeId={programme.id}
          currentStatus={programme.publication_status}
        />
      </section>
    </div>
  )
}
