import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * Active students (for the "specific pupil" message audience), tenant-scoped.
 * Pass the class ids a teacher may target to restrict the list; pass null for an
 * admin (whole school). Returns a flat list the client groups by class in the
 * Class → Pupil cascade selector.
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface MessagingStudent {
  id: string
  name: string
  classId: string
}

export async function getMessagingStudents(
  adminClient: AdminClient,
  schoolId: string,
  classIds: string[] | null,
): Promise<MessagingStudent[]> {
  if (classIds && classIds.length === 0) return []

  let query = adminClient
    .from('students')
    .select('id, first_name, last_name, class_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('last_name')

  if (classIds) query = query.in('class_id', classIds)

  const { data } = await query
  type Row = { id: string; first_name: string; last_name: string; class_id: string }
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name}`.trim(),
    classId: r.class_id,
  }))
}
