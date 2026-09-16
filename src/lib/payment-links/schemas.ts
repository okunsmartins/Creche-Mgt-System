import { z } from 'zod'

export const paymentLinkSchema = z.object({
  activityId: z.string().uuid('Please select a valid activity'),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(200, 'Label must be 200 characters or fewer')
    .transform((v) => v.trim()),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))
    .pipe(
      z
        .string()
        .datetime({ offset: true })
        .optional()
        .refine((v) => v === undefined || new Date(v) > new Date(), {
          message: 'Expiry date must be in the future',
        }),
    ),
  maxUses: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? parseInt(v.trim(), 10) : undefined))
    .pipe(z.number().int().min(1, 'Maximum uses must be at least 1').optional()),
  isActive: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
})

export type PaymentLinkFormValues = z.infer<typeof paymentLinkSchema>

export type PaymentLinkActionState =
  | null
  | {
      error: string
      fieldErrors?: Partial<Record<keyof PaymentLinkFormValues, string | undefined>>
    }
  | { success: true; linkId: string }
