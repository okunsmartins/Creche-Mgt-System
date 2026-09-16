import { z } from 'zod'

// Pupil payment codes: a 2–4 char per-school PREFIX, a hyphen, then 8 chars
// from the set [A-HJ-NP-Z2-9] (I, O, 0, 1 excluded to avoid visual ambiguity).
// The prefix is derived per school (migration 037), e.g. SB-XXXXXXXX, SPP-XXXXXXXX.
export const PUPIL_CODE_RE = /^[A-Z0-9]{2,4}-[A-HJ-NP-Z2-9]{8}$/
const pupilCodeSchema = z
  .string({ required_error: "Enter your child's payment code" })
  .min(1, "Enter your child's payment code")
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => PUPIL_CODE_RE.test(v), {
    message: 'Enter a valid pupil code (e.g. SPP-XXXXXXXX)',
  })

const payerNameSchema = z
  .string({ required_error: 'Enter your name' })
  .min(1, 'Enter your name')
  .max(200, 'Name too long (max 200 characters)')
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, 'Enter your name')

const payerEmailSchema = z
  .string({ required_error: 'Enter your email address' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')

// ─── Shared: parse a hidden JSON input into an array ──────────────────────────
// Used for the basket/activityIds hidden form fields.

function jsonArrayField(label: string) {
  return z.string({ required_error: `No ${label} selected` }).transform((val, ctx) => {
    try {
      const parsed: unknown = JSON.parse(val)
      if (!Array.isArray(parsed)) {
        ctx.addIssue({ code: 'custom', message: `Invalid ${label} data` })
        return z.NEVER
      }
      return parsed
    } catch {
      ctx.addIssue({ code: 'custom', message: `Invalid ${label} data` })
      return z.NEVER
    }
  })
}

// ─── Pupil code lookup (step 1 of guest flow) ─────────────────────────────────

export const lookupPupilSchema = z.object({
  pupilCode: pupilCodeSchema,
})

// ─── Shared: guest basket item schema (no studentId — single child per basket) ─

const guestBasketItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('activity'),
    activityId: z.string().uuid('Invalid activity'),
  }),
  z.object({
    kind: z.literal('programme'),
    programmeId: z.string().uuid('Invalid programme'),
  }),
])

const guestBasketField = jsonArrayField('basket').pipe(
  z.array(guestBasketItemSchema).min(1, 'Your basket is empty').max(20, 'Too many items in basket'),
)

// ─── Guest order via verified pupil code (mixed activity + programme basket) ──
// basket is a JSON string of discriminated basket items

export const guestCodeOrderSchema = z.object({
  payerName: payerNameSchema,
  payerEmail: payerEmailSchema,
  pupilCode: pupilCodeSchema,
  basket: guestBasketField,
})

// ─── Guest order via manual child entry (mixed activity + programme basket) ───

export const guestManualOrderSchema = z.object({
  payerName: payerNameSchema,
  payerEmail: payerEmailSchema,
  childFirstName: z
    .string({ required_error: "Enter your child's first name" })
    .min(1, "Enter your child's first name")
    .max(100, 'First name too long')
    .transform((v) => v.trim()),
  childLastName: z
    .string({ required_error: "Enter your child's last name" })
    .min(1, "Enter your child's last name")
    .max(100, 'Last name too long')
    .transform((v) => v.trim()),
  childClassId: z
    .string({ required_error: "Select your child's class" })
    .uuid("Select your child's class"),
  basket: guestBasketField,
})

// ─── Registered parent order (multi-item basket) ──────────────────────────────
// basket is a JSON string of discriminated basket items:
//   { kind: 'activity'; studentId: string; activityId: string }
// | { kind: 'programme'; studentId: string; programmeId: string }

export const parentOrderSchema = z.object({
  basket: jsonArrayField('basket').pipe(
    z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('activity'),
            studentId: z.string().uuid('Invalid student'),
            activityId: z.string().uuid('Invalid activity'),
          }),
          z.object({
            kind: z.literal('programme'),
            studentId: z.string().uuid('Invalid student'),
            programmeId: z.string().uuid('Invalid programme'),
          }),
        ]),
      )
      .min(1, 'Your basket is empty')
      .max(20, 'Too many items in basket'),
  ),
})

// ─── Shared action state types ────────────────────────────────────────────────

export type LookupPupilState = {
  error?: string | undefined
  success?: boolean | undefined
  studentFirstName?: string | undefined
  className?: string | undefined
} | null

export type OrderActionState = {
  error?: string | undefined
  fieldErrors?: Partial<Record<string, string | undefined>> | undefined
  orderId?: string | undefined
} | null
