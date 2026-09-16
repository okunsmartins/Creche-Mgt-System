import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { getPathTenantSlug } from '@/lib/tenant/server'

export const metadata: Metadata = { title: 'Sign In' }

interface LoginPageProps {
  searchParams: Promise<{ next?: string; reason?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next, reason }, tenantSlug] = await Promise.all([searchParams, getPathTenantSlug()])
  return <LoginForm next={next} reason={reason} tenantSlug={tenantSlug ?? undefined} />
}
