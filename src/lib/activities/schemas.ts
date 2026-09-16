import { z } from 'zod'

const euroAmountSchema = z
  .string({ required_error: 'Enter an amount' })
  .min(1, 'Enter an amount')
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v.trim()), {
    message: 'Enter a valid amount in euros (e.g. 5.00)',
  })
  .transform((v) => Math.round(parseFloat(v.trim()) * 100))

const optionalDatetime = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined))

// Shared fields — defined as a ZodObject so .extend() works before adding refinements
const activityFieldsSchema = z.object({
  name: z
    .string({ required_error: 'Enter an activity name' })
    .min(1, 'Enter an activity name')
    .max(200, 'Activity name is too long (max 200 characters)'),
  description: z
    .string()
    .max(2000, 'Description too long (max 2,000 characters)')
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  amountEuros: euroAmountSchema,
  accountingCode: z
    .string()
    .max(50, 'Accounting code too long')
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  opensAt: optionalDatetime,
  closesAt: optionalDatetime,
  classIds: z.array(z.string().uuid('Invalid class ID')),
  pupilIds: z.array(z.string().uuid('Invalid student ID')).default([]),
})

// Shared cross-field validation: require at least one class or pupil, and validate date range.
// Used by both createActivitySchema and updateActivitySchema via superRefine.
function refineActivityFields(
  data: {
    classIds: string[]
    pupilIds: string[]
    opensAt?: string | undefined
    closesAt?: string | undefined
  },
  ctx: z.RefinementCtx,
): void {
  if (data.classIds.length === 0 && data.pupilIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one eligible class or pupil',
      path: ['classIds'],
    })
  }
  if (data.opensAt && data.closesAt && new Date(data.closesAt) <= new Date(data.opensAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Closing date must be after opening date',
      path: ['closesAt'],
    })
  }
}

export const createActivitySchema = activityFieldsSchema.superRefine(refineActivityFields)

// .extend() is called on the ZodObject before .superRefine() to avoid ZodEffects.extend() error
export const updateActivitySchema = activityFieldsSchema
  .extend({ activityId: z.string().uuid('Invalid activity ID') })
  .superRefine(refineActivityFields)

export const publishActivitySchema = z.object({
  activityId: z.string().uuid('Invalid activity ID'),
})

export const archiveActivitySchema = z.object({
  activityId: z.string().uuid('Invalid activity ID'),
})

export const closeActivitySchema = z.object({
  activityId: z.string().uuid('Invalid activity ID'),
})

export type ActivityActionState = {
  error?: string | undefined
  fieldErrors?: Partial<Record<string, string | undefined>> | undefined
  success?: boolean | undefined
  message?: string | undefined
  warning?: string | undefined
} | null
