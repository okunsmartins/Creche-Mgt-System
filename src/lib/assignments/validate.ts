import type { AssignmentFileKind } from '@/types/database'

/** Max upload size for a single assignment file (10 MB). */
export const ASSIGNMENT_MAX_BYTES = 10 * 1024 * 1024

/** The private storage bucket assignment files live in. */
export const ASSIGNMENT_BUCKET = 'student-assignments'

/** How long a generated view link stays valid (seconds). */
export const ASSIGNMENT_SIGNED_URL_TTL = 60 * 10 // 10 minutes

/** Accepted upload MIME types → their storage kind + canonical extension. */
const ACCEPTED: Record<string, { kind: AssignmentFileKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/heic': { kind: 'image', ext: 'heic' },
  'image/heif': { kind: 'image', ext: 'heic' },
  'application/pdf': { kind: 'pdf', ext: 'pdf' },
}

/** The `accept` attribute for the upload input — a photo (any image) or a PDF. */
export const ASSIGNMENT_ACCEPT = 'image/*,application/pdf'

/** Resolve an upload MIME type to its storage kind + extension, or null if unsupported. */
export function acceptedAssignmentType(
  mime: string,
): { kind: AssignmentFileKind; ext: string } | null {
  return ACCEPTED[mime] ?? null
}

/** True when the MIME type is an accepted image or PDF. */
export function isAllowedAssignmentType(mime: string): boolean {
  return acceptedAssignmentType(mime) !== null
}

/** Reader-friendly noun for a file kind, e.g. "a photo" / "a PDF". */
export function assignmentKindPhrase(kind: AssignmentFileKind): string {
  return kind === 'image' ? 'a photo' : 'a PDF'
}

/** Human-readable file size, e.g. "2.4 MB" / "812 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

/** Strip a user-supplied filename down to a safe lowercase slug (no extension). */
export function safeFilenameBase(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase()
  const slug = base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'assignment'
}

/**
 * Object path within the private bucket, namespaced by tenant + student so a
 * cascade delete of either cleans up predictably and paths never collide:
 * `{schoolId}/{studentId}/{timestamp}-{slug}.{ext}`.
 */
export function assignmentStoragePath(params: {
  schoolId: string
  studentId: string
  originalName: string
  ext: string
  now?: number
}): string {
  const ts = params.now ?? Date.now()
  const slug = safeFilenameBase(params.originalName)
  return `${params.schoolId}/${params.studentId}/${ts}-${slug}.${params.ext}`
}
