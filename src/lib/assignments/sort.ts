import type { AssignmentFileKind } from '@/types/database'

export interface AssignmentView {
  id: string
  title: string | null
  fileKind: AssignmentFileKind
  fileSizeBytes: number
  originalFilename: string | null
  createdAt: string
  /** Short-lived signed URL to view/download the file; null if signing failed. */
  url: string | null
}

/** One student and the assignments uploaded for them (newest first). */
export interface StudentSubmissions {
  studentId: string
  firstName: string
  lastName: string
  className: string | null
  assignments: AssignmentView[]
}

/** Back-compat alias for the parent-facing shape. */
export type ChildAssignments = StudentSubmissions

/**
 * Sort students by their newest upload, most recent first. Assumes each
 * student's `assignments` are already newest-first, so index 0 is their latest.
 * Pure — unit-tested.
 */
export function orderByRecentSubmission(students: StudentSubmissions[]): StudentSubmissions[] {
  return [...students].sort((a, b) => {
    const at = a.assignments[0]?.createdAt ?? ''
    const bt = b.assignments[0]?.createdAt ?? ''
    return bt.localeCompare(at)
  })
}
