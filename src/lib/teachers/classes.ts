import { createSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface TeacherClass {
  id: string
  name: string
}

export interface TeacherClasses {
  teacherId: string
  classes: TeacherClass[]
}

/**
 * Resolve a teacher's record + ALL of their active assigned classes from their
 * login email. Returns the classes as an array (a teacher may be assigned to
 * more than one class) — replacing the old single-class `.maybeSingle()` lookups
 * which ignored (or errored on) additional classes.
 */
export async function resolveTeacherClasses(
  adminClient: AdminClient,
  email: string,
): Promise<TeacherClasses | null> {
  const { data: teacher } = await adminClient
    .from('teachers')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()
  const teacherId = (teacher as { id: string } | null)?.id
  if (!teacherId) return null

  const { data } = await adminClient
    .from('classes')
    .select('id, name')
    .eq('teacher_id', teacherId)
    .eq('is_active', true)
    .order('name')

  return { teacherId, classes: (data as TeacherClass[] | null) ?? [] }
}

/**
 * Pick which class a teacher page should show: the requested class id when it is
 * one the teacher actually owns, otherwise the first class. Returns null when the
 * teacher has no classes. Pure — unit-tested.
 */
export function selectTeacherClass(
  classes: TeacherClass[],
  requestedId?: string,
): TeacherClass | null {
  if (classes.length === 0) return null
  if (requestedId) {
    const found = classes.find((c) => c.id === requestedId)
    if (found) return found
  }
  return classes[0] ?? null
}
