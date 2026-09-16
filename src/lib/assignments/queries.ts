import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { ASSIGNMENT_BUCKET, ASSIGNMENT_SIGNED_URL_TTL } from './validate'
import { orderByRecentSubmission, type AssignmentView, type StudentSubmissions } from './sort'
import type { AssignmentFileKind } from '@/types/database'

export type { AssignmentView, StudentSubmissions, ChildAssignments } from './sort'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

interface RosterStudent {
  id: string
  firstName: string
  lastName: string
  className: string | null
}

type AssignmentRow = {
  id: string
  student_id: string
  title: string | null
  file_kind: AssignmentFileKind
  file_path: string
  file_size_bytes: number
  original_filename: string | null
  created_at: string
}

const ASSIGNMENT_SELECT =
  'id, student_id, title, file_kind, file_path, file_size_bytes, original_filename, created_at'

/** Batch-sign a set of assignment rows into views, preserving their order. */
async function signAssignments(
  adminClient: AdminClient,
  rows: AssignmentRow[],
): Promise<AssignmentView[]> {
  if (rows.length === 0) return []
  const signedByPath = new Map<string, string>()
  const { data: signed } = await adminClient.storage.from(ASSIGNMENT_BUCKET).createSignedUrls(
    rows.map((r) => r.file_path),
    ASSIGNMENT_SIGNED_URL_TTL,
  )
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl)
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    fileKind: r.file_kind,
    fileSizeBytes: r.file_size_bytes,
    originalFilename: r.original_filename,
    createdAt: r.created_at,
    url: signedByPath.get(r.file_path) ?? null,
  }))
}

/**
 * Core fetch: every assignment for the given student ids, batch-signed and
 * grouped by student id (newest first within each student). Shared by the
 * parent, teacher and admin views.
 */
async function getAssignmentsByStudent(
  adminClient: AdminClient,
  studentIds: string[],
): Promise<Map<string, AssignmentView[]>> {
  const byStudent = new Map<string, AssignmentView[]>()
  if (studentIds.length === 0) return byStudent

  const { data: rowData } = await adminClient
    .from('student_assignments')
    .select(ASSIGNMENT_SELECT)
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })
  const rows = (rowData as AssignmentRow[] | null) ?? []
  const views = await signAssignments(adminClient, rows)

  // rows and views are 1:1 in the same (newest-first) order, so zip by index.
  for (let i = 0; i < rows.length; i++) {
    const sid = rows[i]!.student_id
    const list = byStudent.get(sid) ?? []
    list.push(views[i]!)
    byStudent.set(sid, list)
  }
  return byStudent
}

/**
 * Every assignment for a single student (newest first), scoped by school — used
 * by the admin student-detail page. Only reachable behind the admin guard.
 */
export async function getStudentAssignments(
  studentId: string,
  schoolId: string,
): Promise<AssignmentView[]> {
  const adminClient = createSupabaseAdminClient()
  const { data: rowData } = await adminClient
    .from('student_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  return signAssignments(adminClient, (rowData as AssignmentRow[] | null) ?? [])
}

/**
 * Given a student roster, return only those with at least one submission,
 * ordered by most-recent upload first — the "submission inbox" shape used by the
 * teacher and admin views. Pure apart from the assignment fetch.
 */
async function buildStudentSubmissions(
  adminClient: AdminClient,
  roster: RosterStudent[],
): Promise<StudentSubmissions[]> {
  const byStudent = await getAssignmentsByStudent(
    adminClient,
    roster.map((r) => r.id),
  )
  const withSubmissions: StudentSubmissions[] = []
  for (const r of roster) {
    const assignments = byStudent.get(r.id)
    if (!assignments || assignments.length === 0) continue
    withSubmissions.push({
      studentId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      className: r.className,
      assignments,
    })
  }
  return orderByRecentSubmission(withSubmissions)
}

/**
 * Every child actively linked to this parent, each with their uploaded
 * assignments (newest first) and a freshly-signed view URL per file. Scoped to
 * the parent via parent_student_links; only reachable behind the parent guard.
 * Unlike the staff views, this includes children with no uploads.
 */
export async function getParentChildrenWithAssignments(
  parentId: string,
): Promise<StudentSubmissions[]> {
  const adminClient = createSupabaseAdminClient()

  const { data: linkData } = await adminClient
    .from('parent_student_links')
    .select('students(id, first_name, last_name, classes(name))')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('created_at')
  type LinkRow = {
    students: {
      id: string
      first_name: string
      last_name: string
      classes: { name: string } | null
    } | null
  }
  const children = ((linkData as LinkRow[] | null) ?? [])
    .map((l) => l.students)
    .filter((s): s is NonNullable<LinkRow['students']> => s !== null)
  if (children.length === 0) return []

  const byStudent = await getAssignmentsByStudent(
    adminClient,
    children.map((c) => c.id),
  )
  return children.map((c) => ({
    studentId: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    className: c.classes?.name ?? null,
    assignments: byStudent.get(c.id) ?? [],
  }))
}

/**
 * Submission inbox for a teacher: students across ALL of the teacher's active
 * classes who have uploaded work, newest submission first. `hasClasses` is false
 * when the teacher has no assigned class (a different empty state than "no work
 * submitted yet"). Scoped via resolveTeacherClasses — only behind the teacher guard.
 */
export async function getTeacherSubmissions(
  email: string,
): Promise<{ hasClasses: boolean; students: StudentSubmissions[] }> {
  const adminClient = createSupabaseAdminClient()
  const resolved = await resolveTeacherClasses(adminClient, email)
  if (!resolved || resolved.classes.length === 0) return { hasClasses: false, students: [] }

  const classNameById = new Map(resolved.classes.map((c) => [c.id, c.name]))
  const { data: studentData } = await adminClient
    .from('students')
    .select('id, first_name, last_name, class_id')
    .in(
      'class_id',
      resolved.classes.map((c) => c.id),
    )
    .eq('is_active', true)
  const roster = (
    (studentData as
      | { id: string; first_name: string; last_name: string; class_id: string }[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    className: classNameById.get(s.class_id) ?? null,
  }))

  const students = await buildStudentSubmissions(adminClient, roster)
  return { hasClasses: true, students }
}

/**
 * Submission inbox for a school admin: every active student in the school who has
 * uploaded work, newest submission first. Scoped by school_id — only behind the
 * admin guard. Pass `classId` to narrow to a single class.
 */
export async function getSchoolSubmissions(
  schoolId: string,
  classId?: string,
): Promise<StudentSubmissions[]> {
  const adminClient = createSupabaseAdminClient()
  let studentQuery = adminClient
    .from('students')
    .select('id, first_name, last_name, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
  if (classId) studentQuery = studentQuery.eq('class_id', classId)
  const { data: studentData } = await studentQuery
  const roster = (
    (studentData as
      | { id: string; first_name: string; last_name: string; classes: { name: string } | null }[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    className: s.classes?.name ?? null,
  }))

  return buildStudentSubmissions(adminClient, roster)
}
