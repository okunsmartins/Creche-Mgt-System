import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getViewerSchool } from '@/lib/tenant/server'
import { FindYourSchool } from '@/components/tenant/FindYourSchool'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ActivityRow, ActivityClassEligibilityRow, ClassRow } from '@/types/database'

export const metadata: Metadata = {
  title: 'Activities',
  description: 'View all current activities and make payments online.',
}

type ActivityWithEligibility = Pick<
  ActivityRow,
  'id' | 'name' | 'description' | 'amount_cents' | 'opens_at' | 'closes_at'
> & {
  activity_class_eligibility: (Pick<ActivityClassEligibilityRow, 'class_id'> & {
    classes: Pick<ClassRow, 'name' | 'display_order'> | null
  })[]
}

export default async function PublicActivitiesPage() {
  const adminClient = createSupabaseAdminClient()
  // Viewer-aware: a signed-in user must see THEIR school's catalogue, not the
  // default school's, when no subdomain/`/s/<sub>` tenant applies.
  const school = await getViewerSchool()
  // No tenant and nobody signed in → ask which school rather than guessing.
  if (!school) return <FindYourSchool />
  const schoolId = school.id

  // Explicitly replicate the RLS policy public_read_published_activities:
  // published, active, scoped to the tenant, and within the open/close window.
  const now = new Date().toISOString()
  const { data: rawActivities } = await adminClient
    .from('activities')
    .select(
      'id, name, description, amount_cents, opens_at, closes_at, activity_class_eligibility(class_id, classes(name, display_order))',
    )
    .eq('school_id', schoolId)
    .eq('publication_status', 'published')
    .eq('is_active', true)
    .or(`opens_at.is.null,opens_at.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order('name')

  const activities = (rawActivities as ActivityWithEligibility[] | null) ?? []

  return (
    <>
      {/* Hero — matches homepage colour scheme */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {school.name} Activities
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Current <span className="text-primary">Activities</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            All current activities available for payment. Parents can{' '}
            <Link href="/login" className="text-primary hover:underline">
              sign in
            </Link>{' '}
            for a personalised view, or{' '}
            <Link href="/guest-payment" className="text-primary hover:underline">
              pay as a guest
            </Link>{' '}
            using your child&apos;s pupil payment code.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {activities.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-16 text-center">
            <p className="text-text-muted">No activities are available at the moment.</p>
            <p className="mt-1 text-sm text-text-muted">Check back soon or contact the school.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const classNames = activity.activity_class_eligibility
                .slice()
                .sort((a, b) => (a.classes?.display_order ?? 0) - (b.classes?.display_order ?? 0))
                .map((e) => e.classes?.name)
                .filter(Boolean)

              return (
                <div
                  key={activity.id}
                  className="rounded-2xl border border-border bg-surface p-6 transition-all hover:border-primary/30"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">{activity.name}</h2>
                    <span className="shrink-0 text-xl font-bold text-primary">
                      {formatCurrency(activity.amount_cents)}
                    </span>
                  </div>

                  {activity.description && (
                    <p className="mb-3 text-sm text-text-secondary">{activity.description}</p>
                  )}

                  {classNames.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
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

                  {activity.closes_at && (
                    <p className="mb-4 text-xs text-text-muted">
                      Payment deadline: {formatDate(activity.closes_at, true)}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/login?next=/parent/activities`}
                      className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
                    >
                      Sign in to pay
                    </Link>
                    <Link
                      href={`/guest-payment?activityId=${activity.id}`}
                      className="inline-flex items-center rounded-xl border border-border bg-surface-raised px-5 py-2.5 text-sm font-semibold text-text-primary transition-all hover:border-primary/30 hover:text-primary"
                    >
                      Pay as guest
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
