import type { Metadata } from 'next'
import { SocialLinksForm } from '@/components/admin/SocialLinksForm'
import { getPlatformSocialLinks } from '@/lib/social/queries'
import { savePlatformSocialLinksAction } from '@/lib/social/actions'

export const metadata: Metadata = { title: 'Settings — Platform' }

// Platform owner only (guarded by app/platform/layout.tsx).
export default async function PlatformSettingsPage() {
  const links = await getPlatformSocialLinks()
  return (
    <div className="max-w-2xl">
      <SocialLinksForm
        links={links}
        action={savePlatformSocialLinksAction}
        description="Creche Wise's own social pages. They appear in the footer of crechewise.com's public pages (each crèche's pages show that crèche's own links instead). Leave a box empty to hide that network."
      />
    </div>
  )
}
