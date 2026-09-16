'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export type AbsenceReasonState = { error?: string; success?: boolean }

const MAX_REASON_LEN = 500

/**
 * Save (or clear) the parent's reason for one attendance record. Authorised by
 * the parent↔child link; only touches the parent_reason* columns, never the
 * teacher's status/note. An empty reason clears it.
 */
export async function submitAbsenceReasonAction(
  recordId: string,
  reason: string,
): Promise<AbsenceReasonState> {
  const parent = await requireVerifiedAuth()
  const adminClient = createSupabaseAdminClient()

  const { data: rec } = await adminClient
    .from('attendance_records')
    .select('id, student_id')
    .eq('id', recordId)
    .maybeSingle()
  const row = rec as { id: string; student_id: string } | null
  if (!row) return { error: 'Attendance record not found.' }

  const { data: link } = await adminClient
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', row.student_id)
    .eq('is_active', true)
    .maybeSingle()
  if (!link) return { error: 'You can only add reasons for your own child.' }

  const trimmed = reason.trim().slice(0, MAX_REASON_LEN)
  const { error } = await adminClient
    .from('attendance_records')
    .update({
      parent_reason: trimmed || null,
      parent_reason_at: trimmed ? new Date().toISOString() : null,
      parent_reason_by: trimmed ? parent.id : null,
    })
    .eq('id', recordId)
  if (error) {
    logger.error('attendance_reason_update_failed', { recordId, error: error.message })
    return { error: 'Could not save the reason. Please try again.' }
  }

  logger.info('attendance_reason_saved', { recordId, by: parent.id, cleared: trimmed === '' })
  revalidatePath('/parent/attendance')
  return { success: true }
}
