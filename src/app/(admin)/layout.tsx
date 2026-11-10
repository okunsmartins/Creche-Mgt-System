import { requireAdmin } from '@/lib/auth/guards'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminTopBar } from '@/components/layout/AdminTopBar'
import { AdminMain } from '@/components/layout/AdminMain'
import { requireSchoolAccessOrRedirect } from '@/lib/subscriptions/access'
import { isPlatformOwner } from '@/lib/platform/owner'
import { getSchoolLogoUrl, getSchoolPublicPath } from '@/lib/tenant/server'
import { fundingEnabled } from '@/lib/funding/access'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  await requireSchoolAccessOrRedirect(user.schoolId)
  const logoUrl = user.schoolId ? await getSchoolLogoUrl(user.schoolId) : null
  const isOwner = isPlatformOwner(user)
  const hiveEnabled = user.schoolId ? await fundingEnabled(user.schoolId) : false
  // "View site" opens this crèche's own public page (the bare apex is the main site).
  const siteHref = user.schoolId ? await getSchoolPublicPath(user.schoolId) : '/'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AdminTopBar user={user} logoUrl={logoUrl} siteHref={siteHref} />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <AdminSidebar user={user} isOwner={isOwner} fundingEnabled={hiveEnabled} />
        <div className="flex min-w-0 flex-1 flex-col overflow-auto">
          <AdminMain>{children}</AdminMain>
        </div>
      </div>
    </div>
  )
}
