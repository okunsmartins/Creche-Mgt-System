import Link from 'next/link'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Mascot } from '@/components/marketing/Mascot'
import { Icon3D } from '@/components/ui/Icon3D'
import { getTenantSchool, getTenantSubdomain, getPathTenantSlug } from '@/lib/tenant/server'

// Sign-in / register / password pages for every crèche (and the platform). Soft
// lavender-to-pink backdrop, floating 3D icons, and the Creche Wise teddy peeking
// over the form card — each page renders its own `.card` inside `.auth-shell`.
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
      <main
        id="main-content"
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#ece4ff_0%,#f5eefe_45%,#ffe6f0_100%)] px-4 pb-12 pt-6"
      >
        {/* Decorations (hidden from assistive tech) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-white/40 blur-2xl" />
          <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-[#ffd6e7]/60 blur-2xl" />
          <Icon3D
            name="speech"
            size={72}
            className="auth-float absolute left-[8%] top-[18%] hidden md:block"
          />
          <Icon3D
            name="locked"
            size={76}
            className="auth-float-slow absolute right-[9%] top-[14%] hidden md:block"
          />
          <Icon3D
            name="check"
            size={56}
            className="auth-float absolute right-[14%] top-[46%] hidden lg:block"
          />
          <Icon3D
            name="sparkles"
            size={44}
            className="auth-float-slow absolute left-[16%] top-[52%] hidden lg:block"
          />
          <Icon3D name="plant" size={120} className="absolute bottom-4 left-[4%] hidden md:block" />
          <Icon3D
            name="plant"
            size={104}
            className="absolute bottom-4 right-[5%] hidden -scale-x-100 md:block"
          />
        </div>

        <div className="auth-shell relative w-full max-w-md pt-[118px]">
          {/* Teddy peeking over the card, paws resting on its edge */}
          <div aria-hidden="true" className="absolute left-1/2 top-0 z-0 -translate-x-1/2">
            <Mascot size={150} />
          </div>
          <div aria-hidden="true" className="absolute left-1/2 top-[104px] z-20 -translate-x-1/2">
            <div className="flex gap-[54px]">
              <span className="h-7 w-9 rounded-full bg-[#c98a4b] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]" />
              <span className="h-7 w-9 rounded-full bg-[#c98a4b] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]" />
            </div>
          </div>
          <div className="relative z-10">{children}</div>
        </div>

        <p className="relative mt-8 text-xs font-semibold text-text-secondary">
          <Link href={withTenant('/privacy')} className="hover:text-primary hover:underline">
            Privacy Notice
          </Link>{' '}
          ·{' '}
          <Link href={withTenant('/contact')} className="hover:text-primary hover:underline">
            Contact
          </Link>{' '}
          · Powered by Creche Wise
        </p>
      </main>
    </div>
  )
}
