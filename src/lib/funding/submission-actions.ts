'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import { fundingEnabled } from './access'
import { getNcsWeeklyReturn } from './queries'
import {
  buildWeeklyReturnPayload,
  canTransitionSubmission,
  type SubmissionStatus,
} from './submissions'

export type SubmissionActionResult = { ok: boolean; error?: string }

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

/**
 * Freeze the current NCS weekly return for a reporting week into an immutable snapshot.
 * Supersedes any prior PREPARED snapshot for the same week, then records the new one.
 */
export async function prepareNcsWeeklyReturnSnapshotAction(
  weekStart: string,
): Promise<SubmissionActionResult> {
  const g = await gate('funding.export')
  if ('error' in g) return { ok: false, error: g.error }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { ok: false, error: 'Invalid week.' }

  const wr = await getNcsWeeklyReturn(g.schoolId, weekStart)
  if (wr.total === 0)
    return { ok: false, error: 'No compliance has been built for that week yet — run it first.' }

  const payload = buildWeeklyReturnPayload({
    weekStart,
    calculationVersion: wr.calculationVersion,
    total: wr.total,
    rows: wr.reviewRequired.map((r) => ({
      studentId: r.studentId,
      childName: r.childName,
      claimedMinutes: r.claimedMinutes,
      actualMinutes: r.actualMinutes,
      consecutiveUnderWeeks: r.consecutiveUnderWeeks,
      consecutiveAbsenceWeeks: r.consecutiveAbsenceWeeks,
      thresholdEvent: r.thresholdEvent,
      riskState: r.riskState,
    })),
  })

  const db = createSupabaseAdminClient()
  // Supersede any live prepared snapshot for this week first (the frozen one is kept).
  await db
    .from('funding_submission_snapshots')
    .update({ status: 'SUPERSEDED' })
    .eq('school_id', g.schoolId)
    .eq('kind', 'NCS_WEEKLY_RETURN')
    .eq('reference', weekStart)
    .eq('status', 'PREPARED')

  const { error } = await db.from('funding_submission_snapshots').insert({
    school_id: g.schoolId,
    kind: 'NCS_WEEKLY_RETURN',
    reference: weekStart,
    payload,
    rules_version: wr.calculationVersion,
    item_count: payload.reviewCount,
    status: 'PREPARED',
    prepared_by: g.user.id,
  })
  if (error) {
    logger.error('submission_prepare_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not prepare the snapshot. Please try again.' }
  }
  revalidatePath('/admin/funding/submissions')
  return { ok: true }
}

/** Record that a prepared snapshot was submitted to Hive, with the external reference. */
export async function markSubmissionSubmittedAction(input: {
  snapshotId: string
  reference?: string
}): Promise<SubmissionActionResult> {
  const g = await gate('funding.mark_submitted')
  if ('error' in g) return { ok: false, error: g.error }

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('funding_submission_snapshots')
    .select('status')
    .eq('id', input.snapshotId)
    .eq('school_id', g.schoolId)
    .maybeSingle()
  const row = data as { status: SubmissionStatus } | null
  if (!row) return { ok: false, error: 'Snapshot not found.' }
  if (!canTransitionSubmission(row.status, 'SUBMITTED_EXTERNALLY'))
    return { ok: false, error: `Cannot mark a ${row.status} snapshot as submitted.` }

  const { error } = await db
    .from('funding_submission_snapshots')
    .update({
      status: 'SUBMITTED_EXTERNALLY',
      submitted_at: new Date().toISOString(),
      submitted_by: g.user.id,
      submission_reference: input.reference?.trim() || null,
    })
    .eq('id', input.snapshotId)
    .eq('school_id', g.schoolId)
  if (error) {
    logger.error('submission_mark_failed', { schoolId: g.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the snapshot.' }
  }
  revalidatePath('/admin/funding/submissions')
  return { ok: true }
}
