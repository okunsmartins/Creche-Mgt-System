import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { createPaymentLinkAction } from '@/lib/payment-links/actions'
import { requireFeature } from '@/lib/subscriptions/access'
import { PaymentLinkForm } from '@/components/payment-links/PaymentLinkForm'
import type { ActivityRow } from '@/types/database'

export const metadata: Metadata = { title: 'Create Payment Link | Admin' }

export default async function NewPaymentLinkPage() {
  const admin = await requireAdmin()
  // Pro-gated — can't open the create form without access.
  await requireFeature('payment_links', admin.schoolId!)
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('activities')
    .select('id, name, is_active, publication_status')
    .eq('school_id', admin.schoolId!)
    .neq('publication_status', 'archived')
    .order('name')

  const activities =
    (data as Pick<ActivityRow, 'id' | 'name' | 'is_active' | 'publication_status'>[] | null) ?? []

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/payment-links" className="text-sm text-primary hover:underline">
          ← Payment Links
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Create payment link</h1>
        <p className="mt-1 text-sm text-text-muted">
          Generate a shareable link that pre-selects an activity for guest payers.
        </p>
      </div>

      <div className="card p-6">
        <PaymentLinkForm action={createPaymentLinkAction} activities={activities} />
      </div>
    </div>
  )
}
