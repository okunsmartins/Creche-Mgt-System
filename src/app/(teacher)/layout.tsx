import { requireTeacher } from '@/lib/auth/guards'
import { TeacherSidebar } from '@/components/layout/TeacherSidebar'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { requireSchoolAccessOrRedirect } from '@/lib/subscriptions/access'
import { getSchoolLogoUrl } from '@/lib/tenant/server'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeacher()
  await requireSchoolAccessOrRedirect(user.schoolId)
  const logoUrl = user.schoolId ? await getSchoolLogoUrl(user.schoolId) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SiteHeader
        schoolName={user.schoolName}
        schoolLogoUrl={logoUrl}
        isTenant={Boolean(user.schoolId)}
      />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <TeacherSidebar user={user} logoUrl={logoUrl} />
        <main id="main-content" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
