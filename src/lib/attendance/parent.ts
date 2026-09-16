import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { aggregateAttendance, latestFlags, type StudentAttendanceSummary } from './summary'
import type { AttendanceStatus } from '@/types/database'

const RECENT_FLAG_LIMIT = 20

/** A recent late/absent day the parent can attach a reason to. */
export interface ParentAttendanceFlag {
  recordId: string
  date: string
  status: 'late' | 'absent'
  /** The teacher's note on the record (read-only for parents). */
  note: string | null
  /** The parent's own reason, if already entered. */
  parentReason: string | null
}

export interface ChildAttendance {
  className: string | null
  summary: StudentAttendanceSummary
  /** Recent days the child was late or absent, newest first. */
  recentFlags: ParentAttendanceFlag[]
}

type LinkRow = {
  students: {
    id: string
    first_name: string
    last_name: string
    classes: { name: string } | null
  } | null
}

type RecordRow = {
  id: string
  student_id: string
  status: AttendanceStatus
  note: string | null
  parent_reason: string | null
  attendance_sessions: { session_date: string } | null
}

/**
 * Attendance for every child actively linked to this parent: an all-time
 * present/late/absent summary (late counts as present) plus their recent
 * late/absent days. Scoped to the parent via parent_student_links; only
 * reachable behind the parent guard.
 */
export async function getParentChildrenAttendance(parentId: string): Promise<ChildAttendance[]> {
  const adminClient = createSupabaseAdminClient()

  const { data: linkData } = await adminClient
    .from('parent_student_links')
    .select('students(id, first_name, last_name, classes(name))')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('created_at')
  const children = ((linkData as LinkRow[] | null) ?? [])
    .map((l) => l.students)
    .filter((s): s is NonNullable<LinkRow['students']> => s !== null)
  if (children.length === 0) return []

  const studentIds = children.map((c) => c.id)
  const { data: recData } = await adminClient
    .from('attendance_records')
    .select('id, student_id, status, note, parent_reason, attendance_sessions(session_date)')
    .in('student_id', studentIds)
  const records = (recData as RecordRow[] | null) ?? []

  const summaries = aggregateAttendance(
    children.map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name })),
    records.map((r) => ({ student_id: r.student_id, status: r.status })),
  )
  const summaryById = new Map(summaries.map((s) => [s.studentId, s]))

  // Collect late/absent days per child.
  const flagsByChild = new Map<string, ParentAttendanceFlag[]>()
  for (const r of records) {
    if (r.status === 'present') continue
    const date = r.attendance_sessions?.session_date
    if (!date) continue
    const list = flagsByChild.get(r.student_id) ?? []
    list.push({
      recordId: r.id,
      date,
      status: r.status,
      note: r.note,
      parentReason: r.parent_reason,
    })
    flagsByChild.set(r.student_id, list)
  }

  return children.map((c) => ({
    className: c.classes?.name ?? null,
    // Every child has a summary (aggregateAttendance is roster-anchored).
    summary: summaryById.get(c.id)!,
    recentFlags: latestFlags(flagsByChild.get(c.id) ?? [], RECENT_FLAG_LIMIT),
  }))
}
