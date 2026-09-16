import { cache } from 'react'
import { headers } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { isPlatformOwner } from '@/lib/platform/owner'
import { parseTenantSubdomain } from './parse'

const COOKIE_SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * Multi-tenant resolution (server-side).
 *
 * The tenant (school) comes from the request host's subdomain
 * (e.g. `stmarys.example.ie` → `stmarys`), or the `tenant` cookie set by the
 * path-based entry (`/s/<subdomain>`, which works without DNS).
 *
 * There is deliberately **NO default school**. When nothing identifies a tenant
 * these resolvers return `null` and the caller must handle it — school-specific
 * public pages render a school picker. Previously they fell back to
 * `NEXT_PUBLIC_SCHOOL_ID`, which silently served ONE school's catalogue to
 * everyone: an anonymous visitor on the apex host saw that school's activities as
 * if it were "the" school, and a signed-in user of another school saw it too.
 * Guessing a tenant is never correct — ask instead.
 *
 * Used by PUBLIC pages (guest payment, activities, programmes, pay-by-link).
 * Authenticated pages/actions scope to the signed-in user's own `schoolId`.
 */

export { parseTenantSubdomain }

/**
 * Returns the tenant subdomain for the request, or null if none applies.
 * Resolution order: real host subdomain (production), then the per-request
 * `x-tenant-subdomain` header the middleware sets from a `/s/<school>` path.
 * No persistent cookie — so the bare apex never "sticks" to a school.
 */
export async function getTenantSubdomain(): Promise<string | null> {
  const h = await headers()
  const fromHost = parseTenantSubdomain(h.get('host'))
  if (fromHost) return fromHost

  const fromPath = h.get('x-tenant-subdomain')?.toLowerCase().trim()
  if (fromPath && COOKIE_SUBDOMAIN_RE.test(fromPath)) return fromPath
  return null
}

/**
 * When the tenant came from a `/s/<school>` PATH (not a host subdomain), returns
 * that slug so public nav links can stay prefixed (`/s/<school>/…`) and keep the
 * school in context. Returns null on host-subdomain or no tenant.
 */
export async function getPathTenantSlug(): Promise<string | null> {
  const h = await headers()
  if (parseTenantSubdomain(h.get('host'))) return null
  const fromPath = h.get('x-tenant-subdomain')?.toLowerCase().trim()
  return fromPath && COOKIE_SUBDOMAIN_RE.test(fromPath) ? fromPath : null
}

/**
 * school_id for the request's tenant, or **null** when no tenant is identified.
 * Memoised per request.
 */
export const getTenantSchoolId = cache(async (): Promise<string | null> => {
  const subdomain = await getTenantSubdomain()
  if (!subdomain) return null

  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('schools')
    .select('id')
    .eq('subdomain', subdomain)
    .eq('is_active', true)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
})

/** The tenant's school for public branding, or null when no tenant applies. */
export const getTenantSchool = cache(async (): Promise<School | null> => {
  const id = await getTenantSchoolId()
  return id ? schoolById(id) : null
})

export interface School {
  id: string
  name: string
  subdomain: string | null
  // Public URL of the school's uploaded logo; null → fall back to the initials crest.
  logo_url: string | null
  // Controller/contact details for the legal pages. Null on schools that were
  // provisioned without them (an admin fills these in later).
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  eircode: string | null
}

async function schoolById(schoolId: string): Promise<School | null> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('schools')
    .select(
      'id, name, subdomain, logo_url, email, phone, address_line1, address_line2, city, county, eircode',
    )
    .eq('id', schoolId)
    .maybeSingle()
  return (data as School | null) ?? null
}

/**
 * School for PUBLIC BROWSABLE pages (the activities/programmes catalogue and the
 * public header branding), or **null** when none can be identified.
 *
 * Precedence:
 *  1. an EXPLICIT tenant (host subdomain, or the `/s/<sub>` cookie) — a
 *     deliberate request for that school's portal, so it always wins;
 *  2. otherwise the SIGNED-IN user's own school — a St Marys admin clicking
 *     "Activities" must see St Marys', not some other school's;
 *  3. otherwise **null** → the caller shows a school picker. No guessing.
 *
 * NOT for token flows (`/pay/[token]`) — those resolve the school from the link
 * itself, or a signed-in user of school A could not open school B's valid link.
 */
export const getViewerSchoolId = cache(async (): Promise<string | null> => {
  if (await getTenantSubdomain()) return getTenantSchoolId()
  const user = await getSessionUser()
  return user?.schoolId ?? null
})

/** `getViewerSchoolId` + the school's details, or null. Memoised per request. */
export const getViewerSchool = cache(async (): Promise<School | null> => {
  const id = await getViewerSchoolId()
  return id ? schoolById(id) : null
})

/**
 * The school + path-tenant context for the PUBLIC site (header + landing page),
 * with one override: the platform owner on the bare apex (no subdomain, no
 * `/s/<slug>` path — i.e. the school would only come from their own session) sees
 * the platform landing, not their linked school's portal. They can still browse a
 * specific school via a `/s/<slug>` link. Everyone else is unchanged.
 */
export const getPublicViewerContext = cache(
  async (): Promise<{ school: School | null; tenantSlug: string | null }> => {
    const [school, tenantSlug, subdomain] = await Promise.all([
      getViewerSchool(),
      getPathTenantSlug(),
      getTenantSubdomain(),
    ])
    if (school && !subdomain) {
      const user = await getSessionUser()
      if (isPlatformOwner(user)) return { school: null, tenantSlug: null }
    }
    return { school, tenantSlug }
  },
)

/**
 * Logo URL for a SPECIFIC school id — for the AUTHENTICATED portals
 * (admin/teacher/parent), whose branding must always be the signed-in user's
 * OWN school. Deliberately NOT `getViewerSchool`: that prefers a `tenant` cookie,
 * so an admin who had browsed another school's public portal would otherwise see
 * that other school's logo in their own portal header. Memoised per request.
 */
export const getSchoolLogoUrl = cache(async (schoolId: string): Promise<string | null> => {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('schools')
    .select('logo_url')
    .eq('id', schoolId)
    .maybeSingle()
  return (data as { logo_url: string | null } | null)?.logo_url ?? null
})
