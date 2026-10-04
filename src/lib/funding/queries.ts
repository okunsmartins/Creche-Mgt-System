import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export interface HiveActionView {
  id: string
  programme: string
  actionType: string
  severity: 'INFO' | 'ACTION' | 'URGENT'
  description: string | null
  dueAt: string | null
  status: string
  childName: string | null
}

export interface FundingDashboard {
  openActions: HiveActionView[]
  severityCounts: { URGENT: number; ACTION: number; INFO: number }
  latestWeek: { weekStart: string; total: number; review: number; clear: number } | null
}

const SEV_ORDER: Record<string, number> = { URGENT: 0, ACTION: 1, INFO: 2 }

/** Dashboard data for the Funding & Hive Centre (school-scoped). */
export async function getFundingDashboard(schoolId: string): Promise<FundingDashboard> {
  const db = createSupabaseAdminClient()

  // Live action queue (OPEN / IN_REVIEW), most severe + soonest-due first.
  const { data: actionData } = await db
    .from('hive_action_items')
    .select(
      'id, programme, action_type, severity, description, due_at, status, entity_type, entity_id',
    )
    .eq('school_id', schoolId)
    .in('status', ['OPEN', 'IN_REVIEW'])
  const actionRows =
    (actionData as
      | {
          id: string
          programme: string
          action_type: string
          severity: 'INFO' | 'ACTION' | 'URGENT'
          description: string | null
          due_at: string | null
          status: string
          entity_type: string | null
          entity_id: string | null
        }[]
      | null) ?? []

  // Resolve child names for child-entity actions.
  const childIds = [
    ...new Set(
      actionRows.filter((a) => a.entity_type === 'child' && a.entity_id).map((a) => a.entity_id!),
    ),
  ]
  const nameById = new Map<string, string>()
  if (childIds.length > 0) {
    const { data: students } = await db
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .in('id', childIds)
    for (const s of (students as
      | { id: string; first_name: string | null; last_name: string | null }[]
      | null) ?? []) {
      nameById.set(s.id, [s.first_name, s.last_name].filter(Boolean).join(' ') || '—')
    }
  }

  const openActions: HiveActionView[] = actionRows
    .map((a) => ({
      id: a.id,
      programme: a.programme,
      actionType: a.action_type,
      severity: a.severity,
      description: a.description,
      dueAt: a.due_at,
      status: a.status,
      childName:
        a.entity_type === 'child' && a.entity_id ? (nameById.get(a.entity_id) ?? null) : null,
    }))
    .sort((x, y) => {
      const s = (SEV_ORDER[x.severity] ?? 9) - (SEV_ORDER[y.severity] ?? 9)
      if (s !== 0) return s
      return (x.dueAt ?? '').localeCompare(y.dueAt ?? '')
    })

  const severityCounts = { URGENT: 0, ACTION: 0, INFO: 0 }
  for (const a of openActions) severityCounts[a.severity]++

  // Latest built reporting week summary.
  const { data: weekRow } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select('week_start')
    .eq('school_id', schoolId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latestWeekStart = (weekRow as { week_start: string } | null)?.week_start ?? null

  let latestWeek: FundingDashboard['latestWeek'] = null
  if (latestWeekStart) {
    const { data: snaps } = await db
      .from('ncs_weekly_compliance_snapshots')
      .select('threshold_event, risk_state')
      .eq('school_id', schoolId)
      .eq('week_start', latestWeekStart)
    const rows = (snaps as { threshold_event: string; risk_state: string }[] | null) ?? []
    const review = rows.filter(
      (r) => r.threshold_event !== 'NONE' || r.risk_state !== 'NONE',
    ).length
    latestWeek = {
      weekStart: latestWeekStart,
      total: rows.length,
      review,
      clear: rows.length - review,
    }
  }

  return { openActions, severityCounts, latestWeek }
}
