'use server'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { provisionSchool, validateSubdomain } from './provision'
import { existingPortalFor } from '@/lib/onboarding/existing-portal'

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

export async function createSchoolAction(
  _prev: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  const user = await requireAuth()

  // Only accounts with no crèche may create one (prevents reassigning an account
  // that already belongs to a crèche). The page explains this before the form is
  // shown; this is the server-side backstop.
  const existing = existingPortalFor(user)
  if (existing) {
    return {
      error: `This account already belongs to ${existing.schoolName ?? 'a crèche'}. Sign out and use a different email address to set up a new crèche.`,
    }
  }

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
  // No-card trial: provisioning grants a free trial with full access immediately
  // (status 'trialing'), so the new admin goes straight to the dashboard. They add
  // payment details later (from /admin/subscription or the paywall) to continue
  // after the trial ends.
  redirect('/admin/dashboard')
}
