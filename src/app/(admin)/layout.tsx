import { requireAdmin } from '@/lib/auth/guards'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { requireSchoolAccessOrRedirect } from '@/lib/subscriptions/access'
import { isPlatformOwner } from '@/lib/platform/owner'
import { getSchoolLogoUrl } from '@/lib/tenant/server'
import { fundingEnabled } from '@/lib/funding/access'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  await requireSchoolAccessOrRedirect(user.schoolId)
  const logoUrl = user.schoolId ? await getSchoolLogoUrl(user.schoolId) : null
  const isOwner = isPlatformOwner(user)
  const hiveEnabled = user.schoolId ? await fundingEnabled(user.schoolId) : false

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SiteHeader
        schoolName={user.schoolName}
        schoolLogoUrl={logoUrl}
        isTenant={Boolean(user.schoolId)}
      />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <AdminSidebar
          user={user}
          logoUrl={logoUrl}
          isOwner={isOwner}
          fundingEnabled={hiveEnabled}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-auto">
          <AdminHeader user={user} />
          <main id="main-content" className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
