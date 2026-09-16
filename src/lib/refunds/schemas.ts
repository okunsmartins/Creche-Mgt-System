import { z } from 'zod'

export const initiateRefundSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  paymentId: z.string().uuid('Invalid payment ID'),
  amountEuros: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 10 or 10.50)')
    .transform((v) => Math.round(parseFloat(v) * 100)),
  reason: z.string().min(3, 'Reason is required').max(500, 'Reason must be under 500 characters'),
})

export type RefundActionState = {
  success?: boolean
  error?: string
  refundedAmountCents?: number
} | null
