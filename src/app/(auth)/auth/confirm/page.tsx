import type { Metadata } from 'next'
import Link from 'next/link'
import { parseConfirmLink } from '@/lib/auth/confirm-link'
import { ConfirmLinkForm } from '@/components/auth/ConfirmLinkForm'

export const metadata: Metadata = { title: 'Confirm', robots: { index: false } }

/**
 * Landing page for password-reset (and confirmation) emails:
 *   /auth/confirm?token_hash=…&type=recovery[&next=/reset-password]
 * Nothing is verified on page load — only when the button is pressed.
 */
export default async function ConfirmEmailLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const link = parseConfirmLink(await searchParams)

  if (!link) {
    return (
      <div className="card p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-text-primary">Link invalid</h2>
        <p className="mb-6 text-sm text-text-muted">
          This link is incomplete or invalid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="btn-primary inline-block text-sm">
          Request new link
        </Link>
      </div>
    )
  }

  return <ConfirmLinkForm tokenHash={link.tokenHash} type={link.type} next={link.next} />
}
