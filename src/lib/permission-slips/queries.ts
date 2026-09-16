import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { tallyResponses, type SlipResponseTally } from './validate'
import type { PermissionSlipAudience } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface ParentSlipView {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  createdAt: string
  /** The child's current response, or null if not answered yet. */
  response: { consent: boolean; note: string | null } | null
}

export interface ChildSlips {
  studentId: string
  firstName: string
  lastName: string
  className: string | null
  slips: ParentSlipView[]
}

type SlipRow = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  created_at: string
  audience_type: PermissionSlipAudience
  school_id: string
  class_id: string | null
}

/**
 * Permission slips applicable to each of a parent's linked children (school-wide
 * or the child's class), with the child's current response. Scoped via
 * parent_student_links; only reachable behind the parent guard.
 */
export async function getParentPermissionSlips(parentId: string): Promise<ChildSlips[]> {
  const adminClient = createSupabaseAdminClient()

  const { data: linkData } = await adminClient
    .from('parent_student_links')
    .select('students(id, first_name, last_name, class_id, school_id, classes(name))')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('created_at')
  type LinkRow = {
    students: {
      id: string
      first_name: string
      last_name: string
      class_id: string
      school_id: string
      classes: { name: string } | null
    } | null
  }
  const children = ((linkData as LinkRow[] | null) ?? [])
    .map((l) => l.students)
    .filter((s): s is NonNullable<LinkRow['students']> => s !== null)
  if (children.length === 0) return []

  const schoolIds = [...new Set(children.map((c) => c.school_id))]
  const { data: slipData } = await adminClient
    .from('permission_slips')
    .select('id, title, description, due_date, created_at, audience_type, school_id, class_id')
    .in('school_id', schoolIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  const slips = (slipData as SlipRow[] | null) ?? []

  const childIds = children.map((c) => c.id)
  const slipIds = slips.map((s) => s.id)
  const respByKey = new Map<string, { consent: boolean; note: string | null }>()
  if (slipIds.length > 0) {
    const { data: respData } = await adminClient
      .from('permission_slip_responses')
      .select('slip_id, student_id, consent, note')
      .in('student_id', childIds)
    for (const r of (respData as
      | { slip_id: string; student_id: string; consent: boolean; note: string | null }[]
      | null) ?? []) {
      respByKey.set(`${r.slip_id}:${r.student_id}`, { consent: r.consent, note: r.note })
    }
  }

  return children.map((c) => {
    const applicable = slips.filter(
      (s) =>
        s.school_id === c.school_id &&
        (s.audience_type === 'school' ||
          (s.audience_type === 'class' && s.class_id === c.class_id)),
    )
    return {
      studentId: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      className: c.classes?.name ?? null,
      slips: applicable.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        dueDate: s.due_date,
        createdAt: s.created_at,
        response: respByKey.get(`${s.id}:${c.id}`) ?? null,
      })),
    }
  })
}

export interface SlipSummary {
  id: string
  title: string
  dueDate: string | null
  createdAt: string
  audienceLabel: string
  tally: SlipResponseTally
}

/** Count of active students in a class / the whole school (the response denominator). */
async function targetStudentCount(
  adminClient: AdminClient,
  schoolId: string,
  audience: PermissionSlipAudience,
  classId: string | null,
): Promise<number> {
  let q = adminClient
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('is_active', true)
  if (audience === 'class' && classId) q = q.eq('class_id', classId)
  const { count } = await q
  return count ?? 0
}

type SlipSummaryRow = {
  id: string
  title: string
  due_date: string | null
  created_at: string
  audience_type: PermissionSlipAudience
  class_id: string | null
  classes: { name: string } | null
}

/** Attach a grant/decline/pending tally to each slip row. Shared by admin + teacher. */
async function buildSlipSummaries(
  adminClient: AdminClient,
  schoolId: string,
  slips: SlipSummaryRow[],
): Promise<SlipSummary[]> {
  if (slips.length === 0) return []

  const { data: respData } = await adminClient
    .from('permission_slip_responses')
    .select('slip_id, consent')
    .in(
      'slip_id',
      slips.map((s) => s.id),
    )
  const respBySlip = new Map<string, { consent: boolean }[]>()
  for (const r of (respData as { slip_id: string; consent: boolean }[] | null) ?? []) {
    const list = respBySlip.get(r.slip_id) ?? []
    list.push({ consent: r.consent })
    respBySlip.set(r.slip_id, list)
  }

  const out: SlipSummary[] = []
  for (const s of slips) {
    const total = await targetStudentCount(adminClient, schoolId, s.audience_type, s.class_id)
    out.push({
      id: s.id,
      title: s.title,
      dueDate: s.due_date,
      createdAt: s.created_at,
      audienceLabel: s.audience_type === 'school' ? 'Whole school' : (s.classes?.name ?? 'Class'),
      tally: tallyResponses(total, respBySlip.get(s.id) ?? []),
    })
  }
  return out
}

