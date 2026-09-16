import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ASSIGNMENT_SIGNED_URL_TTL } from '@/lib/assignments/validate'
import { DOCUMENT_BUCKET } from './validate'
import type { AssignmentFileKind, DocumentCategory } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface DocumentView {
  id: string
  title: string | null
  term: string | null
  fileKind: AssignmentFileKind
  fileSizeBytes: number
  originalFilename: string | null
  createdAt: string
  /** Short-lived signed URL; null if signing failed. */
  url: string | null
}

/** One child and their documents of a given category (newest first). */
export interface ChildDocuments {
  studentId: string
  firstName: string
  lastName: string
  className: string | null
  documents: DocumentView[]
}

const DOCUMENT_SELECT =
  'id, student_id, title, term, file_kind, file_path, file_size_bytes, original_filename, created_at'

type DocumentRow = {
  id: string
  student_id: string
  title: string | null
  term: string | null
  file_kind: AssignmentFileKind
  file_path: string
  file_size_bytes: number
  original_filename: string | null
  created_at: string
}

async function signDocuments(
  adminClient: AdminClient,
  rows: DocumentRow[],
): Promise<DocumentView[]> {
  if (rows.length === 0) return []
  const signedByPath = new Map<string, string>()
  const { data: signed } = await adminClient.storage.from(DOCUMENT_BUCKET).createSignedUrls(
    rows.map((r) => r.file_path),
    ASSIGNMENT_SIGNED_URL_TTL,
  )
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl)
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    term: r.term,
    fileKind: r.file_kind,
    fileSizeBytes: r.file_size_bytes,
    originalFilename: r.original_filename,
    createdAt: r.created_at,
    url: signedByPath.get(r.file_path) ?? null,
  }))
}

/**
 * Documents of one category for a single student (newest first), scoped by
 * school — used by the staff student-detail sections. Behind the admin guard.
 */
export async function getStudentDocuments(
  studentId: string,
  category: DocumentCategory,
  schoolId: string,
): Promise<DocumentView[]> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('student_documents')
    .select(DOCUMENT_SELECT)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('category', category)
    .order('created_at', { ascending: false })
  return signDocuments(adminClient, (data as DocumentRow[] | null) ?? [])
}

/**
 * Documents of one category for every child actively linked to this parent
 * (children with none are included). Scoped via parent_student_links; only
 * reachable behind the parent guard.
 */
export async function getParentChildrenDocuments(
  parentId: string,
  category: DocumentCategory,
): Promise<ChildDocuments[]> {
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

  const { data: docData } = await adminClient
    .from('student_documents')
    .select(DOCUMENT_SELECT + ', student_id')
    .in(
      'student_id',
      children.map((c) => c.id),
    )
    .eq('category', category)
    .order('created_at', { ascending: false })
  const rows = (docData as DocumentRow[] | null) ?? []
  const views = await signDocuments(adminClient, rows)

  const byStudent = new Map<string, DocumentView[]>()
  for (let i = 0; i < rows.length; i++) {
    const sid = rows[i]!.student_id
    const list = byStudent.get(sid) ?? []
    list.push(views[i]!)
    byStudent.set(sid, list)
  }

  return children.map((c) => ({
    studentId: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    className: c.classes?.name ?? null,
    documents: byStudent.get(c.id) ?? [],
  }))
}
