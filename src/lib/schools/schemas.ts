import { z } from 'zod'

// Optional free-text field: treat blank/whitespace-only input as "not provided"
// so the DB stores NULL rather than an empty string.
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `Must be ${max} characters or fewer`).optional(),
  )

export const updateSchoolSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'School name is required')
    .max(200, 'Must be 200 characters or fewer'),
  rollNumber: optionalText(20),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().email('Enter a valid email address').max(255).optional(),
  ),
  phone: optionalText(30),
  website: optionalText(255),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  county: optionalText(100),
  eircode: optionalText(20),
})

export type SchoolSettingsField = keyof z.infer<typeof updateSchoolSettingsSchema>

export type SchoolSettingsActionState = {
  success?: boolean | undefined
  message?: string | undefined
  error?: string | undefined
  fieldErrors?: Partial<Record<SchoolSettingsField, string | undefined>> | undefined
} | null

// ─── Logo upload ────────────────────────────────────────────────────────────

/** Raster image types accepted for a school logo. SVG is excluded on purpose
 *  (an admin-supplied SVG can carry script; raster formats can't). */
export const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const LOGO_MAX_BYTES = 1024 * 1024 // 1 MB
export const LOGO_EXTENSIONS: Record<(typeof LOGO_ALLOWED_TYPES)[number], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type SchoolLogoActionState = {
  success?: boolean | undefined
  message?: string | undefined
  error?: string | undefined
} | null
