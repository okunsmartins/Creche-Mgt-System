'use server'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { provisionSchool, validateSubdomain } from './provision'

export type CreateSchoolState = {
  error?: string
  fieldErrors?: { name?: string; subdomain?: string }
} | null

/**
 * Self-service onboarding: the signed-in user creates a new school and becomes
 * its admin. Requires authentication; one school per owner for now.
 *
 * NOTE: in Phase 2 this action becomes the post-subscription provisioning step
 * (gated on a successful Stripe subscription). For now it provisions directly so
 * the flow is demonstrable end-to-end.
 */
const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

export async function createSchoolAction(
  _prev: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  const user = await requireAuth()

  // Only users with no school may create one — staff and existing parents are
  // sent to their portal (prevents reassigning an account that already belongs
  // to a school).
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) redirect('/admin/dashboard')
  if (user.roles.includes('teacher')) redirect('/teacher/dashboard')
  if (user.schoolId) redirect('/parent/dashboard')

  const name = ((formData.get('name') as string | null) ?? '').trim()
  const subdomainRaw = (formData.get('subdomain') as string | null) ?? ''

  if (!name) return { fieldErrors: { name: 'Enter your school name.' } }

  const sub = validateSubdomain(subdomainRaw)
  if (!sub.ok) return { fieldErrors: { subdomain: sub.error } }

  const adminClient = createSupabaseAdminClient()
  const result = await provisionSchool(adminClient, {
    name,
    subdomain: sub.value,
    ownerProfileId: user.id,
  })

  if (!result.ok) {
    logger.warn('provision_school_failed', { reason: result.error })
    return { error: result.error }
  }

  logger.info('school_provisioned', { schoolId: result.schoolId })
  // Card-at-signup: the school has no access yet — send the new admin to add a
  // card and start their Stripe-managed free trial (auto-charges when it ends).
  redirect('/onboarding/billing')
}
