import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getViewerSchool } from '@/lib/tenant/server'
import { FindYourSchool } from '@/components/tenant/FindYourSchool'
import { GuestPaymentForm } from '@/components/orders/GuestPaymentForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ActivityRow, ActivityClassEligibilityRow, ClassRow } from '@/types/database'

export const metadata: Metadata = { title: 'Pay as Guest' }

type ActivityDetail = Pick<
  ActivityRow,
  'id' | 'name' | 'amount_cents' | 'publication_status' | 'is_active' | 'opens_at' | 'closes_at'
>

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>

export default async function GuestPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ activityId?: string }>
}) {
  const { activityId } = await searchParams
  const adminClient = createSupabaseAdminClient()
  const school = await getViewerSchool()
  // No tenant and nobody signed in → ask which school rather than guessing.
  if (!school) return <FindYourSchool />
  const schoolId = school.id

  // No activityId — show landing page listing available activities
  if (!activityId) {
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

    type ActivityWithEligibility = Pick<
      ActivityRow,
      'id' | 'name' | 'description' | 'amount_cents' | 'opens_at' | 'closes_at'
    > & {
      activity_class_eligibility: (Pick<ActivityClassEligibilityRow, 'class_id'> & {
        classes: Pick<ClassRow, 'name' | 'display_order'> | null
      })[]
    }

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
              {school.name}
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Pay as a <span className="text-primary">guest</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
              Select an activity below to pay without creating an account. You will need your
              child&apos;s pupil payment code.{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>{' '}
              for a faster experience.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface py-16 text-center">
              <p className="text-text-muted">No activities are available at the moment.</p>
              <p className="mt-1 text-sm text-text-muted">Check back soon or contact the crèche.</p>
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
                    <Link
                      href={`/guest-payment?activityId=${activity.id}`}
                      className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
                    >
                      Pay as guest
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </>
    )
  }

  // Fetch the activity directly (admin client bypasses RLS for display purposes)
  // FR-ACT-005 enforcement happens inside createGuestCodeOrderAction / createGuestManualOrderAction
  const { data: activityData } = await adminClient
    .from('activities')
    .select('id, name, amount_cents, publication_status, is_active, opens_at, closes_at')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .single()

  // Demo fallback: if activityId matches a demo seed ID, synthesise the activity
  const DEMO_ACTIVITIES: Record<string, ActivityDetail> = {
    '00000000-0000-0000-0000-000000000101': {
      id: '00000000-0000-0000-0000-000000000101',
      name: 'Junior Infants School Tour – Dublin Zoo',
      amount_cents: 2500,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-09-12T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000102': {
      id: '00000000-0000-0000-0000-000000000102',
      name: 'Senior Infants School Tour – Tayto Park',
      amount_cents: 3000,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-09-19T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000103': {
      id: '00000000-0000-0000-0000-000000000103',
      name: 'First & Second Class – Swimming Lessons',
      amount_cents: 4500,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-09-05T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000104': {
      id: '00000000-0000-0000-0000-000000000104',
      name: 'Third & Fourth Class – Gaelic Football Blitz',
      amount_cents: 500,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-09-26T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000105': {
      id: '00000000-0000-0000-0000-000000000105',
      name: 'Fifth & Sixth Class – Science Week Workshop',
      amount_cents: 800,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-10-10T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000106': {
      id: '00000000-0000-0000-0000-000000000106',
      name: 'School Book Rental Scheme 2026–27',
      amount_cents: 5500,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-08-29T23:59:00Z',
    },
    '00000000-0000-0000-0000-000000000107': {
      id: '00000000-0000-0000-0000-000000000107',
      name: 'Whole School – Christmas Pantomime',
      amount_cents: 1500,
      publication_status: 'published',
      is_active: true,
      opens_at: null,
      closes_at: '2026-11-28T23:59:00Z',
    },
  }
  const DEMO_CLASSES = [
    { id: '1', name: 'Junior Infants' },
    { id: '2', name: 'Senior Infants' },
    { id: '3', name: 'First Class' },
    { id: '4', name: 'Second Class' },
    { id: '5', name: 'Third Class' },
    { id: '6', name: 'Fourth Class' },
    { id: '7', name: 'Fifth Class' },
    { id: '8', name: 'Sixth Class' },
  ]

  const isDemo = !activityData && activityId in DEMO_ACTIVITIES
  const activity = isDemo ? DEMO_ACTIVITIES[activityId]! : (activityData as ActivityDetail | null)

  if (!activity || activity.publication_status !== 'published' || !activity.is_active) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Activity not available</h1>
        <p className="mb-6 text-text-secondary">
          This activity is not currently accepting payments.
        </p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }

  // Check date availability for display (action also re-checks)
  const now = new Date()
  if (activity.opens_at && new Date(activity.opens_at) > now) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Not yet open</h1>
        <p className="mb-6 text-text-secondary">This activity has not opened for payment yet.</p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }
  if (activity.closes_at && new Date(activity.closes_at) <= now) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Payment deadline passed</h1>
        <p className="mb-6 text-text-secondary">
          The payment deadline for this activity has passed.
        </p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }

  // Fetch active classes for the manual entry dropdown
  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')

  const classes = isDemo
    ? DEMO_CLASSES
    : ((classData as ClassOption[] | null) ?? []).map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Pay as a guest</h1>
        <p className="mt-2 text-sm text-text-secondary">
          No account needed. You will receive an email receipt when payment is complete.{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          for a faster experience.
        </p>
      </div>

      {isDemo && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Demo mode</strong> — form is shown for preview only. Submission requires a live
          Supabase connection.
        </div>
      )}

      <div className="card p-6">
        <GuestPaymentForm
          activityId={activity.id}
          activityName={activity.name}
          amountCents={activity.amount_cents}
          classes={classes}
        />
      </div>
    </div>
  )
}
