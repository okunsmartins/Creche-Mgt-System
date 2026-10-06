'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import type { AuditAction } from '@/types/database'
import { fundingEnabled } from './access'
import {
  canTransitionAim,
  validateAimReady,
  isAimConsentStatus,
  isAimLevel,
  isAimStatus,
  type AimConsentStatus,
  type AimStatus,
} from './aim'

export type AimActionResult = { ok: boolean; error?: string }

/** Admin + funding.manage_aim + tenant flag. AIM is the most restricted funding gate. */
async function gate(): Promise<{ user: SessionUser; schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes('funding.manage_aim'))
    return { error: 'You do not have permission to manage AIM.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { user, schoolId: user.schoolId }
}

async function audit(
  user: SessionUser,
  schoolId: string,
  action: AuditAction,
  caseId: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const db = createSupabaseAdminClient()
  const { error } = await db.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: user.id,
    actor_email: user.email,
    action,
    resource_type: 'aim_case',
    resource_id: caseId,
    metadata: metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('aim_audit_failed', { action, error: error.message })
}

interface AimCaseRow {
  id: string
  status: AimStatus
  consent_status: AimConsentStatus
  aim_level: number | null
  support_summary: string | null
}

/** Load a case scoped to the caller's school (verify-then-act). */
async function loadCase(schoolId: string, caseId: string): Promise<AimCaseRow | null> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('aim_cases')
    .select('id, status, consent_status, aim_level, support_summary')
    .eq('id', caseId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return (data as AimCaseRow | null) ?? null
}

/** Open a restricted AIM case for a child (status PREPARING). */
export async function createAimCaseAction(input: {
  studentId: string
  level?: number
}): Promise<AimActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  if (!input.studentId) return { ok: false, error: 'A child is required.' }
  if (input.level != null && !isAimLevel(input.level))
    return { ok: false, error: 'AIM level must be 1–7.' }

  const db = createSupabaseAdminClient()
  // Confirm the child belongs to this tenant (service-role bypasses RLS).
  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', input.studentId)
    .eq('school_id', g.schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }

  const { data, error } = await db
    .from('aim_cases')
    .insert({
      school_id: g.schoolId,
      student_id: input.studentId,
      aim_level: input.level ?? null,
      status: 'PREPARING',
      consent_status: 'NOT_REQUESTED',
      created_by: g.user.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (error && /duplicate key|unique/i.test(error.message))
      return { ok: false, error: 'This child already has an AIM case.' }
    logger.error('aim_case_create_failed', { schoolId: g.schoolId, error: error?.message })
    return { ok: false, error: 'Could not open the AIM case.' }
  }
  await audit(g.user, g.schoolId, 'aim.case_created', (data as { id: string }).id)
  revalidatePath('/admin/funding/aim')
  return { ok: true }
}

/** Edit an AIM case's level and/or (non-clinical) support summary. */
export async function updateAimCaseAction(input: {
  caseId: string
  level?: number | null
  supportSummary?: string
}): Promise<AimActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  const existing = await loadCase(g.schoolId, input.caseId)
  if (!existing) return { ok: false, error: 'AIM case not found.' }
  if (input.level != null && !isAimLevel(input.level))
    return { ok: false, error: 'AIM level must be 1–7.' }

  const fields: Record<string, number | string | null> = {}
  if (input.level !== undefined) fields.aim_level = input.level
  if (input.supportSummary !== undefined)
    fields.support_summary = input.supportSummary.trim() || null
  if (Object.keys(fields).length === 0) return { ok: true }

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('aim_cases')
    .update(fields)
    .eq('id', input.caseId)
    .eq('school_id', g.schoolId)
  if (error) {
    logger.error('aim_case_update_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the AIM case.' }
  }
  await audit(g.user, g.schoolId, 'aim.case_updated', input.caseId)
  revalidatePath('/admin/funding/aim')
  return { ok: true }
}

/** Record the parental/guardian consent state for an AIM case. */
export async function recordAimConsentAction(input: {
  caseId: string
  consentStatus: string
}): Promise<AimActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  if (!isAimConsentStatus(input.consentStatus))
    return { ok: false, error: 'Invalid consent status.' }
  const existing = await loadCase(g.schoolId, input.caseId)
  if (!existing) return { ok: false, error: 'AIM case not found.' }

  const granted = input.consentStatus === 'GRANTED'
  const fields: Record<string, string | null> = {
    consent_status: input.consentStatus,
    consent_recorded_at: new Date().toISOString(),
    consent_recorded_by: g.user.id,
  }
  // Recording consent on a fresh case advances it to CONSENT_RECORDED.
  if (granted && existing.status === 'PREPARING') fields.status = 'CONSENT_RECORDED'

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('aim_cases')
    .update(fields)
    .eq('id', input.caseId)
    .eq('school_id', g.schoolId)
  if (error) {
    logger.error('aim_consent_record_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not record consent.' }
  }
  await audit(g.user, g.schoolId, 'aim.consent_recorded', input.caseId, {
    consent_status: input.consentStatus,
  })
  revalidatePath('/admin/funding/aim')
  return { ok: true }
}

/** Move an AIM case through its status machine (consent-gated for ready/submitted). */
export async function transitionAimCaseAction(input: {
  caseId: string
  to: string
}): Promise<AimActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  if (!isAimStatus(input.to)) return { ok: false, error: 'Invalid status.' }
  const existing = await loadCase(g.schoolId, input.caseId)
  if (!existing) return { ok: false, error: 'AIM case not found.' }
  if (!canTransitionAim(existing.status, input.to))
    return { ok: false, error: `Cannot move from ${existing.status} to ${input.to}.` }

  // Consent + completeness gate before anything is prepared for / submitted to Hive.
  if (input.to === 'READY' || input.to === 'SUBMITTED_EXTERNALLY') {
    const check = validateAimReady({
      level: existing.aim_level,
      consentStatus: existing.consent_status,
      supportSummary: existing.support_summary,
    })
    if (!check.ok) return { ok: false, error: `Missing before ready: ${check.missing.join(', ')}.` }
  }

  const fields: Record<string, string | null> = { status: input.to }
  const now = new Date().toISOString()
  if (input.to === 'READY') fields.prepared_at = now
  if (input.to === 'SUBMITTED_EXTERNALLY') {
    fields.submitted_at = now
    fields.submitted_by = g.user.id
  }

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('aim_cases')
    .update(fields)
    .eq('id', input.caseId)
    .eq('school_id', g.schoolId)
  if (error) {
    logger.error('aim_transition_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the AIM case.' }
  }
  if (input.to === 'SUBMITTED_EXTERNALLY')
    await audit(g.user, g.schoolId, 'aim.submitted', input.caseId)
  else if (input.to === 'CLOSED') await audit(g.user, g.schoolId, 'aim.closed', input.caseId)
  else await audit(g.user, g.schoolId, 'aim.case_updated', input.caseId, { status: input.to })
  revalidatePath('/admin/funding/aim')
  return { ok: true }
}
