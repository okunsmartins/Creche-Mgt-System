import type { Metadata } from 'next'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { PlatformLanding } from '@/components/marketing/PlatformLanding'
import { CrecheLanding, type CrecheRoom } from '@/components/marketing/CrecheLanding'
import { serverEnv } from '@/lib/env'
import { getProPrices } from '@/lib/stripe/prices'
import { getSchoolSocialLinks } from '@/lib/social/queries'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  // Viewer-aware so the page agrees with the header rendered by (public)/layout.tsx.
  // The platform owner on the bare apex is treated as a platform visitor here too.
  const { school, tenantSlug } = await getPublicViewerContext()

  // Main landing = no school resolved for this viewer (anonymous apex). A
  // signed-in school user (even on the apex) is in their school's context, so
  // they get the crèche page, not the platform marketing — this matches the
  // header nav decided in (public)/layout.tsx.
  if (school === null) {
    // Same Stripe-backed price as /pricing so the two never disagree; falls back to
    // the published €75 when Stripe isn't configured or the lookup fails.
    const hasPrice = !!serverEnv.stripeProMonthlyPriceId
    const prices = hasPrice ? await getProPrices() : { monthly: null }
    return <PlatformLanding monthlyPrice={prices.monthly ?? '€75'} />
  }

  // When browsing via a `/s/<school>` path, keep that prefix on school links so
  // navigation stays in the crèche (no sticky cookie carries it).
  const withTenant = (href: string) =>
    tenantSlug ? (href === '/' ? `/s/${tenantSlug}` : `/s/${tenantSlug}${href}`) : href

  // The crèche's active rooms (name + capacity only) for its public page. Service
  // role bypasses RLS, so scope to this school explicitly.
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('classes')
    .select('name, capacity')
    .eq('school_id', school.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  const rooms = (data ?? []) as CrecheRoom[]
  const socialLinks = await getSchoolSocialLinks(school.id)

  return (
    <CrecheLanding
      school={school}
      rooms={rooms}
      withTenant={withTenant}
      socialLinks={socialLinks}
    />
  )
}
