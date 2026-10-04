import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { OBSERVATION_BUCKET, OBSERVATION_SIGNED_URL_TTL, normaliseThemes } from './observations'
import type { AistearTheme } from './observations'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface ObservationView {
  id: string
  title: string
  learningStory: string
  observationDate: string
  themes: AistearTheme[]
  nextSteps: string | null
  imageUrl: string | null
  sharedWithParents: boolean
  authorName: string | null
  createdAt: string
}

export interface StudentObservations {
  studentId: string
  firstName: string
  lastName: string
  className: string | null
  observations: ObservationView[]
}

export interface StudentOption {
  id: string
  name: string
  className: string | null
}

const SELECT =
  'id, student_id, title, learning_story, observation_date, aistear_themes, next_steps, ' +
  'image_path, shared_with_parents, created_at, profiles:author_profile_id(first_name, last_name)'

type Row = {
  id: string
  student_id: string
  title: string
  learning_story: string
  observation_date: string
  aistear_themes: string[] | null
  next_steps: string | null
  image_path: string | null
  shared_with_parents: boolean
  created_at: string
  profiles: { first_name: string | null; last_name: string | null } | null
}

/** Batch-sign observation rows into views, preserving order. */
async function signRows(adminClient: AdminClient, rows: Row[]): Promise<ObservationView[]> {
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p)
  const urlByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await adminClient.storage
      .from(OBSERVATION_BUCKET)
      .createSignedUrls(paths, OBSERVATION_SIGNED_URL_TTL)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl)
    }
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    learningStory: r.learning_story,
    observationDate: r.observation_date,
    themes: normaliseThemes(r.aistear_themes ?? []),
    nextSteps: r.next_steps,
    imageUrl: r.image_path ? (urlByPath.get(r.image_path) ?? null) : null,
    sharedWithParents: r.shared_with_parents,
    authorName: [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(' ') || null,
    createdAt: r.created_at,
  }))
}

/** All observations for the given students, grouped by student id (newest first). */
async function byStudent(
  adminClient: AdminClient,
  studentIds: string[],
  opts: { sharedOnly?: boolean } = {},
): Promise<Map<string, ObservationView[]>> {
  const map = new Map<string, ObservationView[]>()
  if (studentIds.length === 0) return map
  let q = adminClient
    .from('child_observations')
    .select(SELECT)
    .in('student_id', studentIds)
    .order('observation_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (opts.sharedOnly) q = q.eq('shared_with_parents', true)
  const { data } = await q
  const rows = (data as unknown as Row[] | null) ?? []
  const views = await signRows(adminClient, rows)
  for (let i = 0; i < rows.length; i++) {
    const sid = rows[i]!.student_id
    const list = map.get(sid) ?? []
    list.push(views[i]!)
    map.set(sid, list)
  }
  return map
}

function toStudentObservations(
  roster: { id: string; firstName: string; lastName: string; className: string | null }[],
  map: Map<string, ObservationView[]>,
  includeEmpty: boolean,
): StudentObservations[] {
  const out: StudentObservations[] = []
  for (const r of roster) {
    const observations = map.get(r.id) ?? []
    if (!includeEmpty && observations.length === 0) continue
    out.push({
      studentId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      className: r.className,
      observations,
    })
  }
  return out
}

// ── Admin ───────────────────────────────────────────────────────────────────
export async function getSchoolObservations(
  schoolId: string,
  classId?: string,
): Promise<StudentObservations[]> {
  const adminClient = createSupabaseAdminClient()
  let sq = adminClient
    .from('students')
    .select('id, first_name, last_name, class_id, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
  if (classId) sq = sq.eq('class_id', classId)
  const { data } = await sq
  const roster = (
    (data as
      | { id: string; first_name: string; last_name: string; classes: { name: string } | null }[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    className: s.classes?.name ?? null,
  }))
  const map = await byStudent(
    adminClient,
    roster.map((r) => r.id),
  )
  // Inbox shape: only children with observations, most-recently-observed first.
  const withObs = toStudentObservations(roster, map, false)
  return withObs.sort((a, b) =>
    (b.observations[0]?.observationDate ?? '').localeCompare(
      a.observations[0]?.observationDate ?? '',
    ),
  )
}

export async function getSchoolStudentOptions(schoolId: string): Promise<StudentOption[]> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('students')
    .select('id, first_name, last_name, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('last_name')
  return (
    (data as
      | { id: string; first_name: string; last_name: string; classes: { name: string } | null }[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    name: [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed child',
    className: s.classes?.name ?? null,
  }))
}

// ── Teacher ───────────────────────────────────────────────────────────────────
async function teacherRoster(adminClient: AdminClient, email: string) {
  const resolved = await resolveTeacherClasses(adminClient, email)
  if (!resolved || resolved.classes.length === 0) return null
  const nameById = new Map(resolved.classes.map((c) => [c.id, c.name]))
  const { data } = await adminClient
    .from('students')
    .select('id, first_name, last_name, class_id')
    .in(
      'class_id',
      resolved.classes.map((c) => c.id),
    )
    .eq('is_active', true)
    .order('last_name')
  const roster = (
    (data as { id: string; first_name: string; last_name: string; class_id: string }[] | null) ?? []
  ).map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    className: nameById.get(s.class_id) ?? null,
  }))
  return roster
}

export async function getTeacherObservations(
  email: string,
): Promise<{ hasClasses: boolean; students: StudentObservations[] }> {
  const adminClient = createSupabaseAdminClient()
  const roster = await teacherRoster(adminClient, email)
  if (!roster) return { hasClasses: false, students: [] }
  const map = await byStudent(
    adminClient,
    roster.map((r) => r.id),
  )
  const withObs = toStudentObservations(roster, map, false).sort((a, b) =>
    (b.observations[0]?.observationDate ?? '').localeCompare(
      a.observations[0]?.observationDate ?? '',
    ),
  )
  return { hasClasses: true, students: withObs }
}

export async function getTeacherStudentOptions(email: string): Promise<StudentOption[]> {
  const adminClient = createSupabaseAdminClient()
  const roster = await teacherRoster(adminClient, email)
  if (!roster) return []
  return roster.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unnamed child',
    className: r.className,
  }))
}

// ── Parent ────────────────────────────────────────────────────────────────────
/** Each linked child with the observations shared with parents (newest first). */
export async function getParentChildrenObservations(
  parentId: string,
): Promise<StudentObservations[]> {
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
  const map = await byStudent(
    adminClient,
    children.map((c) => c.id),
    { sharedOnly: true },
  )
  return children.map((c) => ({
    studentId: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    className: c.classes?.name ?? null,
    observations: map.get(c.id) ?? [],
  }))
}
