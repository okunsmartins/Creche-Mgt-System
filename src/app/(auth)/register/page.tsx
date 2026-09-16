import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { getPathTenantSlug } from '@/lib/tenant/server'

export const metadata: Metadata = { title: 'Create Account' }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const [{ next }, tenantSlug] = await Promise.all([searchParams, getPathTenantSlug()])
  return <RegisterForm next={next} tenantSlug={tenantSlug ?? undefined} />
}
