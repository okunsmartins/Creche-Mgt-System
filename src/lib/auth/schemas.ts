import { z } from 'zod'
import { normalizeIrishMobile } from '@/lib/sms/phone'

const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters required')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')

// Optional mobile at sign-up. Empty → null; when given it must be a valid Irish
// mobile and is stored normalised to E.164 (the form the SMS sender uses), so a
// parent who adds their number here can be texted straight away.
const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || normalizeIrishMobile(v) !== null, {
    message: 'Enter a valid Irish mobile (e.g. 087 123 4567)',
  })
  .transform((v) => (v === '' ? null : normalizeIrishMobile(v)))

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(50, 'Max 50 characters'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Max 50 characters'),
    email: z.string().email('Enter a valid email address'),
    phone: optionalPhone,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// Shared action result type used by all auth server actions
export type AuthActionState = {
  error?: string | undefined
  fieldErrors?: Partial<Record<string, string | undefined>> | undefined
  success?: boolean | undefined
  message?: string | undefined
} | null
