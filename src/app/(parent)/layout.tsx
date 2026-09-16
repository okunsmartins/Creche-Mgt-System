import { requireParent } from '@/lib/auth/guards'
import { ParentHeader } from '@/components/layout/ParentHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { ParentBasketProvider } from '@/lib/basket/BasketContext'
import { requireSchoolAccessOrRedirect } from '@/lib/subscriptions/access'
import { getSchoolLogoUrl } from '@/lib/tenant/server'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireParent()
  await requireSchoolAccessOrRedirect(user.schoolId)
  const logoUrl = user.schoolId ? await getSchoolLogoUrl(user.schoolId) : null

  return (
    <ParentBasketProvider>
      <div className="flex min-h-screen flex-col">
        <ParentHeader user={user} logoUrl={logoUrl} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </ParentBasketProvider>
  )
}
