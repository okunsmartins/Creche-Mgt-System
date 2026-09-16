import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { hasProAccess } from '@/lib/subscriptions/access'
import type { SubscriptionPlan, SubscriptionStatus } from '@/types/database'

export interface SchoolOverviewRow {
  id: string
  name: string
  subdomain: string | null
  createdAt: string
  plan: SubscriptionPlan | 'none'
  status: SubscriptionStatus | 'none'
  /** Currently has Pro access (active / trialing / past-due-in-grace). */
  hasAccess: boolean
  smsEnabled: boolean
  /** Trial end date (ISO), or null when not trialing / no subscription. */
  trialEndsAt: string | null
  /** Active students in this school. */
  studentsCount: number
  /** All-time collected (paid − refunded), in cents. */
  collectedCents: number
  /** Whether the school is active (false = deactivated / soft-deleted). */
  isActive: boolean
}

export interface SchoolsOverview {
  schools: SchoolOverviewRow[]
  total: number
  /** Schools with current paid/trial access. */
  withAccess: number
  smsSchools: number
}

type SubRow = {
  school_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_end: string | null
  trial_ends_at: string | null
  sms_enabled: boolean
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/** Active students per school id. Filtered by is_active (satisfies tenant-scope rule). */
async function studentsCountBySchool(adminClient: AdminClient): Promise<Map<string, number>> {
  const { data } = await adminClient.from('students').select('school_id').eq('is_active', true)
  const m = new Map<string, number>()
  for (const s of (data as { school_id: string }[] | null) ?? []) {
    m.set(s.school_id, (m.get(s.school_id) ?? 0) + 1)
  }
  return m
}

/**
 * All-time collected (paid − refunded) per school id. Reads paid payments first,
 * then resolves their orders' school via `.in('id', …)` — both filtered, so the
 * tenant-scope rule passes without a cross-tenant escape hatch.
 */
async function collectedCentsBySchool(adminClient: AdminClient): Promise<Map<string, number>> {
  const { data: pays } = await adminClient
    .from('payments')
    .select('order_id, amount_cents, refunded_amount_cents')
    .in('status', ['paid', 'partially_refunded'])
  const payRows =
    (pays as { order_id: string; amount_cents: number; refunded_amount_cents: number }[] | null) ??
    []
  if (payRows.length === 0) return new Map()

  const orderIds = [...new Set(payRows.map((p) => p.order_id))]
  const { data: orders } = await adminClient
    .from('orders')
    .select('id, school_id')
    .in('id', orderIds)
  const orderSchool = new Map(
    ((orders as { id: string; school_id: string }[] | null) ?? []).map((o) => [o.id, o.school_id]),
  )

  const m = new Map<string, number>()
  for (const p of payRows) {
    const sid = orderSchool.get(p.order_id)
    if (!sid) continue
    m.set(sid, (m.get(sid) ?? 0) + (p.amount_cents - (p.refunded_amount_cents ?? 0)))
  }
  return m
}

/**
 * All schools with subscription state + per-school students and revenue — the
 * platform-owner overview. Deliberately spans every tenant, so it must only be
 * reached behind an `isPlatformOwner` check.
 *
 * By default returns only active schools (the counts drive the owner dashboard).
 * Pass `{ includeInactive: true }` to also list deactivated/soft-deleted schools
 * (for the Schools management table), each carrying `isActive`.
 */
export async function getSchoolsOverview(
  options: { includeInactive?: boolean } = {},
): Promise<SchoolsOverview> {
  const adminClient = createSupabaseAdminClient()

  let query = adminClient.from('schools').select('id, name, subdomain, created_at, is_active')
  if (!options.includeInactive) query = query.eq('is_active', true)
  const { data: schoolData } = await query.order('created_at', { ascending: false })
  const schools =
    (schoolData as
      | {
          id: string
          name: string
          subdomain: string | null
          created_at: string
          is_active: boolean
        }[]
      | null) ?? []
  if (schools.length === 0) return { schools: [], total: 0, withAccess: 0, smsSchools: 0 }

  const ids = schools.map((s) => s.id)
  const [{ data: subData }, studentsMap, collectedMap] = await Promise.all([
    adminClient
      .from('subscriptions')
      .select('school_id, plan, status, current_period_end, trial_ends_at, sms_enabled')
      .in('school_id', ids),
    studentsCountBySchool(adminClient),
    collectedCentsBySchool(adminClient),
  ])
  const subs = new Map<string, SubRow>()
  for (const s of (subData as SubRow[] | null) ?? []) subs.set(s.school_id, s)

  const rows: SchoolOverviewRow[] = schools.map((s) => {
    const sub = subs.get(s.id) ?? null
    const hasAccess = hasProAccess(
      sub
        ? {
            plan: sub.plan,
            status: sub.status,
            current_period_end: sub.current_period_end,
            trial_ends_at: sub.trial_ends_at,
          }
        : null,
    )
    return {
      id: s.id,
      name: s.name,
      subdomain: s.subdomain,
      createdAt: s.created_at,
      plan: sub?.plan ?? 'none',
      status: sub?.status ?? 'none',
      hasAccess,
      smsEnabled: Boolean(sub?.sms_enabled),
      trialEndsAt: sub?.trial_ends_at ?? null,
      studentsCount: studentsMap.get(s.id) ?? 0,
      collectedCents: collectedMap.get(s.id) ?? 0,
      isActive: s.is_active,
    }
  })

  return {
    schools: rows,
    total: rows.length,
    withAccess: rows.filter((r) => r.hasAccess).length,
    smsSchools: rows.filter((r) => r.smsEnabled).length,
  }
}
