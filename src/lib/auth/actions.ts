'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { serverEnv } from '@/lib/env'
import { getTenantSubdomain, getTenantSchoolId } from '@/lib/tenant/server'
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AuthActionState,
} from './schemas'

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    // Generic message to prevent credential enumeration
    logger.warn('sign_in_failed', { reason: error.code })
    return { error: 'Invalid email or password. Please try again.' }
  }

  // FR-AUTH-006: log successful authentication without storing passwords or tokens
  logger.info('sign_in_success', {})

  const next = (formData.get('next') as string | null)?.trim()
  // Only allow relative redirects to prevent open redirect attacks
  if (next?.startsWith('/')) {
    redirect(next)
  }

  // No explicit next param — redirect admins to the admin dashboard,
  // everyone else to the parent dashboard.
  // NOTE: redirect() throws internally; keep it outside try/catch so the throw propagates.
  const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']
  let defaultPath = '/parent/dashboard'
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (authUser) {
      const adminClient = createSupabaseAdminClient()
      const { data: roleRows } = await adminClient
        .from('user_roles')
        .select('role_id')
        .eq('user_id', authUser.id)
      if (roleRows && roleRows.length > 0) {
        const roleIds = roleRows.map((r) => r.role_id)
        const { data: roleNames } = await adminClient.from('roles').select('name').in('id', roleIds)
        const isAdmin = (roleNames ?? []).some((r: { name: string }) =>
          ADMIN_ROLE_NAMES.includes(r.name),
        )
        const isTeacher = (roleNames ?? []).some((r: { name: string }) => r.name === 'teacher')
        if (isAdmin) defaultPath = '/admin/dashboard'
        else if (isTeacher) defaultPath = '/teacher/dashboard'
      }
    }
  } catch {
    // role lookup failed — use parent dashboard default
  }

  redirect(defaultPath)
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  }

  const result = registerSchema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        firstName: fieldErrors.firstName?.[0],
        lastName: fieldErrors.lastName?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    }
  }

  const { firstName, lastName, email, phone, password } = result.data
  const appUrl = serverEnv.appUrl

  // Resolve the school BEFORE sign-up. When this form was reached in a school's
  // context (via /s/<sub> or a subdomain) the signer is a PARENT joining that
  // school; with no tenant it's a prospective owner. We need this up front so the
  // email-confirmation link (which returns no session) lands on the right page.
  const tenantSubdomain = await getTenantSubdomain()
  const tenantSchoolId = tenantSubdomain ? await getTenantSchoolId() : null
  const confirmNext = tenantSchoolId ? '/parent/dashboard' : '/onboarding'

  const supabase = await createSupabaseServerClient()
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(confirmNext)}`,
    },
  })

  if (error) {
    logger.warn('sign_up_failed', { reason: error.code })
    // Generic error — never confirm whether the email is already registered
    // (anti-enumeration). The "sign in instead" hint is safe generic advice and
    // works for both the parent register and the create-a-portal flow.
    return {
      error:
        'Unable to create your account. If you already have an account with this email, please sign in instead.',
    }
  }

  // Persist optional profile fields on the newly-created row. The profile row
  // exists at sign-up (DB trigger) even when email confirmation is ON and no
  // session is returned, so this MUST run regardless of `signUpData.session` —
  // otherwise a parent who confirms via email link would land with no school_id
  // (no branding, "My Children" searches the wrong register). Guard the
  // anti-enumeration case: an already-registered email returns an obfuscated user
  // with an empty `identities` array — never touch that existing account.
  const isNewUser = (signUpData.user?.identities?.length ?? 0) > 0
  if (isNewUser && signUpData.user) {
    // A tenant subdomain that resolves to no ACTIVE school is not a tenant: leave
    // school_id null (owner path) rather than attaching the parent to nothing.
    const updates: { phone?: string; school_id?: string } = {}
    if (phone) updates.phone = phone
    if (tenantSchoolId) updates.school_id = tenantSchoolId
    if (Object.keys(updates).length > 0) {
      const admin = createSupabaseAdminClient()
      const { error: updateError } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', signUpData.user.id)
      if (updateError) {
        // Non-fatal: the account is created; the school still links on next login
        // via the tenant context, and the number can be added later.
        logger.warn('sign_up_profile_persist_failed', { error: updateError.message })
      }
    }
  }

  // When Supabase "Confirm email" is disabled, a session is returned immediately.
  if (signUpData.session) {
    // A PARENT (joined in a school's context) goes straight to the parent portal;
    // they then link their child by pupil code.
    if (tenantSchoolId) {
      redirect('/parent/dashboard')
    }
    // Honour an explicit destination (e.g. /register?next=/onboarding from the
    // "Create your own portal" CTA) so intent survives sign-up. Relative paths
    // only — never redirect off-site.
    const next = (formData.get('next') as string | null)?.trim()
    if (next?.startsWith('/')) {
      redirect(next)
    }
    redirect('/onboarding')
  }

  redirect('/verify-email')
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = { email: formData.get('email') }

  const result = forgotPasswordSchema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    return { fieldErrors: { email: fieldErrors.email?.[0] } }
  }

  const appUrl = serverEnv.appUrl
  const supabase = await createSupabaseServerClient()

  // Fire-and-forget: always return success to prevent email enumeration
  await supabase.auth.resetPasswordForEmail(result.data.email, {
    redirectTo: `${appUrl}/api/auth/callback?next=/reset-password`,
  })

  return {
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  }
}

// ─── Update Password (used on /reset-password after email-link auth) ─────────

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = {
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  }

  const result = resetPasswordSchema.safeParse(raw)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password: result.data.password })

  if (error) {
    logger.warn('update_password_failed', { reason: error.code })
    return {
      error:
        'Unable to update password. The reset link may have expired. Please request a new one.',
    }
  }

  // FR-AUTH-005: sign out all sessions after password change so other
  // devices must re-authenticate with the new credential.
  logger.info('password_changed', {})
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login?reason=password_changed')
}

// ─── Resend Verification Email ────────────────────────────────────────────────

export async function resendVerificationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''

  if (!email) {
    return { fieldErrors: { email: 'Enter your email address' } }
  }

  const appUrl = serverEnv.appUrl
  const supabase = await createSupabaseServerClient()

  await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${appUrl}/api/auth/callback?next=/parent/dashboard`,
    },
  })

  // Always return success to prevent email enumeration
  return {
    success: true,
    message: 'If your account exists and is unverified, a new link has been sent.',
  }
}

// ─── Change Password (forced first-login change) ──────────────────────────────

const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']

export async function changePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?reason=auth_required')

  const result = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return { fieldErrors: { password: fe.password?.[0], confirmPassword: fe.confirmPassword?.[0] } }
  }

  const { error } = await supabase.auth.updateUser({ password: result.data.password })
  if (error) {
    logger.warn('change_password_failed', { reason: error.code })
    return { error: 'Could not update your password. Please try again.' }
  }

  // Clear the force-change flag and route to the right dashboard.
  const adminClient = createSupabaseAdminClient()
  await adminClient.from('profiles').update({ must_change_password: false }).eq('id', user.id)

  let path = '/parent/dashboard'
  const { data: roleRows } = await adminClient
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)
  if (roleRows && roleRows.length > 0) {
    const roleIds = (roleRows as { role_id: string }[]).map((r) => r.role_id)
    const { data: roleNames } = await adminClient.from('roles').select('name').in('id', roleIds)
    const names = (roleNames ?? []) as { name: string }[]
    if (names.some((r) => ADMIN_ROLE_NAMES.includes(r.name))) path = '/admin/dashboard'
    else if (names.some((r) => r.name === 'teacher')) path = '/teacher/dashboard'
  }
  redirect(path)
}
