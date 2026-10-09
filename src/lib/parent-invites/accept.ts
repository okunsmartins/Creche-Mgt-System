'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

export type AcceptInviteState = null | { error: string }

type DbClient = ReturnType<typeof createSupabaseAdminClient>
interface ResolvedInvite {
  id: string
  school_id: string
  student_id: string
}

/** Resolve a usable invite (valid 64-hex token, not used, not expired), else null. */
async function resolveInvite(db: DbClient, token: string): Promise<ResolvedInvite | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const { data } = await db
    .from('parent_invites')
    .select('id, school_id, student_id, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  const inv = data as {
    id: string
    school_id: string
    student_id: string
    used_at: string | null
    expires_at: string
  } | null
  if (!inv || inv.used_at) return null
  if (new Date(inv.expires_at) <= new Date()) return null
  return { id: inv.id, school_id: inv.school_id, student_id: inv.student_id }
}

/** Attach the parent to the crèche (if not already) + link the child + consume the invite. */
async function linkAndConsume(db: DbClient, invite: ResolvedInvite, userId: string): Promise<void> {
  const { data: prof } = await db
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  if (!(prof as { school_id: string | null } | null)?.school_id) {
    await db.from('profiles').update({ school_id: invite.school_id }).eq('id', userId)
  }

  const { error } = await db.from('parent_student_links').insert({
    parent_id: userId,
    student_id: invite.student_id,
    school_id: invite.school_id,
    linked_by: null,
    is_active: true,
  })
  // 23505 = already linked — fine (idempotent).
  if (error && (error as { code?: string }).code !== '23505') throw new Error(error.message)

  await db
    .from('parent_invites')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('id', invite.id)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** New parent: create an account from the invite and auto-link the child. */
export async function acceptInviteSignupAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get('token') ?? '')
  const firstName = String(formData.get('firstName') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!firstName || !lastName) return { error: 'Enter your first and last name.' }
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }

  const db = createSupabaseAdminClient()
  const invite = await resolveInvite(db, token)
  if (!invite) return { error: 'This invite link is invalid or has expired.' }

  const supabase = await createSupabaseServerClient()
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${serverEnv.appUrl}/api/auth/callback?next=${encodeURIComponent('/parent/dashboard')}`,
    },
  })
  if (error) {
    logger.warn('invite_signup_failed', { reason: error.code })
    return {
      error:
        'Unable to create your account. If you already have one with this email, use “Sign in” below.',
    }
  }

  // Anti-enumeration: an already-registered email returns a user with an empty
  // identities array — never link a child to someone else's existing account.
  const isNewUser = (signUpData.user?.identities?.length ?? 0) > 0
  if (!isNewUser || !signUpData.user) {
    return {
      error: 'An account already exists for this email. Use “Sign in” below to link your child.',
    }
  }

  try {
    await linkAndConsume(db, invite, signUpData.user.id)
  } catch (err) {
    logger.error('invite_link_failed', { error: err instanceof Error ? err.message : 'unknown' })
    return {
      error: 'Your account was created but linking the child failed. Please contact the crèche.',
    }
  }

  if (signUpData.session) redirect('/parent/dashboard')
  redirect('/verify-email')
}

/** Existing parent: sign in from the invite and link the child. */
export async function acceptInviteSigninAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get('token') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!EMAIL_RE.test(email) || !password) return { error: 'Enter your email and password.' }

  const db = createSupabaseAdminClient()
  const invite = await resolveInvite(db, token)
  if (!invite) return { error: 'This invite link is invalid or has expired.' }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    logger.warn('invite_signin_failed', { reason: error?.code })
    return { error: 'Invalid email or password. Please try again.' }
  }

  try {
    await linkAndConsume(db, invite, data.user.id)
  } catch (err) {
    logger.error('invite_link_failed', { error: err instanceof Error ? err.message : 'unknown' })
    return { error: 'Sign-in worked but linking the child failed. Please contact the crèche.' }
  }

  redirect('/parent/dashboard')
}

/** Already-signed-in parent: link the invited child to the current account. */
export async function acceptInviteAuthedAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const user = await requireVerifiedAuth()
  const token = String(formData.get('token') ?? '')
  const db = createSupabaseAdminClient()
  const invite = await resolveInvite(db, token)
  if (!invite) return { error: 'This invite link is invalid or has expired.' }

  try {
    await linkAndConsume(db, invite, user.id)
  } catch (err) {
    logger.error('invite_link_failed', { error: err instanceof Error ? err.message : 'unknown' })
    return { error: 'Could not link the child. Please contact the crèche.' }
  }

  redirect('/parent/dashboard')
}
