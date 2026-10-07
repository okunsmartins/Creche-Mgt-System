import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * Saved staff-on-duty counts per room for a given day, as a Map keyed by class_id.
 * School-scoped. Tolerant of the room_staff_on_duty table being absent (migration 099).
 */
export async function getStaffOnDuty(
  schoolId: string,
  dateISO: string,
): Promise<Map<string, number>> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('room_staff_on_duty')
    .select('class_id, staff_count')
    .eq('school_id', schoolId)
    .eq('on_date', dateISO)

  const out = new Map<string, number>()
  for (const r of (data as { class_id: string; staff_count: number }[] | null) ?? [])
    out.set(r.class_id, r.staff_count)
  return out
}
