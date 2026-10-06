import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { diffCoreProfiles, type CoreProfile, type ProfileChange } from './core-funding'

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

export interface NcsReturnRow {
  studentId: string
  childName: string
  claimedMinutes: number
  actualMinutes: number
  monitoringMinutes: number
  underAttended: boolean
  fullWeekAbsent: boolean
  consecutiveUnderWeeks: number
  consecutiveAbsenceWeeks: number
  thresholdEvent: string
  riskState: string
  calculationVersion: string
}

export interface NcsWeeklyReturn {
  weekStart: string
  reviewRequired: NcsReturnRow[]
  noActionCount: number
  total: number
  calculationVersion: string | null
}

/** The prepared NCS weekly return for one reporting week (exception list + counts). */
export async function getNcsWeeklyReturn(
  schoolId: string,
  weekStart: string,
): Promise<NcsWeeklyReturn> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select(
      'student_id, claimed_minutes, actual_attendance_minutes, ncs_monitoring_minutes, under_attended, full_week_absent, consecutive_under_attendance_weeks, consecutive_absence_weeks, threshold_event, risk_state, calculation_version, students(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .eq('week_start', weekStart)
  const rows =
    (data as unknown as
      | {
          student_id: string
          claimed_minutes: number
          actual_attendance_minutes: number
          ncs_monitoring_minutes: number
          under_attended: boolean
          full_week_absent: boolean
          consecutive_under_attendance_weeks: number
          consecutive_absence_weeks: number
          threshold_event: string
          risk_state: string
          calculation_version: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []

  const mapped: NcsReturnRow[] = rows.map((r) => ({
    studentId: r.student_id,
    childName: [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    claimedMinutes: r.claimed_minutes,
    actualMinutes: r.actual_attendance_minutes,
    monitoringMinutes: r.ncs_monitoring_minutes,
    underAttended: r.under_attended,
    fullWeekAbsent: r.full_week_absent,
    consecutiveUnderWeeks: r.consecutive_under_attendance_weeks,
    consecutiveAbsenceWeeks: r.consecutive_absence_weeks,
    thresholdEvent: r.threshold_event,
    riskState: r.risk_state,
    calculationVersion: r.calculation_version,
  }))

  const reviewRequired = mapped
    .filter((r) => r.thresholdEvent !== 'NONE' || r.riskState !== 'NONE')
    .sort((a, b) => b.consecutiveUnderWeeks - a.consecutiveUnderWeeks)

  return {
    weekStart,
    reviewRequired,
    noActionCount: mapped.length - reviewRequired.length,
    total: mapped.length,
    calculationVersion: mapped[0]?.calculationVersion ?? null,
  }
}

export interface NcsChildOption {
  id: string
  name: string
}

/** Active NCS children (for the claim composer). */
export async function getNcsChildOptions(schoolId: string): Promise<NcsChildOption[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('child_funding_registrations')
    .select('student_id, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('scheme', 'NCS')
    .eq('status', 'ACTIVE')
  const rows =
    (data as unknown as
      | {
          student_id: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  // De-duplicate by student (a child could in theory have >1 active row).
  const seen = new Map<string, string>()
  for (const r of rows) {
    if (!seen.has(r.student_id))
      seen.set(
        r.student_id,
        [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') ||
          'Unnamed child',
      )
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
}

export interface ClaimView {
  id: string
  studentId: string
  childName: string
  status: string
  startDate: string
  endDate: string | null
  termMinutes: number
  nonTermMinutes: number
  weeklyFeeCents: number | null
  ncsSubsidyCents: number
  ecceSubsidyCents: number
  discountCents: number
  calculatedCopaymentCents: number | null
  overrideCents: number | null
  overrideReason: string | null
}

/** All NCS claim versions for a school, newest first. */
export async function getClaimsForSchool(schoolId: string): Promise<ClaimView[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_claim_versions')
    .select(
      'id, student_id, status, start_date, end_date, term_minutes, non_term_minutes, weekly_fee_cents, ncs_subsidy_cents, ecce_subsidy_cents, discount_cents, calculated_copayment_cents, manual_override_cents, override_reason, students(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  const rows =
    (data as unknown as
      | {
          id: string
          student_id: string
          status: string
          start_date: string
          end_date: string | null
          term_minutes: number
          non_term_minutes: number
          weekly_fee_cents: number | null
          ncs_subsidy_cents: number
          ecce_subsidy_cents: number
          discount_cents: number
          calculated_copayment_cents: number | null
          manual_override_cents: number | null
          override_reason: string | null
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    childName: [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    termMinutes: r.term_minutes,
    nonTermMinutes: r.non_term_minutes,
    weeklyFeeCents: r.weekly_fee_cents,
    ncsSubsidyCents: r.ncs_subsidy_cents,
    ecceSubsidyCents: r.ecce_subsidy_cents,
    discountCents: r.discount_cents,
    calculatedCopaymentCents: r.calculated_copayment_cents,
    overrideCents: r.manual_override_cents,
    overrideReason: r.override_reason,
  }))
}

export interface EcceRegistrationView {
  id: string
  studentId: string
  childName: string
  ppsnPresent: boolean
  session: string | null
  aimLevel7: boolean
  startDateSet: boolean
  preparedAt: string | null
  submittedAt: string | null
}

/** ECCE registrations for a school (PPSN presence only — never the value). */
export async function getEcceRegistrations(schoolId: string): Promise<EcceRegistrationView[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('child_funding_registrations')
    .select(
      'id, student_id, pps_number_encrypted, ecce_session, aim_level_7, start_date, ecce_registration_prepared_at, ecce_registration_submitted_at, students(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .eq('scheme', 'ECCE')
    .order('created_at', { ascending: false })
  const rows =
    (data as unknown as
      | {
          id: string
          student_id: string
          pps_number_encrypted: string | null
          ecce_session: string | null
          aim_level_7: boolean
          start_date: string | null
          ecce_registration_prepared_at: string | null
          ecce_registration_submitted_at: string | null
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    childName: [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    ppsnPresent: !!r.pps_number_encrypted,
    session: r.ecce_session,
    aimLevel7: r.aim_level_7,
    startDateSet: !!r.start_date,
    preparedAt: r.ecce_registration_prepared_at,
    submittedAt: r.ecce_registration_submitted_at,
  }))
}

export interface ReadinessItemView {
  id: string
  itemKey: string
  label: string
  category: string | null
  status: string
  dueDate: string | null
  notes: string | null
}

/** Programme Readiness checklist items for a school + year (empty until seeded). */
export async function getReadinessItems(
  schoolId: string,
  programmeYear: string,
): Promise<ReadinessItemView[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('funding_readiness_items')
    .select('id, item_key, label, category, status, due_date, notes')
    .eq('school_id', schoolId)
    .eq('programme_year', programmeYear)
    .order('category')
  return (
    (data as
      | {
          id: string
          item_key: string
          label: string
          category: string | null
          status: string
          due_date: string | null
          notes: string | null
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    itemKey: r.item_key,
    label: r.label,
    category: r.category,
    status: r.status,
    dueDate: r.due_date,
    notes: r.notes,
  }))
}

export interface CoreFundingView {
  programmeYear: string
  snapshot: CoreProfile | null
  snapshotCapturedAt: string | null
  current: CoreProfile
  changes: ProfileChange[]
}

/**
 * Core Funding shadow view: the last verified snapshot vs the current live profile.
 * staffCount (active teachers) and roomCount (active classes) are derived live;
 * totalCapacity and operatingWeeks are carried from the snapshot (manager-maintained,
 * since Creche Wise doesn't model room capacity), so drift auto-detects staff/room
 * changes — the spec's headline Core Funding signals.
 */
export async function getCoreFundingView(
  schoolId: string,
  programmeYear: string,
): Promise<CoreFundingView> {
  const db = createSupabaseAdminClient()

  const [{ count: staffCount }, { count: roomCount }, { data: snapRow }] = await Promise.all([
    db
      .from('teachers')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db
      .from('core_funding_snapshots')
      .select('profile, created_at')
      .eq('school_id', schoolId)
      .eq('programme_year', programmeYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const snap = snapRow as { profile: CoreProfile; created_at: string } | null
  const snapshot = snap?.profile ?? null
  const current: CoreProfile = {
    staffCount: staffCount ?? 0,
    roomCount: roomCount ?? 0,
    totalCapacity: snapshot?.totalCapacity ?? 0,
    operatingWeeks: snapshot?.operatingWeeks ?? 0,
  }
  const changes = snapshot ? diffCoreProfiles(snapshot, current) : []
  return {
    programmeYear,
    snapshot,
    snapshotCapturedAt: snap?.created_at ?? null,
    current,
    changes,
  }
}

// ── AIM (restricted domain — Phase 5) ──────────────────────────────────────────
export interface AimCaseView {
  id: string
  studentId: string
  childName: string
  aimLevel: number | null
  status: string
  consentStatus: string
  consentRecordedAt: string | null
  supportSummary: string | null
  submittedAt: string | null
  updatedAt: string
}

/**
 * AIM cases for a school. Returns only the restricted case fields + the child's name —
 * NO PPSN/CHICK and no health/developmental data. Callers must already hold
 * funding.manage_aim (enforced by requireFundingAimAdmin at the page/action layer).
 */
export async function getAimCases(schoolId: string): Promise<AimCaseView[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('aim_cases')
    .select(
      'id, student_id, aim_level, status, consent_status, consent_recorded_at, support_summary, submitted_at, updated_at, students(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .order('updated_at', { ascending: false })
  const rows =
    (data as unknown as
      | {
          id: string
          student_id: string
          aim_level: number | null
          status: string
          consent_status: string
          consent_recorded_at: string | null
          support_summary: string | null
          submitted_at: string | null
          updated_at: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    childName: [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    aimLevel: r.aim_level,
    status: r.status,
    consentStatus: r.consent_status,
    consentRecordedAt: r.consent_recorded_at,
    supportSummary: r.support_summary,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  }))
}

/** Active children who don't yet have an AIM case (for the AIM case composer). */
export async function getAimChildOptions(schoolId: string): Promise<NcsChildOption[]> {
  const db = createSupabaseAdminClient()
  const [{ data: students }, { data: cases }] = await Promise.all([
    db
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db.from('aim_cases').select('student_id').eq('school_id', schoolId),
  ])
  const taken = new Set(((cases as { student_id: string }[] | null) ?? []).map((c) => c.student_id))
  const rows =
    (students as { id: string; first_name: string | null; last_name: string | null }[] | null) ?? []
  return rows
    .filter((r) => !taken.has(r.id))
    .map((r) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unnamed child',
    }))
}

// ── Child-profile funding summary (read-only, non-sensitive) ───────────────────
export interface ChildFundingSummary {
  registrations: {
    scheme: string
    status: string
    ncsAwardExpiry: string | null
    ecceSession: string | null
    ppsnPresent: boolean
  }[]
  latestWeekly: {
    weekStart: string
    underAttended: boolean
    thresholdEvent: string
    consecutiveUnderWeeks: number
  } | null
  openActions: { id: string; severity: string; description: string }[]
  latestClaim: { status: string; copaymentCents: number | null } | null
}

/**
 * Funding summary for one child, for the admin child-profile panel. Read-only and
 * non-sensitive: PPSN is presence-only (never the value), CHICK is not surfaced, and
 * AIM is deliberately excluded (it lives behind its own restricted permission).
 */
export async function getChildFundingSummary(
  schoolId: string,
  studentId: string,
): Promise<ChildFundingSummary> {
  const db = createSupabaseAdminClient()
  const [{ data: regData }, { data: weekData }, { data: actionData }, { data: claimData }] =
    await Promise.all([
      db
        .from('child_funding_registrations')
        .select('scheme, status, ncs_award_expiry, ecce_session, pps_number_encrypted')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      db
        .from('ncs_weekly_compliance_snapshots')
        .select('week_start, under_attended, threshold_event, consecutive_under_attendance_weeks')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('hive_action_items')
        .select('id, severity, description')
        .eq('school_id', schoolId)
        .eq('entity_id', studentId)
        .in('status', ['OPEN', 'IN_REVIEW'])
        .order('created_at', { ascending: false }),
      db
        .from('ncs_claim_versions')
        .select('status, calculated_copayment_cents, manual_override_cents')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .neq('status', 'SUPERSEDED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const regs =
    (regData as
      | {
          scheme: string
          status: string
          ncs_award_expiry: string | null
          ecce_session: string | null
          pps_number_encrypted: string | null
        }[]
      | null) ?? []
  const week = weekData as {
    week_start: string
    under_attended: boolean
    threshold_event: string
    consecutive_under_attendance_weeks: number
  } | null
  const claim = claimData as {
    status: string
    calculated_copayment_cents: number | null
    manual_override_cents: number | null
  } | null

  return {
    registrations: regs.map((r) => ({
      scheme: r.scheme,
      status: r.status,
      ncsAwardExpiry: r.ncs_award_expiry,
      ecceSession: r.ecce_session,
      ppsnPresent: !!r.pps_number_encrypted,
    })),
    latestWeekly: week
      ? {
          weekStart: week.week_start,
          underAttended: week.under_attended,
          thresholdEvent: week.threshold_event,
          consecutiveUnderWeeks: week.consecutive_under_attendance_weeks,
        }
      : null,
    openActions:
      (actionData as { id: string; severity: string; description: string }[] | null) ?? [],
    latestClaim: claim
      ? {
          status: claim.status,
          copaymentCents: claim.manual_override_cents ?? claim.calculated_copayment_cents,
        }
      : null,
  }
}

// ── Submission snapshots / evidence packs ──────────────────────────────────────
export interface SubmissionSnapshotView {
  id: string
  kind: string
  reference: string
  status: string
  itemCount: number
  rulesVersion: string | null
  preparedAt: string
  submittedAt: string | null
  submissionReference: string | null
}

/** Submission snapshots for a school, newest first (non-sensitive metadata only). */
export async function getSubmissionSnapshots(schoolId: string): Promise<SubmissionSnapshotView[]> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('funding_submission_snapshots')
    .select(
      'id, kind, reference, status, item_count, rules_version, prepared_at, submitted_at, submission_reference',
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(100)
  const rows =
    (data as
      | {
          id: string
          kind: string
          reference: string
          status: string
          item_count: number
          rules_version: string | null
          prepared_at: string
          submitted_at: string | null
          submission_reference: string | null
        }[]
      | null) ?? []
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    reference: r.reference,
    status: r.status,
    itemCount: r.item_count,
    rulesVersion: r.rules_version,
    preparedAt: r.prepared_at,
    submittedAt: r.submitted_at,
    submissionReference: r.submission_reference,
  }))
}
