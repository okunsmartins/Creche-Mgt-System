import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  ActivityAttendeesClient,
  type AttendeeRow,
} from '@/components/email/ActivityAttendeesClient'

export const metadata: Metadata = { title: 'Programme Enrolments' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProgrammeEnrolmentsPage({ params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school associated with your account.</p>
  }

  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  // Verify programme belongs to this school
  const { data: programme } = await adminClient
    .from('programmes')
    .select('id, name, publication_status')
    .eq('id', id)
    .eq('school_id', admin.schoolId)
    .single()

  if (!programme) notFound()

  // Fetch order items for this programme
  const { data: rawItems } = await adminClient
    .from('order_items')
    .select(
      'id, student_name_snapshot, class_name_snapshot, item_reference, verification_status, order_id',
    )
    .eq('programme_id', id)
    .order('class_name_snapshot')
    .order('student_name_snapshot')

  const items = (rawItems ?? []) as {
    id: string
    student_name_snapshot: string
    class_name_snapshot: string
    item_reference: string
    verification_status: string
    order_id: string
  }[]

  // Fetch orders for those items — scoped to this school
  const orderIds = [...new Set(items.map((i) => i.order_id))]
  const ordersResult =
    orderIds.length > 0
      ? await adminClient
          .from('orders')
          .select('id, status, payer_profile_id, guest_payer_name, guest_payer_email')
          .in('id', orderIds)
          .eq('school_id', admin.schoolId)
      : { data: [] }

  const orders = ordersResult.data ?? []
  const orderMap = new Map(orders.map((o) => [o.id, o]))

  // Fetch profiles for registered payers
  const profileIds = orders
    .filter((o) => o.payer_profile_id)
    .map((o) => o.payer_profile_id as string)

  const profilesResult =
    profileIds.length > 0
      ? await adminClient
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', profileIds)
      : { data: [] }

  const profiles = profilesResult.data ?? []
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  // Build attendee rows
  const attendees: AttendeeRow[] = items.map((item) => {
    const order = orderMap.get(item.order_id)
    const profile = order?.payer_profile_id ? profileMap.get(order.payer_profile_id) : null

    const payerName = profile
      ? `${profile.first_name} ${profile.last_name}`
      : (order?.guest_payer_name ?? '—')
    const payerEmail = profile?.email ?? order?.guest_payer_email ?? null

    return {
      id: item.id,
      student_name: item.student_name_snapshot,
      class_name: item.class_name_snapshot,
      item_reference: item.item_reference,
      verification_status: item.verification_status,
      order_status: order?.status ?? 'unknown',
      payer_name: payerName,
      payer_email: payerEmail,
    }
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/programmes" className="hover:text-primary hover:underline">
          Programmes
        </Link>
        {' / '}
        <Link href={`/admin/programmes/${id}`} className="hover:text-primary hover:underline">
          {programme.name}
        </Link>
        {' / '}
        <span className="text-text-primary">Enrolments</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Enrolments</h1>
        <p className="mt-1 text-sm text-text-muted">
          {programme.name} — enrolled children and their parent contact details.
        </p>
      </div>

      <ActivityAttendeesClient
        activityId={id}
        activityName={programme.name}
        attendees={attendees}
      />
    </div>
  )
}
