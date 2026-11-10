import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { getSessionUser } from '@/lib/auth/session'
import { getPlatformSocialLinks, getSchoolSocialLinks } from '@/lib/social/queries'
import { existingPortalFor } from '@/lib/onboarding/existing-portal'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // A crèche is shown only when the URL names one (its subdomain or `/s/<slug>`);
  // the bare apex is always the Creche Wise main site (see getPublicViewerContext).
  const [{ school, tenantSlug }, user] = await Promise.all([
    getPublicViewerContext(),
    getSessionUser(),
  ])
  // "In a crèche context" = the URL names a crèche (subdomain or /s/<school> path).
  const isTenant = school !== null
  // Footer social buttons: the crèche's own links in its portal, else Creche Wise's.
  const socialLinks = school
    ? await getSchoolSocialLinks(school.id)
    : await getPlatformSocialLinks()
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        schoolName={school?.name ?? null}
        schoolLogoUrl={school?.logo_url ?? null}
        isTenant={isTenant}
        tenantSlug={tenantSlug ?? undefined}
        isAuthenticated={user !== null}
        portalHref={existingPortalFor(user)?.href}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter
        schoolName={school?.name ?? null}
        tenantSlug={tenantSlug}
        socialLinks={socialLinks}
      />
    </div>
  )
}
