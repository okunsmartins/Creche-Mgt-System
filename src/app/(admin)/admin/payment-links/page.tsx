import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { schoolPublicOrigin } from '@/lib/tenant/urls'
import { formatDate } from '@/lib/utils'
import { PaymentLinkActions } from '@/components/payment-links/PaymentLinkActions'
import { CopyLinkButton } from '@/components/payment-links/CopyLinkButton'
import { UpgradePrompt } from '@/components/subscriptions/UpgradePrompt'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import type { PaymentLinkRow, ActivityRow, ProgrammeRow } from '@/types/database'

export const metadata: Metadata = { title: 'Payment Links | Admin' }

type LinkWithActivity = Pick<
  PaymentLinkRow,
  | 'id'
  | 'label'
  | 'public_token'
  | 'expires_at'
  | 'max_uses'
  | 'use_count'
  | 'is_active'
  | 'created_at'
> & {
  activities: Pick<ActivityRow, 'name'> | null
  programmes: Pick<ProgrammeRow, 'name'> | null
}

export default async function PaymentLinksPage() {
  const admin = await requireAdmin()
  const isPro = await schoolHasProAccess(admin.schoolId!)
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('payment_links')
    .select(
      'id, label, public_token, expires_at, max_uses, use_count, is_active, created_at, activities(name), programmes(name)',
    )
    .eq('school_id', admin.schoolId!)
    .order('created_at', { ascending: false })

  const links = (data as LinkWithActivity[] | null) ?? []

  // Single-domain: pay-links live on the apex (skoolbido.com/pay/<token>).
  const origin = schoolPublicOrigin(serverEnv.appUrl)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Payment Links</h1>
          <p className="mt-1 text-sm text-text-muted">
            {links.filter((l) => l.is_active).length} active · {links.length} total
          </p>
        </div>
        {isPro && (
          <Link
            href="/admin/payment-links/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Create link
          </Link>
        )}
      </div>

      {!isPro && (
        <UpgradePrompt
          title="Payment links are a Pro feature"
          description="Create shareable payment links for trips, books and events. Upgrade to Pro to enable them for your crèche."
        />
      )}

      {links.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <p className="text-text-muted">No payment links have been created yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const payUrl = `${origin}/pay/${link.public_token}`
            const isExpired = link.expires_at ? new Date(link.expires_at) <= new Date() : false
            const isExhausted = link.max_uses != null && link.use_count >= link.max_uses

            return (
              <div key={link.id} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">{link.label}</p>
                    <p className="text-sm text-text-muted">
                      {link.programmes?.name ?? link.activities?.name ?? '—'}
                      <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted ring-1 ring-border">
                        {link.programmes ? 'Programme' : 'Activity'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentLinkActions
                      linkId={link.id}
                      currentStatus={link.is_active}
                      label={link.label}
                    />
                    <Link
                      href={`/admin/payment-links/${link.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>
                    Uses: {link.use_count}
                    {link.max_uses != null ? ` / ${link.max_uses}` : ''}
                  </span>
                  {link.expires_at && (
                    <span className={isExpired ? 'text-error' : ''}>
                      Expires: {formatDate(link.expires_at, true)} {isExpired ? '(expired)' : ''}
                    </span>
                  )}
                  {isExhausted && <span className="text-error">Max uses reached</span>}
                  <span>Created: {formatDate(link.created_at)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-gray-50 px-2 py-1 text-xs text-text-secondary">
                    {payUrl}
                  </code>
                  <CopyLinkButton url={payUrl} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
