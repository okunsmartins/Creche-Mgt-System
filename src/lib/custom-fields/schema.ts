import { z } from 'zod'

// CF-01 (Layer 3 of dynamic-onboarding-fields.md). Pure, server-authoritative
// logic for tenant-defined custom fields: value validation by type, the
// promotion type-contract (what a field must be to feed billing / dashboard /
// reporting / filter / messaging / compliance), sensitive-key blocking and slug
// generation. No DB access — mirrors the lib/payments pure-module style.
//
// Guardrail: a custom field may only be PROMOTED into money/NCS/compliance logic
// if it satisfies the type contract here. That is how an untyped note becomes a
// trustworthy input without turning the fee engine into "it depends".

export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'dropdown',
  'radio',
  'checkbox',
  'multiselect',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const CUSTOM_FIELD_ENTITIES = ['child', 'parent', 'staff', 'room'] as const
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number]

export const PROMOTION_TARGETS = [
  'billing',
  'dashboard',
  'reporting',
  'filter',
  'messaging',
  'compliance',
] as const
export type PromotionTarget = (typeof PROMOTION_TARGETS)[number]

const OPTION_TYPES: readonly FieldType[] = ['dropdown', 'radio', 'multiselect']
/** Field types that carry a fixed option list. */
export function isOptionType(t: FieldType): boolean {
  return OPTION_TYPES.includes(t)
}

export interface CustomFieldDefinition {
  entity: CustomFieldEntity
  key: string
  label: string
  fieldType: FieldType
  options?: string[]
  required?: boolean
  promotedTo?: PromotionTarget[]
  affectsBilling?: boolean
}

// ─── Slug + sensitive-key handling ────────────────────────────────────────────

/** Turn a human label into a safe snake_case key (leading digit gets prefixed). */
export function slugifyKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!slug) return 'field'
  return /^[0-9]/.test(slug) ? `f_${slug}` : slug
}

// Keys/labels that must never be stored as a free custom field (they belong in
// the protected, encrypted core fields, or must not be collected at all).
const SENSITIVE_PATTERNS = [
  /\bppsn?\b/i,
  /\bpps[\s_-]*(no|number)?\b/i,
  /passport/i,
  /\biban\b/i,
  /\b(card|cvv|cvc)\b/i,
  /password|passcode|\bpin\b/i,
  /\bsort[\s_-]*code\b/i,
]

/** True when a field name/label looks like sensitive data that must not live in a custom field. */
export function isSensitiveKey(nameOrLabel: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(nameOrLabel))
}

// ─── Value validation ─────────────────────────────────────────────────────────

export type ValueResult =
  | { ok: true; value: string | number | boolean | string[] | null }
  | { ok: false; error: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DMY_DATE = /^\d{2}\/\d{2}\/\d{4}$/

function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')
}

/**
 * Validate/coerce a raw value against a definition. Blank is allowed unless the
 * field is required. Returns the normalised value or a plain-language error.
 */
export function validateCustomFieldValue(def: CustomFieldDefinition, raw: unknown): ValueResult {
  if (isBlank(raw)) {
    return def.required ? { ok: false, error: `${def.label} is required` } : { ok: true, value: null }
  }
  const options = def.options ?? []

  switch (def.fieldType) {
    case 'text':
      return { ok: true, value: String(raw).trim() }

    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
      return Number.isFinite(n)
        ? { ok: true, value: n }
        : { ok: false, error: `${def.label} must be a number` }
    }

    case 'date': {
      const s = String(raw).trim()
      return ISO_DATE.test(s) || DMY_DATE.test(s)
        ? { ok: true, value: s }
        : { ok: false, error: `${def.label} must be a date (YYYY-MM-DD or DD/MM/YYYY)` }
    }

    case 'checkbox': {
      if (typeof raw === 'boolean') return { ok: true, value: raw }
      const s = String(raw).trim().toLowerCase()
      if (['true', 'yes', 'y', '1'].includes(s)) return { ok: true, value: true }
      if (['false', 'no', 'n', '0'].includes(s)) return { ok: true, value: false }
      return { ok: false, error: `${def.label} must be Yes or No` }
    }

    case 'dropdown':
    case 'radio': {
      const s = String(raw).trim()
      return options.includes(s)
        ? { ok: true, value: s }
        : { ok: false, error: `${def.label} must be one of: ${options.join(', ')}` }
    }

    case 'multiselect': {
      const parts = Array.isArray(raw)
        ? raw.map((v) => String(v).trim())
        : String(raw)
            .split(/[;,]/)
            .map((v) => v.trim())
            .filter(Boolean)
      const invalid = parts.filter((p) => !options.includes(p))
      return invalid.length === 0
        ? { ok: true, value: parts }
        : { ok: false, error: `${def.label}: not valid options: ${invalid.join(', ')}` }
    }

    default:
      return { ok: false, error: `Unknown field type for ${def.label}` }
  }
}

// ─── Promotion type-contract ──────────────────────────────────────────────────

/** Which field types each promotion target will accept. */
const PROMOTION_CONTRACT: Record<PromotionTarget, readonly FieldType[]> = {
  billing: ['number'], // money math needs a real number
  dashboard: ['number', 'date', 'dropdown', 'radio'],
  reporting: [...FIELD_TYPES], // any typed field can appear in a report
  filter: ['dropdown', 'radio', 'checkbox', 'multiselect'],
  messaging: ['text', 'number', 'date', 'dropdown', 'radio'],
  compliance: ['date', 'dropdown', 'radio'], // e.g. expiry dates / status enums
}

/** Whether a field may be promoted into a given target, with a reason when not. */
export function canPromoteTo(
  def: CustomFieldDefinition,
  target: PromotionTarget,
): { ok: true } | { ok: false; reason: string } {
  // Sensitive data may never be promoted into messaging (leaks) or reporting/export.
  if (isSensitiveKey(def.label) || isSensitiveKey(def.key)) {
    if (target === 'messaging' || target === 'reporting') {
      return { ok: false, reason: 'Sensitive fields cannot be promoted into messaging or reports' }
    }
  }
  const allowed = PROMOTION_CONTRACT[target]
  if (!allowed.includes(def.fieldType)) {
    return {
      ok: false,
      reason: `A "${def.fieldType}" field cannot feed ${target}; needs one of: ${allowed.join(', ')}`,
    }
  }
  return { ok: true }
}

// ─── Definition creation schema ───────────────────────────────────────────────

export const customFieldDefinitionSchema = z
  .object({
    entity: z.enum(CUSTOM_FIELD_ENTITIES),
    label: z.string().trim().min(1, 'Label is required').max(60, 'Must be 60 characters or fewer'),
    fieldType: z.enum(FIELD_TYPES),
    options: z.array(z.string().trim().min(1)).max(50).optional(),
    required: z.boolean().optional(),
    promotedTo: z.array(z.enum(PROMOTION_TARGETS)).optional(),
    affectsBilling: z.boolean().optional(),
  })
  .refine((d) => !isSensitiveKey(d.label), {
    message: 'This looks like sensitive data (e.g. PPSN) — use a secure core field, not a custom field',
    path: ['label'],
  })
  .refine((d) => !isOptionType(d.fieldType) || (d.options?.length ?? 0) > 0, {
    message: 'Dropdown / radio / multiselect fields need at least one option',
    path: ['options'],
  })

export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionSchema>
