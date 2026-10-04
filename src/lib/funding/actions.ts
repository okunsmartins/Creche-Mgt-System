'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { fundingEnabled } from './access'
import { buildWeeklyCompliance, type WeeklyBuildSummary } from './service'
import { latestCompletedWeekStart, reportingWeekStart } from './week'

export type FundingActionState = { error?: string; success?: boolean; summary?: WeeklyBuildSummary }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

async function gate(permission: string): Promise<{ schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes(permission))
    return { error: 'You do not have permission for this.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { schoolId: user.schoolId }
}

/**
 * Build (or rebuild) the NCS weekly compliance snapshots + actions for a reporting
 * week. Defaults to the most recently completed week. Idempotent. Admin + funding
 * permission + tenant feature flag required.
 */
export async function runWeeklyComplianceAction(
  _prev: FundingActionState,
  formData: FormData,
): Promise<FundingActionState> {
  const g = await gate('funding.manage_ncs')
  if ('error' in g) return { error: g.error }

  const raw = (formData.get('weekStart') as string | null)?.trim()
  const weekStart = raw && ISO_DATE.test(raw) ? reportingWeekStart(raw) : latestCompletedWeekStart()

  try {
    const summary = await buildWeeklyCompliance(g.schoolId, weekStart)
    revalidatePath('/admin/funding')
    return { success: true, summary }
  } catch (err) {
    logger.error('run_weekly_compliance_failed', {
      schoolId: g.schoolId,
      weekStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not build the weekly compliance. Please try again.' }
  }
}

/** Resolve a Hive action: mark it completed or dismiss it with a reason. */
export async function updateHiveActionAction(input: {
  actionId: string
  status: 'IN_REVIEW' | 'COMPLETED' | 'DISMISSED_WITH_REASON'
  reason?: string
}): Promise<{ ok: boolean; error?: string }> {
  const g = await gate('funding.manage_ncs')
  if ('error' in g) return { ok: false, error: g.error }
  if (input.status === 'DISMISSED_WITH_REASON' && !input.reason?.trim())
    return { ok: false, error: 'A reason is required to dismiss an action.' }

  const user = await requireAdmin()
  const db = createSupabaseAdminClient()
  const fields: Record<string, unknown> = { status: input.status }
  if (input.status === 'COMPLETED') {
    fields.completed_by = user.id
    fields.completed_at = new Date().toISOString()
  }
  if (input.status === 'DISMISSED_WITH_REASON') fields.dismissed_reason = input.reason!.trim()

  // Verify-then-act: scope the update to the admin's own school.
  const { data: touched, error } = await db
    .from('hive_action_items')
    .update(fields)
    .eq('id', input.actionId)
    .eq('school_id', g.schoolId)
    .select('id')
  if (error) {
    logger.error('hive_action_update_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the action. Please try again.' }
  }
  if (!touched || touched.length === 0) return { ok: false, error: 'Action not found.' }
  revalidatePath('/admin/funding')
  return { ok: true }
}
