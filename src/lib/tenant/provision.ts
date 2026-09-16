import type { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/**
 * Self-service school provisioning.
 *
 * `provisionSchool` creates a complete, isolated environment for a new tenant:
 * the school row (with subdomain), default settings, the standard Irish primary
 * class list, and it makes the owner a school_admin of that school. It is the
 * single reusable entry point — called by the subscription webhook, an admin
 * tool, or a script.
 *
 * Subdomain validation is pure and unit-tested (`validateSubdomain`).
 */

// Subdomains that must never be assigned to a tenant (routing/brand/security).
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'apps',
  'mail',
  'email',
  'ftp',
  'smtp',
  'dashboard',
  'portal',
  'login',
  'logout',
  'register',
  'signup',
  'auth',
  'static',
  'assets',
  'cdn',
  'status',
  'help',
  'support',
  'docs',
  'blog',
  'about',
  'pricing',
  'billing',
  'account',
  'settings',
  'school',
  'schools',
  'demo',
  'schooldemo',
  'test',
  'staging',
  'dev',
  'preview',
  'vercel',
  'stripe',
  'webhook',
  'webhooks',
  // Path-tenancy reset keywords (see middleware `/s/<sub>`): a school must not
  // claim these, or it would be unreachable (the cookie would be cleared instead).
  'reset',
  'default',
  'main',
])

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type SubdomainResult = { ok: true; value: string } | { ok: false; error: string }

/**
 * Validates and normalises a desired subdomain (pure; no DB).
 * Rules: 3–30 chars, lowercase a–z/0–9/hyphen, no leading/trailing/double
 * hyphen, not reserved.
 */
export function validateSubdomain(raw: string | null | undefined): SubdomainResult {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return { ok: false, error: 'Enter a subdomain.' }
  if (value.length < 3) return { ok: false, error: 'Subdomain must be at least 3 characters.' }
  if (value.length > 30) return { ok: false, error: 'Subdomain must be 30 characters or fewer.' }
  if (value.includes('--'))
    return { ok: false, error: 'Subdomain cannot contain consecutive hyphens.' }
  if (!SUBDOMAIN_RE.test(value)) {
    return {
      ok: false,
      error: 'Use only lowercase letters, numbers and hyphens (not at the start or end).',
    }
  }
  if (RESERVED_SUBDOMAINS.has(value))
    return { ok: false, error: 'That subdomain is reserved. Please choose another.' }
  return { ok: true, value }
}

/** Returns true if the subdomain is free (no active or inactive school using it). */
export async function isSubdomainAvailable(
  adminClient: AdminClient,
  subdomain: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from('schools')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle()
  return !data
}

// Standard Irish primary class list seeded for every new school.
const DEFAULT_CLASSES = [
  'Junior Infants',
  'Senior Infants',
  'First Class',
  'Second Class',
  'Third Class',
  'Fourth Class',
  'Fifth Class',
  'Sixth Class',
]

export interface ProvisionSchoolInput {
  name: string
  subdomain: string
  ownerProfileId: string // = auth user id; becomes school_admin
}

export type ProvisionResult = { ok: true; schoolId: string } | { ok: false; error: string }

/**
 * Creates a new school environment and makes the owner its admin.
 * Idempotency: fails cleanly if the subdomain is already taken.
 */
export async function provisionSchool(
  adminClient: AdminClient,
  input: ProvisionSchoolInput,
): Promise<ProvisionResult> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'School name is required.' }

  const sub = validateSubdomain(input.subdomain)
  if (!sub.ok) return { ok: false, error: sub.error }

  if (!(await isSubdomainAvailable(adminClient, sub.value))) {
    return { ok: false, error: 'That subdomain is already taken.' }
  }

  // Resolve the school_admin role id once.
  const { data: roleRow } = await adminClient
    .from('roles')
    .select('id')
    .eq('name', 'school_admin')
    .single()
  const roleId = (roleRow as { id: string } | null)?.id
  if (!roleId) return { ok: false, error: 'school_admin role is not configured.' }

  // 1. Create the school.
  const { data: schoolRow, error: schoolErr } = await adminClient
    .from('schools')
    .insert({ name, subdomain: sub.value, is_active: true })
    .select('id')
    .single()
  if (schoolErr || !schoolRow) {
    logger.error('provision_school_insert_failed', {
      code: schoolErr?.code,
      message: schoolErr?.message,
      details: schoolErr?.details,
      hint: schoolErr?.hint,
    })
    return { ok: false, error: 'Could not create the school. Please try again.' }
  }
  const schoolId = (schoolRow as { id: string }).id

  // 2. Default settings.
  await adminClient.from('school_settings').insert([
    {
      school_id: schoolId,
      key: 'portal_name',
      value: `${name} Admin Portal`,
      description: 'Display name for the portal',
    },
    { school_id: schoolId, key: 'currency', value: 'EUR', description: 'Payment currency' },
    {
      school_id: schoolId,
      key: 'stripe_mode',
      value: 'test',
      description: 'Stripe environment: test or live',
    },
  ])

  // 2.5 Create a placeholder subscription row with NO access yet. The owner adds
  //     a card at onboarding (/onboarding/billing → Stripe Checkout), which starts
  //     a Stripe-managed TRIAL_PERIOD_DAYS trial and auto-charges when it ends —
  //     so we deliberately do NOT set trial_ends_at here (that would suppress the
  //     Checkout trial) and do NOT grant access (status 'incomplete'/plan 'free'
  //     → hasProAccess === false) until the card is captured. The webhook upserts
  //     this row to 'trialing' once Checkout completes.
  const { error: subErr } = await adminClient.from('subscriptions').insert({
    school_id: schoolId,
    plan: 'free',
    status: 'incomplete',
  })
  if (subErr) {
    // Non-fatal: the checkout webhook upserts by school_id anyway. Log for audit.
    logger.error('provision_subscription_insert_failed', { schoolId, message: subErr.message })
  }

  // 3. Default class list.
  await adminClient.from('classes').insert(
    DEFAULT_CLASSES.map((className, i) => ({
      school_id: schoolId,
      name: className,
      display_order: i + 1,
    })),
  )

  // 4. Attach the owner to the school and grant school_admin.
  //    These two are critical — without them the owner can't administer the
  //    school they just created — so their errors are surfaced. (Steps 2–3 are
  //    best-effort defaults; an admin can re-add settings/classes in-app.)
  //    NOTE: there is no surrounding transaction (supabase-js can't span
  //    statements) — a failure here leaves a school the owner can't reach.
  //    For production this whole flow should move to a Postgres RPC so it is
  //    atomic. See docs/implementation-status.md.
  const { error: profileErr } = await adminClient
    .from('profiles')
    .update({ school_id: schoolId })
    .eq('id', input.ownerProfileId)

  const { error: roleErr } = await adminClient
    .from('user_roles')
    .insert({ user_id: input.ownerProfileId, role_id: roleId, school_id: schoolId })

  if (profileErr || roleErr) {
    return {
      ok: false,
      error: 'School created but the owner could not be set up as admin. Contact support.',
    }
  }

  // Single-domain: no per-school DNS to provision. The school is reachable on the
  // apex via `/s/<subdomain>/…`, a branded pay-link `/pay/<token>`, or a session.

  return { ok: true, schoolId }
}
