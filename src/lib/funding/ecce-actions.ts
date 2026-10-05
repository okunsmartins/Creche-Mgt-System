'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import { fundingEnabled } from './access'
import { validateEcceReady, isEcceSession } from './ecce'
import { PROGRAMME_READINESS_2026_2027, isReadinessStatus, type ReadinessStatus } from './readiness'

export type EcceActionResult = { ok: boolean; error?: string }

async function gate(
  permission: string,
): Promise<{ user: SessionUser; schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes(permission))
    return { error: 'You do not have permission for this.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { user, schoolId: user.schoolId }
}

/** Set a child's ECCE session and/or AIM Level 7 flag on their ECCE registration. */
export async function updateEcceRegistrationAction(input: {
  registrationId: string
  session?: string
  aimLevel7?: boolean
}): Promise<EcceActionResult> {
  const g = await gate('funding.manage_ecce')
  if ('error' in g) return { ok: false, error: g.error }
  const fields: Record<string, unknown> = {}
  if (input.session !== undefined) {
    if (!isEcceSession(input.session)) return { ok: false, error: 'Invalid ECCE session.' }
    fields.ecce_session = input.session
  }
  if (input.aimLevel7 !== undefined) fields.aim_level_7 = input.aimLevel7
  if (Object.keys(fields).length === 0) return { ok: true }

  const db = createSupabaseAdminClient()
  const { data: touched, error } = await db
    .from('child_funding_registrations')
    .update(fields)
    .eq('id', input.registrationId)
    .eq('school_id', g.schoolId)
    .eq('scheme', 'ECCE')
    .select('id')
  if (error) {
    logger.error('ecce_update_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the registration.' }
  }
  if (!touched || touched.length === 0) return { ok: false, error: 'Registration not found.' }
  revalidatePath('/admin/funding/ecce')
  return { ok: true }
}

/** Mark an ECCE registration prepared (validates; AIM L7 requires an AM/PM session). */
export async function markEcceReadyAction(registrationId: string): Promise<EcceActionResult> {
  const g = await gate('funding.manage_ecce')
  if ('error' in g) return { ok: false, error: g.error }
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('child_funding_registrations')
    .select('pps_number_encrypted, ecce_session, aim_level_7, start_date')
    .eq('id', registrationId)
    .eq('school_id', g.schoolId)
    .eq('scheme', 'ECCE')
    .maybeSingle()
  const r = data as {
    pps_number_encrypted: string | null
    ecce_session: string | null
    aim_level_7: boolean
    start_date: string | null
  } | null
  if (!r) return { ok: false, error: 'Registration not found.' }

  const v = validateEcceReady({
    ppsnPresent: !!r.pps_number_encrypted,
    addressPresent: true, // child address isn't modelled in Creche Wise; not gated here
    registrationPeriodSet: !!r.start_date,
    session: r.ecce_session,
    aimLevel7: r.aim_level_7,
  })
  if (!v.ok) return { ok: false, error: `Missing before ready: ${v.missing.join(', ')}.` }

  const { error } = await db
    .from('child_funding_registrations')
    .update({ ecce_registration_prepared_at: new Date().toISOString() })
    .eq('id', registrationId)
    .eq('school_id', g.schoolId)
  if (error) return { ok: false, error: 'Could not mark the registration ready.' }
  revalidatePath('/admin/funding/ecce')
  return { ok: true }
}

/** Record that the ECCE registration was completed on the Hive. */
export async function markEcceSubmittedAction(registrationId: string): Promise<EcceActionResult> {
  const g = await gate('funding.mark_submitted')
  if ('error' in g) return { ok: false, error: g.error }
  const db = createSupabaseAdminClient()
  const { data: touched, error } = await db
    .from('child_funding_registrations')
    .update({
      ecce_registration_submitted_at: new Date().toISOString(),
      ecce_registration_submitted_by: g.user.id,
    })
    .eq('id', registrationId)
    .eq('school_id', g.schoolId)
    .eq('scheme', 'ECCE')
    .select('id')
  if (error || !touched || touched.length === 0)
    return { ok: false, error: 'Could not update the registration.' }
  revalidatePath('/admin/funding/ecce')
  return { ok: true }
}

// ── Programme Readiness ─────────────────────────────────────────────────────────

/** Seed the programme-year checklist for the tenant (idempotent). */
export async function seedReadinessAction(programmeYear: string): Promise<EcceActionResult> {
  const g = await gate('funding.manage_core')
  if ('error' in g) return { ok: false, error: g.error }
  const db = createSupabaseAdminClient()
  const rows = PROGRAMME_READINESS_2026_2027.map((item) => ({
    school_id: g.schoolId,
    programme_year: programmeYear,
    item_key: item.key,
    label: item.label,
    category: item.category,
    status: 'MISSING',
  }))
  const { error } = await db
    .from('funding_readiness_items')
    .upsert(rows, { onConflict: 'school_id,programme_year,item_key', ignoreDuplicates: true })
  if (error) {
    logger.error('readiness_seed_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not set up the checklist.' }
  }
  revalidatePath('/admin/funding/readiness')
  return { ok: true }
}

/** Update one readiness item's status, due date and notes (verify-then-act). */
export async function setReadinessItemAction(input: {
  itemId: string
  status: string
  dueDate?: string | null
  notes?: string | null
}): Promise<EcceActionResult> {
  const g = await gate('funding.manage_core')
  if ('error' in g) return { ok: false, error: g.error }
  if (!isReadinessStatus(input.status)) return { ok: false, error: 'Invalid status.' }
  const db = createSupabaseAdminClient()
  const fields: Record<string, unknown> = {
    status: input.status as ReadinessStatus,
    updated_by: g.user.id,
  }
  if (input.dueDate !== undefined) fields.due_date = input.dueDate || null
  if (input.notes !== undefined) fields.notes = input.notes || null
  const { data: touched, error } = await db
    .from('funding_readiness_items')
    .update(fields)
    .eq('id', input.itemId)
    .eq('school_id', g.schoolId)
    .select('id')
  if (error || !touched || touched.length === 0)
    return { ok: false, error: 'Could not update the item.' }
  revalidatePath('/admin/funding/readiness')
  return { ok: true }
}
