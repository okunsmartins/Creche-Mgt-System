'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { EyRatioBand } from './ratio'

export type RatioActionResult = { ok: boolean; error?: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

/**
 * Save the crèche's ratio bands (children-per-adult per age band). Upserts each band by
 * label; replaces the reference defaults with the crèche's own numbers.
 */
export async function saveRatioBandsAction(bands: EyRatioBand[]): Promise<RatioActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!Array.isArray(bands) || bands.length === 0)
    return { ok: false, error: 'No ratio bands to save.' }

  for (const b of bands) {
    if (!b.label?.trim()) return { ok: false, error: 'Every band needs a label.' }
    if (!isInt(b.minMonths) || !isInt(b.maxMonths) || b.maxMonths <= b.minMonths)
      return { ok: false, error: `Invalid age range for "${b.label}".` }
    if (!isInt(b.childrenPerAdult) || b.childrenPerAdult < 1)
      return { ok: false, error: `"${b.label}" needs a children-per-adult of 1 or more.` }
  }

  const rows = bands.map((b, i) => ({
    school_id: admin.schoolId,
    label: b.label.trim(),
    min_months: b.minMonths,
    max_months: b.maxMonths,
    children_per_adult: b.childrenPerAdult,
    display_order: i,
  }))

  const db = createSupabaseAdminClient()
  const { error } = await db.from('ratio_bands').upsert(rows, { onConflict: 'school_id,label' })
  if (error) {
    logger.error('ratio_bands_save_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not save the ratio configuration.' }
  }

  revalidatePath('/admin/ratios')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

/** Save (or clear) the staff on duty in a room for a given day. */
export async function setStaffOnDutyAction(input: {
  classId: string
  date: string
  count: number
}): Promise<RatioActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!ISO.test(input.date)) return { ok: false, error: 'Invalid date.' }
  if (!isInt(input.count) || input.count < 0)
    return { ok: false, error: 'Staff on duty must be 0 or more.' }

  const db = createSupabaseAdminClient()
  // The room must belong to this crèche.
  const { data: room } = await db
    .from('classes')
    .select('id')
    .eq('id', input.classId)
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  if (!room) return { ok: false, error: 'Room not found for your crèche.' }

  const { error } = await db.from('room_staff_on_duty').upsert(
    {
      school_id: admin.schoolId,
      class_id: input.classId,
      on_date: input.date,
      staff_count: input.count,
      updated_by: admin.id,
    },
    { onConflict: 'school_id,class_id,on_date' },
  )
  if (error) {
    logger.error('staff_on_duty_save_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not save staff on duty.' }
  }

  revalidatePath('/admin/ratios')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}
