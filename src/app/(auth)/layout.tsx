import Link from 'next/link'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SchoolCrest } from '@/components/layout/SchoolCrest'
import { getTenantSchool, getTenantSubdomain, getPathTenantSlug } from '@/lib/tenant/server'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [school, subdomain, tenantSlug] = await Promise.all([
    getTenantSchool(),
    getTenantSubdomain(),
    getPathTenantSlug(),
  ])
  const isTenant = subdomain !== null
  const homeHref = tenantSlug ? `/s/${tenantSlug}` : '/'
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        schoolName={school?.name ?? null}
        schoolLogoUrl={school?.logo_url ?? null}
        isTenant={isTenant}
        tenantSlug={tenantSlug ?? undefined}
      />
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-12"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href={homeHref} aria-label="Back to home">
            <SchoolCrest
              name={school?.name ?? 'Skool Bido'}
              size={56}
              className="text-lg"
              logoUrl={school?.logo_url ?? null}
            />
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-bold text-primary">{school?.name ?? 'Skool Bido'}</h1>
            <p className="text-xs text-text-muted">
              {school ? 'Online Admin Portal' : 'School payments made simple'}
            </p>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="mt-8 text-xs text-text-muted">
          <Link href="/privacy" className="hover:text-primary hover:underline">
            Privacy Notice
          </Link>{' '}
          ·{' '}
          <Link href="/contact" className="hover:text-primary hover:underline">
            Contact
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