/** All slips for a school (admin list), each with a grant/decline/pending tally. */
export async function getSchoolSlips(schoolId: string): Promise<SlipSummary[]> {
  const adminClient = createSupabaseAdminClient()
  const { data: slipData } = await adminClient
    .from('permission_slips')
    .select('id, title, due_date, created_at, audience_type, class_id, classes(name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  return buildSlipSummaries(adminClient, schoolId, (slipData as SlipSummaryRow[] | null) ?? [])
}

/** Slips targeted at one of a teacher's own classes, each with a tally. */
export async function getTeacherSlips(
  schoolId: string,
  classIds: string[],
): Promise<SlipSummary[]> {
  if (classIds.length === 0) return []
  const adminClient = createSupabaseAdminClient()
  const { data: slipData } = await adminClient
    .from('permission_slips')
    .select('id, title, due_date, created_at, audience_type, class_id, classes(name)')
    .eq('school_id', schoolId)
    .in('class_id', classIds)
    .order('created_at', { ascending: false })
  return buildSlipSummaries(adminClient, schoolId, (slipData as SlipSummaryRow[] | null) ?? [])
}

/** True when the slip is class-scoped to one of the teacher's classes. */
export async function teacherOwnsSlip(
  schoolId: string,
  classIds: string[],
  slipId: string,
): Promise<boolean> {
  if (classIds.length === 0) return false
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('permission_slips')
    .select('id')
    .eq('id', slipId)
    .eq('school_id', schoolId)
    .in('class_id', classIds)
    .maybeSingle()
  return !!data
}

export interface SlipStudentResponse {
  studentId: string
  name: string
  className: string | null
  consent: boolean | null
  note: string | null
  respondedAt: string | null
}

export interface SlipDetail {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  audienceLabel: string
  createdAt: string
  students: SlipStudentResponse[]
  tally: SlipResponseTally
}

/** One slip with its per-student responses (admin detail). Scoped by school. */
export async function getSlipDetail(slipId: string, schoolId: string): Promise<SlipDetail | null> {
  const adminClient = createSupabaseAdminClient()
  const { data: slipRow } = await adminClient
    .from('permission_slips')
    .select('id, title, description, due_date, created_at, audience_type, class_id, classes(name)')
    .eq('id', slipId)
    .eq('school_id', schoolId)
    .maybeSingle()
  const slip = slipRow as {
    id: string
    title: string
    description: string | null
    due_date: string | null
    created_at: string
    audience_type: PermissionSlipAudience
    class_id: string | null
    classes: { name: string } | null
  } | null
  if (!slip) return null

  let studentQuery = adminClient
    .from('students')
    .select('id, first_name, last_name, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
  if (slip.audience_type === 'class' && slip.class_id) {
    studentQuery = studentQuery.eq('class_id', slip.class_id)
  }
  const { data: studentData } = await studentQuery
  const students =
    (studentData as
      | { id: string; first_name: string; last_name: string; classes: { name: string } | null }[]
      | null) ?? []

  const { data: respData } = await adminClient
    .from('permission_slip_responses')
    .select('student_id, consent, note, responded_at')
    .eq('slip_id', slipId)
  const respByStudent = new Map(
    (
      (respData as
        | { student_id: string; consent: boolean; note: string | null; responded_at: string }[]
        | null) ?? []
    ).map((r) => [r.student_id, r]),
  )

  const rows: SlipStudentResponse[] = students.map((s) => {
    const r = respByStudent.get(s.id)
    return {
      studentId: s.id,
      name: `${s.first_name} ${s.last_name}`,
      className: s.classes?.name ?? null,
      consent: r ? r.consent : null,
      note: r?.note ?? null,
      respondedAt: r?.responded_at ?? null,
    }
  })

  return {
    id: slip.id,
    title: slip.title,
    description: slip.description,
    dueDate: slip.due_date,
    audienceLabel:
      slip.audience_type === 'school' ? 'Whole school' : (slip.classes?.name ?? 'Class'),
    createdAt: slip.created_at,
    students: rows,
    tally: tallyResponses(
      rows.length,
      rows.filter((r) => r.consent !== null).map((r) => ({ consent: r.consent as boolean })),
    ),
  }
}
