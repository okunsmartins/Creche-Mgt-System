import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { schoolPublicOrigin } from '@/lib/tenant/urls'
import { updatePaymentLinkAction } from '@/lib/payment-links/actions'
import { PaymentLinkForm } from '@/components/payment-links/PaymentLinkForm'
import { CopyLinkButton } from '@/components/payment-links/CopyLinkButton'
import type { ActivityRow, PaymentLinkRow } from '@/types/database'

export const metadata: Metadata = { title: 'Edit Payment Link | Admin' }

export default async function EditPaymentLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  const [linkResult, activitiesResult] = await Promise.all([
    adminClient
      .from('payment_links')
      .select('id, activity_id, label, public_token, expires_at, max_uses, use_count, is_active')
      .eq('id', id)
      .eq('school_id', admin.schoolId!)
      .single(),
    adminClient
      .from('activities')
      .select('id, name, is_active, publication_status')
      .eq('school_id', admin.schoolId!)
      .neq('publication_status', 'archived')
      .order('name'),
  ])

  if (!linkResult.data) notFound()

  const link = linkResult.data as PaymentLinkRow
  const activities =
    (activitiesResult.data as
      | Pick<ActivityRow, 'id' | 'name' | 'is_active' | 'publication_status'>[]
      | null) ?? []
  // Single-domain: pay-links live on the apex (skoolbido.com/pay/<token>).
  const origin = schoolPublicOrigin(serverEnv.appUrl)
  const payUrl = `${origin}/pay/${link.public_token}`
  const boundAction = updatePaymentLinkAction.bind(null, id)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/payment-links" className="text-sm text-primary hover:underline">
          ← Payment Links
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Edit payment link</h1>
      </div>

      <div className="card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Shareable URL
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-gray-50 px-2 py-1.5 text-xs text-text-secondary">
            {payUrl}
          </code>
          <CopyLinkButton url={payUrl} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Uses: {link.use_count}
          {link.max_uses != null ? ` / ${link.max_uses}` : ''}
        </p>
      </div>

      <div className="card p-6">
        <PaymentLinkForm
          action={boundAction}
          activities={activities}
          link={link}
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
