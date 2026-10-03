// Learning journals / child observations (migration 083). Pure catalog + validation
// + storage helpers — no DB, safe for client, server and tests.

// ── Aistear themes ────────────────────────────────────────────────────────────
// Ireland's early-childhood curriculum framework has four themes; an observation
// may be tagged against any subset of them.
export const AISTEAR_THEMES = [
  'well_being',
  'identity_belonging',
  'communicating',
  'exploring_thinking',
] as const
export type AistearTheme = (typeof AISTEAR_THEMES)[number]

export const AISTEAR_THEME_LABELS: Record<AistearTheme, string> = {
  well_being: 'Well-being',
  identity_belonging: 'Identity & Belonging',
  communicating: 'Communicating',
  exploring_thinking: 'Exploring & Thinking',
}

export function isAistearTheme(v: string): v is AistearTheme {
  return (AISTEAR_THEMES as readonly string[]).includes(v)
}

/** Keep only valid themes, de-duplicated and in canonical (catalog) order. */
export function normaliseThemes(themes: ReadonlyArray<string>): AistearTheme[] {
  const set = new Set(themes.filter(isAistearTheme))
  return AISTEAR_THEMES.filter((t) => set.has(t))
}

export function themeLabels(themes: ReadonlyArray<string>): string[] {
  return normaliseThemes(themes).map((t) => AISTEAR_THEME_LABELS[t])
}

// ── Photo attachment ──────────────────────────────────────────────────────────
/** Max size for an observation photo (10 MB). */
export const OBSERVATION_MAX_BYTES = 10 * 1024 * 1024
/** Private storage bucket observation photos live in. */
export const OBSERVATION_BUCKET = 'child-observations'
/** How long a generated view link stays valid (seconds). */
export const OBSERVATION_SIGNED_URL_TTL = 60 * 10 // 10 minutes
/** `accept` attribute for the photo input — images only (observations attach a photo). */
export const OBSERVATION_ACCEPT = 'image/*'

const ACCEPTED_IMAGE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
}

/** Canonical extension for an accepted image MIME type, or null if unsupported. */
export function acceptedImageExt(mime: string): string | null {
  return ACCEPTED_IMAGE[mime] ?? null
}

/** Strip a filename to a safe lowercase slug (no extension). */
export function safePhotoBase(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase()
  const slug = base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'photo'
}

/**
 * Object path within the private bucket, namespaced by tenant + student so a
 * cascade delete cleans up predictably and paths never collide:
 * `{schoolId}/{studentId}/{timestamp}-{slug}.{ext}`.
 */
export function observationStoragePath(params: {
  schoolId: string
  studentId: string
  originalName: string
  ext: string
  now?: number
}): string {
  const ts = params.now ?? Date.now()
  return `${params.schoolId}/${params.studentId}/${ts}-${safePhotoBase(params.originalName)}.${params.ext}`
}

// ── Validation ────────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ObservationInput {
  title: string
  learningStory: string
  observationDate: string
  themes?: ReadonlyArray<string>
}

type Result = { ok: true } | { ok: false; error: string }

export function validateObservation(input: ObservationInput): Result {
  if (!input.title?.trim()) return { ok: false, error: 'A title is required.' }
  if (input.title.trim().length > 140)
    return { ok: false, error: 'Keep the title under 140 characters.' }
  if (!input.learningStory?.trim())
    return { ok: false, error: 'Write a short learning story / observation.' }
  if (!DATE_RE.test(input.observationDate ?? ''))
    return { ok: false, error: 'Enter a valid observation date.' }
  if (input.themes && input.themes.some((t) => !isAistearTheme(t)))
    return { ok: false, error: 'One or more selected themes are invalid.' }
  return { ok: true }
}
