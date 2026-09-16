import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { PlatformTabs } from '@/components/platform/PlatformTabs'

// Guards the whole /platform section once. A signed-in non-owner gets a 404
// (never reveals the section exists); anonymous users are sent to login.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth()
  if (!isPlatformOwner(user)) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Platform</h1>
        <p className="mt-1 text-sm text-text-muted">Owner overview of Skool Bido.</p>
      </div>
      <PlatformTabs />
      <div className="mt-8">{children}</div>
    </div>
  )
}
