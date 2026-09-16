import { z } from 'zod'

// Shared action result type used by all student/link server actions
export type StudentActionState = {
  error?: string | undefined
  fieldErrors?: Partial<Record<string, string>> | undefined
  success?: boolean | undefined
  message?: string | undefined
} | null

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'Max 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Max 50 characters'),
  classId: z.string().uuid('Select a class'),
  parentFirstName: z.string().min(1, 'Parent first name is required').max(50, 'Max 50 characters'),
  parentLastName: z.string().min(1, 'Parent last name is required').max(50, 'Max 50 characters'),
  parentEmail: z.string().email('Enter a valid email address'),
})

export const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  firstName: z.string().min(1, 'First name is required').max(50, 'Max 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Max 50 characters'),
  classId: z.string().uuid('Select a class'),
})

// A 2–4 char per-school PREFIX, a hyphen, then 8 chars from [A-HJ-NP-Z2-9]
// (I, O, 0, 1 excluded). Prefix is derived per school (migration 037).
const PUPIL_CODE_RE = /^[A-Z0-9]{2,4}-[A-HJ-NP-Z2-9]{8}$/

export const linkRequestSchema = z.object({
  pupilCode: z
    .string()
    .min(1, 'Enter the pupil payment code')
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => PUPIL_CODE_RE.test(v), {
      message: 'Enter a valid pupil payment code (e.g. SPP-XXXXXXXX)',
    }),
})

export const rejectLinkRequestSchema = z.object({
  requestId: z.string().uuid(),
  rejectionReason: z
    .string()
    .min(1, 'Provide a reason for rejection')
    .max(500, 'Reason must be 500 characters or fewer'),
})

export const approveLinkRequestSchema = z.object({
  requestId: z.string().uuid(),
})

// Admin-initiated direct link — does not require a prior link request
export const adminLinkParentSchema = z.object({
  studentId: z.string().uuid(),
  parentEmail: z.string().email('Enter a valid email address'),
})

export const childSearchSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
})

export type ChildSearchResult = {
  studentId: string
  firstName: string
  lastInitial: string
  className: string | null
  status: 'available' | 'linked' | 'pending'
}

export type ChildSearchState = {
  results?: ChildSearchResult[]
  error?: string
  fieldErrors?: Partial<Record<string, string>>
  searched?: boolean
} | null

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type LinkRequestInput = z.infer<typeof linkRequestSchema>
export type ChildSearchInput = z.infer<typeof childSearchSchema>
