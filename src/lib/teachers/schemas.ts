import { z } from 'zod'

export const teacherSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or fewer')
    .transform((v) => v.trim()),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or fewer')
    .transform((v) => v.trim()),
  displayName: z
    .string()
    .max(100, 'Display name must be 100 characters or fewer')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v?.trim())),
  email: z
    .string()
    .max(254, 'Email must be 254 characters or fewer')
    .email('Please enter a valid email address')
    .toLowerCase()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  isActive: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
})

export type TeacherFormValues = z.infer<typeof teacherSchema>

export type TeacherActionState =
  | null
  | { error: string; fieldErrors?: Partial<Record<keyof TeacherFormValues, string | undefined>> }
  | { success: true; teacherId: string }
