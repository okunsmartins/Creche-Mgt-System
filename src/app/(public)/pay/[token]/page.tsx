import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { GuestPaymentForm } from '@/components/orders/GuestPaymentForm'
import { incrementPaymentLinkVisitCount } from '@/lib/payment-links/actions'
import type { ActivityRow, ClassRow, PaymentLinkRow } from '@/types/database'

export const metadata: Metadata = { title: 'Pay' }

type ClassOption = Pick<ClassRow, 'id' | 'name'>

export default async function PayByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Validate token is hex (basic sanity check to avoid unnecessary DB round-trips)
  if (!/^[0-9a-f]{64}$/.test(token)) notFound()

  const adminClient = createSupabaseAdminClient()

  // Resolve the payment link from the TOKEN alone, then take the crèche FROM the
  // link. The token is a 64-char unguessable secret, so scoping the lookup by the
  // request's tenant added no security — it only meant a link could not be opened
  // from another school's host (and, with no default school, could not be opened
  // at all on the apex). Admin client bypasses RLS, so every condition is
  // validated below.
  const { data: linkData } = await adminClient
    .from('payment_links')
    .select(
      'id, activity_id, label, opens_at, expires_at, max_uses, use_count, is_active, school_id',
    )
    .eq('public_token', token)
    .maybeSingle()

  if (!linkData) notFound()

  const link = linkData as Pick<
    PaymentLinkRow,
    | 'id'
    | 'activity_id'
    | 'label'
    | 'opens_at'
    | 'expires_at'
    | 'max_uses'
    | 'use_count'
    | 'is_active'
    | 'school_id'
  >
  const schoolId = link.school_id

  // Validate active/opens_at/expiry/uses server-side (admin client bypasses RLS)
  if (!link.is_active) notFound()
  if (link.opens_at && new Date(link.opens_at) > new Date()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Not yet available</h1>
        <p className="mb-6 text-text-secondary">This payment link is not yet open.</p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Link expired</h1>
        <p className="mb-6 text-text-secondary">This payment link has expired.</p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }
  if (link.max_uses != null && link.use_count >= link.max_uses) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Link no longer available</h1>
        <p className="mb-6 text-text-secondary">
          This payment link has reached its maximum number of uses.
        </p>
        <Link href="/activities" className="text-primary hover:underline">
          View all activities
        </Link>
      </div>
    )
  }

  // Fetch the activity — must be published, active, and in this school
  const { data: activityData } = await adminClient
    .from('activities')
    .select('id, name, amount_cents, publication_status, is_active, opens_at, closes_at')
    .eq('id', link.activity_id)
    .eq('school_id', schoolId)
    .single()

  if (
    !activityData ||
    (activityData as Pick<ActivityRow, 'publication_status' | 'is_active'>).publication_status !==
      'published' ||
    !(activityData as Pick<ActivityRow, 'is_active'>).is_active
  ) {
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

  const activity = activityData as Pick<
    ActivityRow,
    'id' | 'name' | 'amount_cents' | 'opens_at' | 'closes_at'
  >

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

  // Fetch active classes
  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')

  const classes: ClassOption[] = (
    (classData as (ClassOption & { display_order: number })[] | null) ?? []
  ).map((c) => ({ id: c.id, name: c.name }))

  // Count this valid page view. The function never throws, so errors are logged and the render is unaffected.
  await incrementPaymentLinkVisitCount(link.id)

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Pay for {activity.name}</h1>
        {link.label && <p className="mt-1 text-sm text-text-muted">{link.label}</p>}
        <p className="mt-2 text-sm text-text-secondary">
          No account needed. You will receive an email receipt when payment is complete.{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          for a faster experience.
        </p>
      </div>

      <div className="card p-6">
        {/* paymentLinkId is passed as a hidden field via GuestPaymentForm so the order action can record it */}
        <GuestPaymentForm
          activityId={activity.id}
          activityName={activity.name}
          amountCents={activity.amount_cents}
          classes={classes}
          paymentLinkId={link.id}
        />
      </div>
    </div>
  )
}
