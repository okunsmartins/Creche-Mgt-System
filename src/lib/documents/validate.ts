import { safeFilenameBase } from '@/lib/assignments/validate'
import type { DocumentCategory } from '@/types/database'

/** The private bucket staff-uploaded student documents live in. */
export const DOCUMENT_BUCKET = 'student-documents'

/** Human labels per category. */
export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  test_result: 'Test result',
  report_card: 'Report card',
}

export function isDocumentCategory(v: string): v is DocumentCategory {
  return v === 'test_result' || v === 'report_card'
}

/**
 * Object path within the private bucket, namespaced by tenant + student +
 * category so paths never collide and a cascade delete cleans up predictably:
 * `{schoolId}/{studentId}/{category}/{timestamp}-{slug}.{ext}`.
 */
export function documentStoragePath(params: {
  schoolId: string
  studentId: string
  category: DocumentCategory
  originalName: string
  ext: string
  now?: number
}): string {
  const ts = params.now ?? Date.now()
  const slug = safeFilenameBase(params.originalName)
  return `${params.schoolId}/${params.studentId}/${params.category}/${ts}-${slug}.${params.ext}`
}
