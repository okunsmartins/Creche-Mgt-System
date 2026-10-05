'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import { fundingEnabled } from './access'
import { getCoreFundingView } from './queries'
import { summariseDrift } from './core-funding'

export type CoreActionResult = { ok: boolean; error?: string }

async function gate(): Promise<{ user: SessionUser; schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes('funding.manage_core'))
    return { error: 'You do not have permission to manage Core Funding.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { user, schoolId: user.schoolId }
}

const toInt = (v: FormDataEntryValue | null): number =>
  Math.max(0, Math.round(parseFloat((v as string) || '0') || 0))

/**
 * Capture the current verified Core Funding profile as the new snapshot. staffCount
 * and roomCount are taken from live data; totalCapacity and operatingWeeks are the
 * manager-confirmed figures from the form. Clears any open drift action.
 */
export async function captureCoreSnapshotAction(
  _prev: CoreActionResult,
  formData: FormData,
): Promise<CoreActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  const programmeYear = ((formData.get('programmeYear') as string | null) ?? '').trim()
  if (!programmeYear) return { ok: false, error: 'Programme year is required.' }

  const view = await getCoreFundingView(g.schoolId, programmeYear)
  const profile = {
    staffCount: view.current.staffCount,
    roomCount: view.current.roomCount,
    totalCapacity: toInt(formData.get('totalCapacity')),
    operatingWeeks: toInt(formData.get('operatingWeeks')),
  }

  const db = createSupabaseAdminClient()
  const { error } = await db.from('core_funding_snapshots').insert({
    school_id: g.schoolId,
    programme_year: programmeYear,
    profile,
    captured_by: g.user.id,
  })
  if (error) {
    logger.error('core_snapshot_capture_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not capture the snapshot. Please try again.' }
  }
  // Snapshot now matches reality — resolve any open Core Funding drift action.
  await db
    .from('hive_action_items')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completed_by: g.user.id,
    })
    .eq('school_id', g.schoolId)
    .eq('dedupe_key', `core:DRIFT:${programmeYear}`)
    .in('status', ['OPEN', 'IN_REVIEW'])

  revalidatePath('/admin/funding/core-funding')
  revalidatePath('/admin/funding')
  return { ok: true }
}

/** Raise a Core Funding review action for the current drift (deduped per year). */
export async function flagCoreDriftAction(programmeYear: string): Promise<CoreActionResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  const view = await getCoreFundingView(g.schoolId, programmeYear)
  if (view.changes.length === 0) return { ok: false, error: 'No drift to flag.' }

  const db = createSupabaseAdminClient()
  const { error } = await db.from('hive_action_items').insert({
    school_id: g.schoolId,
    programme: 'CORE_FUNDING',
    action_type: 'CORE_FUNDING_DRIFT',
    entity_type: 'service',
    severity: 'ACTION',
    status: 'OPEN',
    reason_code: 'CORE_DRIFT',
    description: `Core Funding profile has drifted from the last verified snapshot (${summariseDrift(view.changes)}). Review whether an application change or Review & Confirm update is needed.`,
    dedupe_key: `core:DRIFT:${programmeYear}`,
  })
  if (error && !/duplicate key|unique/i.test(error.message)) {
    logger.error('core_drift_flag_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not flag the drift.' }
  }
  revalidatePath('/admin/funding/core-funding')
  revalidatePath('/admin/funding')
  return { ok: true }
}
