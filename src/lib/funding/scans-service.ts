import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { awardExpiryStatus, readinessDriftDue } from './scans'
import { CURRENT_PROGRAMME_YEAR } from './rules'

// Daily time-based proactive scans (addendum §9): raise deduped hive_action_items for
// NCS awards approaching/after expiry and for Programme Readiness items that are still
// incomplete as their due date nears. Tenant-safe + idempotent (live-dedupe index).
// Reuses the pure helpers in scans.ts; never carries PPSN/CHICK in action text.

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Insert a deduped action; a unique-index collision (live duplicate) counts as handled. */
async function raise(db: AdminClient, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await db.from('hive_action_items').insert(row)
  if (error && !/duplicate key|unique/i.test(error.message)) {
    logger.error('funding_scan_insert_failed', {
      schoolId: row.school_id,
      dedupeKey: row.dedupe_key,
      error: error.message,
    })
    return false
  }
  return !error
}

export interface ScanSummary {
  schoolId: string
  awardActions: number
  readinessActions: number
}

/** Run both proactive scans for one school. */
export async function runFundingScansForSchool(schoolId: string): Promise<ScanSummary> {
  const db = createSupabaseAdminClient()
  const today = todayISO()
  let awardActions = 0
  let readinessActions = 0

  // ── NCS award / CHICK expiry ────────────────────────────────────────────────
  const { data: regData } = await db
    .from('child_funding_registrations')
    .select('student_id, ncs_award_expiry, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('scheme', 'NCS')
    .eq('status', 'ACTIVE')
    .not('ncs_award_expiry', 'is', null)
  const regs =
    (regData as unknown as
      | {
          student_id: string
          ncs_award_expiry: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  for (const r of regs) {
    const status = awardExpiryStatus(r.ncs_award_expiry, today)
    if (status === 'NONE') continue
    const name =
      [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || 'A child'
    const expired = status === 'EXPIRED'
    const ok = await raise(db, {
      school_id: schoolId,
      programme: 'NCS',
      action_type: 'NCS_AWARD_EXPIRY',
      entity_type: 'child',
      entity_id: r.student_id,
      severity: expired ? 'URGENT' : 'ACTION',
      status: 'OPEN',
      reason_code: status,
      description: expired
        ? `${name}'s NCS award expired on ${fmtDate(r.ncs_award_expiry)}. Confirm the renewal before continuing to claim.`
        : `${name}'s NCS award expires on ${fmtDate(r.ncs_award_expiry)}. Arrange the renewal to avoid a funding gap.`,
      // New expiry date ⇒ new action; a re-scan before renewal re-uses the live one.
      dedupe_key: `ncs:NCS_AWARD_EXPIRY:${r.student_id}:${r.ncs_award_expiry}`,
    })
    if (ok) awardActions++
  }

  // ── Programme Readiness drift ───────────────────────────────────────────────
  const { data: itemData } = await db
    .from('funding_readiness_items')
    .select('id, label, status, due_date')
    .eq('school_id', schoolId)
    .eq('programme_year', CURRENT_PROGRAMME_YEAR)
    .in('status', ['MISSING', 'REVIEW_REQUIRED'])
    .not('due_date', 'is', null)
  const items =
    (itemData as { id: string; label: string; status: string; due_date: string }[] | null) ?? []
  for (const it of items) {
    if (!readinessDriftDue(it.status, it.due_date, today)) continue
    const stateLabel = it.status === 'MISSING' ? 'missing' : 'flagged for review'
    const ok = await raise(db, {
      school_id: schoolId,
      programme: 'ECCE',
      action_type: 'PROGRAMME_READINESS_DRIFT',
      entity_type: 'readiness_item',
      entity_id: it.id,
      severity: 'ACTION',
      status: 'OPEN',
      reason_code: it.status,
      description: `Programme Readiness item "${it.label}" is ${stateLabel} and due ${fmtDate(it.due_date)}. Complete it before the programme-year deadline.`,
      dedupe_key: `ecce:PROGRAMME_READINESS_DRIFT:${it.id}`,
    })
    if (ok) readinessActions++
  }

  logger.info('funding_scans_built', { schoolId, awardActions, readinessActions })
  return { schoolId, awardActions, readinessActions }
}

/** Run the proactive scans for every tenant with the Funding & Hive Centre enabled. */
export async function runFundingScansForEnabledTenants(): Promise<{
  tenants: number
  summaries: ScanSummary[]
}> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('tenant_funding_settings')
    .select('school_id')
    .eq('hive_centre_enabled', true)
  const schoolIds = ((data as { school_id: string }[] | null) ?? []).map((r) => r.school_id)

  const summaries: ScanSummary[] = []
  for (const schoolId of schoolIds) {
    try {
      summaries.push(await runFundingScansForSchool(schoolId))
    } catch (err) {
      logger.error('funding_scans_tenant_failed', {
        schoolId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
  return { tenants: schoolIds.length, summaries }
}
