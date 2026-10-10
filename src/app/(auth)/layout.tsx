import Link from 'next/link'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { TeddyShell } from '@/components/auth/TeddyShell'
import { getTenantSchool, getTenantSubdomain, getPathTenantSlug } from '@/lib/tenant/server'

// Sign-in / register / password pages for every crèche (and the platform), in the
// shared teddy look — each page renders its own `.card` inside the shell.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [school, subdomain, tenantSlug] = await Promise.all([
    getTenantSchool(),
    getTenantSubdomain(),
    getPathTenantSlug(),
  ])
  const isTenant = subdomain !== null
  const withTenant = (href: string) => (tenantSlug ? `/s/${tenantSlug}${href}` : href)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        schoolName={school?.name ?? null}
        schoolLogoUrl={school?.logo_url ?? null}
        isTenant={isTenant}
        tenantSlug={tenantSlug ?? undefined}
      />
      <TeddyShell
        asMain
        footer={
          <>
            <Link href={withTenant('/privacy')} className="hover:text-primary hover:underline">
              Privacy Notice
            </Link>{' '}
            ·{' '}
            <Link href={withTenant('/contact')} className="hover:text-primary hover:underline">
              Contact
            </Link>{' '}
            · Powered by Creche Wise
          </>
        }
      >
        {children}
      </TeddyShell>
    </div>
  )
}
