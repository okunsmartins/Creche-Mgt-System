import { z } from 'zod'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')

export const timeOffRequestSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    reason: z
      .string()
      .trim()
      .max(500, 'Reason must be 500 characters or fewer')
      .transform((v) => (v === '' ? undefined : v))
      .optional(),
  })
  .refine((data) => isRangeOrdered(data.startDate, data.endDate), {
    message: 'The end date cannot be before the start date.',
    path: ['endDate'],
  })

/** Pure: whether an end date is on or after the start date (both ISO yyyy-mm-dd). */
export function isRangeOrdered(startDate: string, endDate: string): boolean {
  return endDate >= startDate
}

export type TimeOffRequestValues = z.infer<typeof timeOffRequestSchema>

export type TimeOffActionState = null | { error: string } | { success: true }
export type TimeOffReviewState = null | { error: string } | { success: true }
