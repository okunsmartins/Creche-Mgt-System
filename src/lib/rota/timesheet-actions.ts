'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { weekDays, validateShiftTimes } from './rota'

export type TimesheetActionResult = { ok: boolean; error?: string; created?: number }

/**
 * Generate PENDING timesheet entries from the rostered shifts for a week. Idempotent:
 * shifts that already have a timesheet are skipped. Actual times default to the planned
 * (rostered) times — an admin then adjusts and approves them.
 */
export async function generateTimesheetsForWeekAction(
  weekStart: string,
): Promise<TimesheetActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { ok: false, error: 'Invalid week.' }

  const db = createSupabaseAdminClient()
  const dates = weekDays(weekStart)

  const { data: shiftData } = await db
    .from('staff_shifts')
    .select('id, teacher_id, shift_date, start_time, end_time')
    .eq('school_id', admin.schoolId)
    .in('shift_date', dates)
  const shifts =
    (shiftData as
      | {
          id: string
          teacher_id: string
          shift_date: string
          start_time: string
          end_time: string
        }[]
      | null) ?? []
  if (shifts.length === 0)
    return { ok: false, error: 'No rostered shifts this week to generate from.' }

  // Which of these shifts already have a timesheet?
  const { data: existing } = await db
    .from('staff_timesheets')
    .select('shift_id')
    .eq('school_id', admin.schoolId)
    .in(
      'shift_id',
      shifts.map((s) => s.id),
    )
  const taken = new Set(
    ((existing as { shift_id: string | null }[] | null) ?? []).map((r) => r.shift_id),
  )

  const rows = shifts
    .filter((s) => !taken.has(s.id))
    .map((s) => ({
      school_id: admin.schoolId,
      teacher_id: s.teacher_id,
      shift_id: s.id,
      work_date: s.shift_date,
      planned_start: s.start_time,
      planned_end: s.end_time,
      actual_start: s.start_time,
      actual_end: s.end_time,
      status: 'PENDING',
      created_by: admin.id,
    }))
  if (rows.length === 0) return { ok: true, created: 0 }

  const { error } = await db.from('staff_timesheets').insert(rows)
  if (error) {
    logger.error('timesheet_generate_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not generate timesheets. Please try again.' }
  }
  revalidatePath('/admin/timesheets')
  return { ok: true, created: rows.length }
}

/** Adjust the actual worked times (and notes) of a timesheet entry. */
export async function updateTimesheetAction(input: {
  id: string
  actualStart: string
  actualEnd: string
  notes?: string
}): Promise<TimesheetActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  const timeError = validateShiftTimes(input.actualStart, input.actualEnd)
  if (timeError) return { ok: false, error: timeError }

  const db = createSupabaseAdminClient()
  const fields: Record<string, string | null> = {
    actual_start: input.actualStart,
    actual_end: input.actualEnd,
  }
  if (input.notes !== undefined) fields.notes = input.notes.trim() || null

  const { data, error } = await db
    .from('staff_timesheets')
    .update(fields)
    .eq('id', input.id)
    .eq('school_id', admin.schoolId)
    .select('id')
  if (error) {
    logger.error('timesheet_update_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the timesheet.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'Timesheet not found.' }
  revalidatePath('/admin/timesheets')
  return { ok: true }
}

/** Approve or re-open (un-approve) a timesheet entry. */
export async function setTimesheetApprovalAction(input: {
  id: string
  approved: boolean
}): Promise<TimesheetActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('staff_timesheets')
    .update(
      input.approved
        ? { status: 'APPROVED', approved_by: admin.id, approved_at: new Date().toISOString() }
        : { status: 'PENDING', approved_by: null, approved_at: null },
    )
    .eq('id', input.id)
    .eq('school_id', admin.schoolId)
    .select('id')
  if (error) {
    logger.error('timesheet_approve_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not update the timesheet.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'Timesheet not found.' }
  revalidatePath('/admin/timesheets')
  return { ok: true }
}

/** Remove a timesheet entry. */
export async function deleteTimesheetAction(id: string): Promise<TimesheetActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('staff_timesheets')
    .delete()
    .eq('id', id)
    .eq('school_id', admin.schoolId)
    .select('id')
  if (error) {
    logger.error('timesheet_delete_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not remove the timesheet.' }
  }
  if ((data ?? []).length === 0) return { ok: false, error: 'Timesheet not found.' }
  revalidatePath('/admin/timesheets')
  return { ok: true }
}
