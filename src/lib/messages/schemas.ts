import { z } from 'zod'

// Audience is a discriminated union so the required id travels with each variant.
// 'school' (all parents in the school) is admin-only — enforced in the action.
export const parentMessageSchema = z.object({
  // .trim() applies before the length checks, so whitespace-only is rejected.
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(150, 'Subject must be 150 characters or fewer'),
  body: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(5000, 'Message must be 5000 characters or fewer'),
  audience: z.discriminatedUnion('type', [
    z.object({ type: z.literal('class'), classId: z.string().uuid('Select a class') }),
    z.object({ type: z.literal('student'), studentId: z.string().uuid('Select a pupil') }),
    z.object({ type: z.literal('school') }),
  ]),
})

export type ParentMessageValues = z.infer<typeof parentMessageSchema>
export type ParentMessageAudienceInput = ParentMessageValues['audience']

export type ParentMessageActionState =
  | null
  | { error: string }
  | { success: true; recipientCount: number }
