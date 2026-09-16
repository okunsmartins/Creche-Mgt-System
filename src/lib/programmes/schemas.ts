import { z } from 'zod'

const euroAmountSchema = z
  .string({ required_error: 'Enter an amount' })
  .min(1, 'Enter an amount')
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v.trim()), {
    message: 'Enter a valid amount in euros (e.g. 5.00)',
  })
  .transform((v) => Math.round(parseFloat(v.trim()) * 100))

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined))

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

// Shared fields defined as ZodObject so .extend() works before superRefine
const programmeFieldsSchema = z.object({
  name: z
    .string({ required_error: 'Enter a programme name' })
    .min(1, 'Enter a programme name')
    .max(200, 'Programme name is too long (max 200 characters)'),
  description: z
    .string()
    .max(2000, 'Description too long (max 2,000 characters)')
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  priceEuros: euroAmountSchema,
  pricingModel: z.enum(['per_term', 'per_month', 'per_session'], {
    required_error: 'Select a pricing model',
    invalid_type_error: 'Invalid pricing model',
  }),
  daysOfWeek: z
    .array(z.enum(DAYS, { invalid_type_error: 'Invalid day' }))
    .min(1, 'Select at least one session day'),
  sessionTime: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  termStart: optionalDate,
  termEnd: optionalDate,
  maxEnrolments: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || !v.trim()) return undefined
      const n = parseInt(v.trim(), 10)
      return isNaN(n) ? undefined : n
    })
    .pipe(z.number().int().positive('Max enrolments must be a positive whole number').optional()),
  classIds: z
    .array(z.string().uuid('Invalid class ID'))
    .min(1, 'Select at least one eligible class'),
})

function refineProgrammeFields(
  data: { termStart?: string | undefined; termEnd?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (data.termStart && data.termEnd && new Date(data.termEnd) <= new Date(data.termStart)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Term end must be after term start',
      path: ['termEnd'],
    })
  }
}

export const createProgrammeSchema = programmeFieldsSchema.superRefine(refineProgrammeFields)

export const updateProgrammeSchema = programmeFieldsSchema
  .extend({ programmeId: z.string().uuid('Invalid programme ID') })
  .superRefine(refineProgrammeFields)

export const publishProgrammeSchema = z.object({
  programmeId: z.string().uuid('Invalid programme ID'),
})

export const closeProgrammeSchema = z.object({
  programmeId: z.string().uuid('Invalid programme ID'),
})

export const archiveProgrammeSchema = z.object({
  programmeId: z.string().uuid('Invalid programme ID'),
})

export type ProgrammeActionState = {
  error?: string | undefined
  fieldErrors?: Partial<Record<string, string | undefined>> | undefined
  success?: boolean | undefined
  message?: string | undefined
} | null
