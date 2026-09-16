import { redirect } from 'next/navigation'
import { getSessionUser } from './session'
import type { SessionUser } from '@/types'

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin'] as const

/**
 * Asserts that the request is from an authenticated user.
 * Redirects to /login (or /register) if not. Returns the SessionUser.
 *
 * Pass `next` (an app-relative path) to send the user back where they were
 * headed — without it the destination is lost, which matters on entry points a
 * logged-out visitor can reach.
 *
 * Pass `destination: 'register'` where the visitor almost certainly has no
 * account yet (e.g. /onboarding, reached from "Create your own portal"); sending
 * those people to a sign-in form first is needless friction.
 *
 * Use in Server Components and Route Handlers, NOT in layouts
 * (layouts run before route segments and should defer auth to pages).
 */
export async function requireAuth(
  next?: string,
  destination: 'login' | 'register' = 'login',
): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    // Only accept app-relative paths — never redirect off-site after auth.
    const target = next?.startsWith('/') ? `&next=${encodeURIComponent(next)}` : ''
    redirect(`/${destination}?reason=auth_required${target}`)
  }
  return user
}

/**
 * Asserts that the request is from an authenticated user with a
 * verified email. Redirects to /verify-email if email not verified.
 */
export async function requireVerifiedAuth(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.mustChangePassword) redirect('/change-password')
  if (!user.emailVerified) {
    redirect('/verify-email')
  }
  return user
}

/**
 * Asserts that the user holds at least one admin role
 * (super_admin, school_admin, finance_admin).
 * Redirects to /parent/dashboard if authenticated but not an admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.mustChangePassword) redirect('/change-password')
  const isAdmin = user.roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))
  if (!isAdmin) {
    redirect('/parent/dashboard')
  }
  return user
}

/**
 * Asserts that the request is from a parent — i.e. NOT staff. This system has no
 * explicit 'parent' role: a parent is any verified user who is not an admin or
 * teacher (this mirrors the post-login default in the login action). Staff who
 * navigate into the parent portal are sent back to their own dashboard, so a
 * teacher/admin can't browse the parent pages.
 */
export async function requireParent(): Promise<SessionUser> {
  const user = await requireVerifiedAuth()
  if (user.roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))) {
    redirect('/admin/dashboard')
  }
  if (user.roles.includes('teacher')) {
    redirect('/teacher/dashboard')
  }
  return user
}

/**
 * Asserts that the user holds a specific named permission.
 * Redirects to /parent/dashboard if the permission is absent.
 */
export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireAuth()
  if (!user.permissions.includes(permission)) {
    redirect('/parent/dashboard')
  }
  return user
}

/**
 * Asserts that the user holds the 'teacher' role.
 * Redirects to /login?reason=teacher_required if not.
 */
export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.mustChangePassword) redirect('/change-password')
  if (!user.roles.includes('teacher')) {
    redirect('/login?reason=teacher_required')
  }
  return user
}
