import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { getPathTenantSlug, getTenantSchool } from '@/lib/tenant/server'
import { getSchoolSocialLinks } from '@/lib/social/queries'

export const metadata: Metadata = { title: 'Sign In' }

interface LoginPageProps {
  searchParams: Promise<{ next?: string; reason?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next, reason }, tenantSlug, school] = await Promise.all([
    searchParams,
    getPathTenantSlug(),
    getTenantSchool(),
  ])
  // A crèche's sign-in page shows its social links (set in Crèche Settings).
  const socialLinks = school ? await getSchoolSocialLinks(school.id) : []
  return (
    <LoginForm
      next={next}
      reason={reason}
      tenantSlug={tenantSlug ?? undefined}
      schoolName={school?.name ?? null}
      socialLinks={socialLinks}
    />
  )
}
