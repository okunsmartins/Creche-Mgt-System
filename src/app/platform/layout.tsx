import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, LayoutDashboard } from 'lucide-react'
import { requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { PlatformTabs } from '@/components/platform/PlatformTabs'
import { MfaGraceBanner } from '@/components/auth/MfaGraceBanner'

// Guards the whole /platform section once. A signed-in non-owner gets a 404
// (never reveals the section exists); anonymous users are sent to login.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth()
  if (!isPlatformOwner(user)) notFound()
  // The owner is usually also a crèche admin: offer a way straight back to that dashboard.
  const isAdmin = user.roles.some((r) =>
    ['super_admin', 'school_admin', 'finance_admin'].includes(r),
  )

  return (
    <>
      <MfaGraceBanner mfa={user.mfa} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              {user.schoolName ? `${user.schoolName} dashboard` : 'Admin dashboard'}
            </Link>
          )}
        </div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Platform</h1>
          <p className="mt-1 text-sm text-text-muted">Owner overview of Creche Wise.</p>
        </div>
        <PlatformTabs />
        <div className="mt-8">{children}</div>
      </div>
    </>
  )
}
