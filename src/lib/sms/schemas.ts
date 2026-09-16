import { z } from 'zod'

// SMS has no subject. Body capped at 640 chars (~4 segments) to bound per-message
// cost. Audience mirrors the email feature's discriminated union.
export const parentSmsSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(640, 'Message must be 640 characters or fewer'),
  audience: z.discriminatedUnion('type', [
    z.object({ type: z.literal('class'), classId: z.string().uuid('Select a class') }),
    z.object({ type: z.literal('student'), studentId: z.string().uuid('Select a pupil') }),
    z.object({ type: z.literal('school') }),
  ]),
})

export type ParentSmsValues = z.infer<typeof parentSmsSchema>

export type SmsActionState =
  | null
  | { error: string }
  | {
      success: true
      sent: number
      failed: number
      noPhone: number
      optedOut: number
      creditsCharged: number
    }
