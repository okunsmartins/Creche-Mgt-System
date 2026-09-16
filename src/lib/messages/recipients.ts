import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { ParentMessageAudienceInput } from './schemas'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface Recipient {
  parentId: string
  email: string
  name: string
}

export interface TeacherAudienceContext {
  /** Class ids the teacher is assigned to. */
  teacherClassIds: string[]
  /** For a 'student' audience: the class the student belongs to (null if unknown). */
  studentClassId: string | null
}

/**
 * Pure authorization rule for a teacher's chosen audience. Teachers may only
 * message parents of pupils in their OWN classes — never the whole school, and
 * never a class/pupil they are not assigned to. Admins bypass this entirely.
 */
export function canTeacherTargetAudience(
  audience: ParentMessageAudienceInput,
  ctx: TeacherAudienceContext,
): boolean {
  switch (audience.type) {
    case 'school':
      return false // school-wide blast is admin-only
    case 'class':
      return ctx.teacherClassIds.includes(audience.classId)
    case 'student':
      return ctx.studentClassId !== null && ctx.teacherClassIds.includes(ctx.studentClassId)
  }
}

/** Resolve the teacher's record id + assigned class ids from their login email. */
export async function resolveTeacherContext(
  adminClient: AdminClient,
  schoolId: string,
  email: string,
): Promise<{ teacherId: string; classIds: string[] } | null> {
  const { data: teacher } = await adminClient
    .from('teachers')
    .select('id')
    .eq('school_id', schoolId)
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()
  const teacherId = (teacher as { id: string } | null)?.id
  if (!teacherId) return null

  const { data: classes } = await adminClient
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
  const classIds = ((classes as { id: string }[] | null) ?? []).map((c) => c.id)
  return { teacherId, classIds }
}

/** The class a student belongs to (school-scoped), or null. */
export async function getStudentClassId(
  adminClient: AdminClient,
  schoolId: string,
  studentId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from('students')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('id', studentId)
    .maybeSingle()
  return (data as { class_id: string } | null)?.class_id ?? null
}

/** Collect the distinct parent ids for an audience (always school-scoped).
 *  Exported so the SMS feature reuses the exact same tenant-scoped resolution. */
export async function parentIdsForAudience(
  adminClient: AdminClient,
  schoolId: string,
  audience: ParentMessageAudienceInput,
): Promise<string[]> {
  if (audience.type === 'school') {
    const { data } = await adminClient
      .from('parent_student_links')
      .select('parent_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
    return dedupe((data as { parent_id: string }[] | null) ?? [])
  }

  if (audience.type === 'student') {
    const { data } = await adminClient
      .from('parent_student_links')
      .select('parent_id')
      .eq('school_id', schoolId)
      .eq('student_id', audience.studentId)
      .eq('is_active', true)
    return dedupe((data as { parent_id: string }[] | null) ?? [])
  }

  // 'class' — active students in the class, then their (actively-linked) parents.
  const { data: students } = await adminClient
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', audience.classId)
    .eq('is_active', true)
  const studentIds = ((students as { id: string }[] | null) ?? []).map((s) => s.id)
  if (studentIds.length === 0) return []

  const { data } = await adminClient
    .from('parent_student_links')
    .select('parent_id')
    .eq('school_id', schoolId)
    .in('student_id', studentIds)
    .eq('is_active', true)
  return dedupe((data as { parent_id: string }[] | null) ?? [])
}

function dedupe(rows: { parent_id: string }[]): string[] {
  return [...new Set(rows.map((r) => r.parent_id))]
}

/**
 * Resolve the deliverable recipient list for an audience. Always school-scoped;
 * does NOT apply teacher authorization (the action checks that first). Parents
 * without an email on record are skipped (and reflected in the count gap).
 */
export async function resolveRecipients(
  adminClient: AdminClient,
  schoolId: string,
  audience: ParentMessageAudienceInput,
): Promise<Recipient[]> {
  const parentIds = await parentIdsForAudience(adminClient, schoolId, audience)
  if (parentIds.length === 0) return []

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, email, first_name, last_name')
    .in('id', parentIds)
    .eq('is_active', true)

  type ProfileRow = {
    id: string
    email: string | null
    first_name: string | null
    last_name: string | null
  }
  return ((profiles as ProfileRow[] | null) ?? [])
    .filter((p): p is ProfileRow & { email: string } => !!p.email && p.email.length > 0)
    .map((p) => ({
      parentId: p.id,
      email: p.email,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'Parent/Guardian',
    }))
}
