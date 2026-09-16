import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { getSessionUser } from '@/lib/auth/session'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Viewer-aware, and may be null: with no tenant and nobody signed in there is
  // no school to brand with — SiteHeader falls back to platform branding. The
  // platform owner on the bare apex is treated as a platform visitor (see
  // getPublicViewerContext), so they get the platform nav, not a school portal.
  const [{ school, tenantSlug }, user] = await Promise.all([
    getPublicViewerContext(),
    getSessionUser(),
  ])
  // "In a school context" = a school is resolved for this viewer (subdomain,
  // /s/<school> path, OR a signed-in school user's own school). Keeps the nav
  // consistent with the branding.
  const isTenant = school !== null
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        schoolName={school?.name ?? null}
        schoolLogoUrl={school?.logo_url ?? null}
        isTenant={isTenant}
        tenantSlug={tenantSlug ?? undefined}
        isAuthenticated={user !== null}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
