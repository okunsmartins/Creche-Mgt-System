import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  CollectionPanel,
  type MethodRow,
  type RunRow,
  type StaffOption,
} from '@/components/collection/CollectionPanel'

export const metadata: Metadata = { title: 'School Collection' }

export default async function CollectionPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const [{ data: methodData }, { data: runData }, { data: staffLinkData }, { data: teacherData }] =
    await Promise.all([
      db
        .from('collection_methods')
        .select('id, label, has_transport, is_active')
        .eq('school_id', admin.schoolId)
        .order('display_order'),
      db
        .from('collection_runs')
        .select(
          'id, name, origin_school_name, collection_method_id, days_of_week, pickup_time, capacity, children_per_chaperone, charge_basis, price_cents, is_active, collection_methods(label)',
        )
        .eq('school_id', admin.schoolId)
        .order('created_at', { ascending: false }),
      db
        .from('collection_run_staff')
        .select('collection_run_id, teacher_id')
        .eq('school_id', admin.schoolId),
      db
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true)
        .order('last_name'),
    ])

  const staffByRun = new Map<string, string[]>()
  for (const s of (staffLinkData ?? []) as { collection_run_id: string; teacher_id: string }[]) {
    const arr = staffByRun.get(s.collection_run_id) ?? []
    arr.push(s.teacher_id)
    staffByRun.set(s.collection_run_id, arr)
  }

  const methods: MethodRow[] = ((methodData ?? []) as MethodRow[]).map((m) => ({
    id: m.id,
    label: m.label,
    has_transport: m.has_transport,
    is_active: m.is_active,
  }))

  const runs: RunRow[] = (
    (runData ?? []) as unknown as {
      id: string
      name: string
      origin_school_name: string
      collection_method_id: string | null
      days_of_week: number[] | null
      pickup_time: string | null
      capacity: number
      children_per_chaperone: number
      charge_basis: string
      price_cents: number
      is_active: boolean
      collection_methods: { label: string } | null
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    originSchoolName: r.origin_school_name,
    methodLabel: r.collection_methods?.label ?? null,
    days: r.days_of_week ?? [],
    pickupTime: r.pickup_time,
    capacity: r.capacity,
    childrenPerChaperone: r.children_per_chaperone,
    chargeBasis: r.charge_basis,
    priceCents: r.price_cents,
    staffIds: staffByRun.get(r.id) ?? [],
  }))

  const staff: StaffOption[] = ((teacherData ?? []) as StaffOption[]).map((t) => ({
    id: t.id,
    first_name: t.first_name,
    last_name: t.last_name,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">School collection</h1>
        <p className="mt-1 text-sm text-text-muted">
          Set up the collection methods and school runs your crèche offers. {runs.length} run
          {runs.length === 1 ? '' : 's'}.
        </p>
      </div>
      <CollectionPanel methods={methods} runs={runs} staff={staff} />
    </div>
  )
}
