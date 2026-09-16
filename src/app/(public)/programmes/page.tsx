import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getViewerSchool } from '@/lib/tenant/server'
import { FindYourSchool } from '@/components/tenant/FindYourSchool'
import { formatCurrency } from '@/lib/utils'
import type { ProgrammeRow, ProgrammeClassEligibilityRow, ClassRow } from '@/types/database'

export const metadata: Metadata = {
  title: 'Programmes',
  description: 'View all current programmes and enrol your child online.',
}

const PRICING_MODEL_LABELS: Record<string, string> = {
  per_term: 'Per term',
  per_month: 'Per month',
  per_session: 'Per session',
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
}

type ProgrammeWithEligibility = Pick<
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
> & {
  programme_class_eligibility: (Pick<ProgrammeClassEligibilityRow, 'class_id'> & {
    classes: Pick<ClassRow, 'name' | 'display_order'> | null
  })[]
}

export default async function PublicProgrammesPage() {
  const adminClient = createSupabaseAdminClient()
  // Viewer-aware: a signed-in user must see THEIR school's catalogue, not the
  // default school's, when no subdomain/`/s/<sub>` tenant applies.
  const school = await getViewerSchool()
  // No tenant and nobody signed in → ask which school rather than guessing.
  if (!school) return <FindYourSchool />
  const schoolId = school.id

  const { data: rawProgrammes } = await adminClient
    .from('programmes')
    .select(
      'id, name, description, price_cents, pricing_model, days_of_week, session_time, term_start, term_end, programme_class_eligibility(class_id, classes(name, display_order))',
    )
    .eq('school_id', schoolId)
    .eq('publication_status', 'published')
    .eq('is_active', true)
    .order('name')

  const programmes = (rawProgrammes as ProgrammeWithEligibility[] | null) ?? []

  return (
    <>
      {/* Hero — matches homepage colour scheme */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #ece6fc 0%, #f3f0fb 62%)' }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {school.name} Programmes
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Current <span className="text-primary">Programmes</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Recurring weekly sessions available for enrolment. Parents can{' '}
            <Link href="/login" className="text-primary hover:underline">
              sign in
            </Link>{' '}
            for a personalised view, or enrol as a guest using your child&apos;s pupil payment code.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {programmes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-16 text-center">
            <p className="text-text-muted">No programmes are available at the moment.</p>
            <p className="mt-1 text-sm text-text-muted">Check back soon or contact the school.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programmes.map((programme) => {
              const classNames = programme.programme_class_eligibility
                .slice()
                .sort((a, b) => (a.classes?.display_order ?? 0) - (b.classes?.display_order ?? 0))
                .map((e) => e.classes?.name)
                .filter(Boolean)

              const days = (programme.days_of_week ?? []).map((d) => DAY_LABELS[d] ?? d).join(', ')

              const sessionTime = programme.session_time ? programme.session_time.slice(0, 5) : null

              return (
                <div
                  key={programme.id}
                  className="rounded-2xl border border-border bg-surface p-6 transition-all hover:border-primary/30"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">{programme.name}</h2>
                    <div className="shrink-0 text-right">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(programme.price_cents)}
                      </span>
                      <span className="ml-1 text-sm text-text-muted">
                        {PRICING_MODEL_LABELS[programme.pricing_model] ?? programme.pricing_model}
                      </span>
                    </div>
                  </div>

                  {programme.description && (
                    <p className="mb-3 text-sm text-text-secondary">{programme.description}</p>
                  )}

                  {(days || sessionTime) && (
                    <p className="mb-3 text-sm text-text-muted">
                      {days && <span>{days}</span>}
                      {days && sessionTime && <span> · </span>}
                      {sessionTime && <span>{sessionTime}</span>}
                    </p>
                  )}

                  {classNames.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {classNames.map((name) => (
                        <span
                          key={name as string}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/login?next=/parent/programmes"
                      className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
                    >
                      Sign in to enrol
                    </Link>
                    <Link
                      href={`/guest-programme?programmeId=${programme.id}`}
                      className="inline-flex items-center rounded-xl border border-border bg-surface-raised px-5 py-2.5 text-sm font-semibold text-text-primary transition-all hover:border-primary/30 hover:text-primary"
                    >
                      Enrol as guest
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
