'use server'

import { requireVerifiedAuth } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getSchoolConnect, connectStatus } from '@/lib/stripe/connect'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

type CheckoutResult = { url: string } | { error: string }

const PAYABLE = new Set(['issued', 'part_paid'])

/**
 * Start a Stripe Checkout for a parent to pay a fees invoice online. The charge is a
 * DIRECT charge on the crèche's OWN connected account (funds go to the crèche). The
 * webhook (metadata.kind='invoice') marks the invoice paid on success. The parent
 * must be linked to the invoice's child.
 */
export async function createInvoicePaymentCheckoutAction(
  invoiceId: string,
): Promise<CheckoutResult> {
  const user = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  const { data: invData } = await db
    .from('invoices')
    .select(
      'id, school_id, student_id, invoice_number, net_parent_cents, amount_paid_cents, status',
    )
    .eq('id', invoiceId)
    .maybeSingle()
  const invoice = invData as {
    id: string
    school_id: string
    student_id: string
    invoice_number: string
    net_parent_cents: number
    amount_paid_cents: number
    status: string
  } | null
  if (!invoice) return { error: 'Invoice not found.' }

  // The signed-in parent must be linked to this child.
  const { data: link } = await db
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('student_id', invoice.student_id)
    .eq('is_active', true)
    .maybeSingle()
  if (!link) return { error: 'Invoice not found.' }

  if (!PAYABLE.has(invoice.status)) {
    return {
      error:
        invoice.status === 'paid'
          ? 'This invoice is already paid.'
          : 'This invoice cannot be paid yet.',
    }
  }
  const outstanding = Math.max(0, invoice.net_parent_cents - invoice.amount_paid_cents)
  if (outstanding <= 0) return { error: 'This invoice is already paid.' }

  if (!(await schoolHasProAccess(invoice.school_id))) {
    return { error: 'This crèche’s portal is not active. Please contact the crèche.' }
  }

  // Direct charge on the crèche's own connected Stripe account.
  const connect = await getSchoolConnect(invoice.school_id)
  if (connectStatus(connect) !== 'active' || !connect?.stripe_connect_account_id) {
    return {
      error: 'This crèche hasn’t finished setting up card payments yet. Please contact the crèche.',
    }
  }

  const appUrl = serverEnv.appUrl
  const stripe = getStripe()
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: { name: `Fees invoice ${invoice.invoice_number}` },
              unit_amount: outstanding,
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/parent/invoices?paid=1`,
        cancel_url: `${appUrl}/parent/invoices`,
        metadata: { kind: 'invoice', invoice_id: invoice.id, school_id: invoice.school_id },
        payment_intent_data: {
          metadata: { kind: 'invoice', invoice_id: invoice.id },
        },
      },
      {
        stripeAccount: connect.stripe_connect_account_id,
        // Stable for double-clicks of the same outstanding balance; changes as the
        // balance changes (after a partial payment) so the next instalment can start.
        idempotencyKey: `invoice-${invoice.id}-${invoice.amount_paid_cents}-${outstanding}`,
      },
    )
    if (!session.url) return { error: 'Failed to start payment. Please try again.' }
    return { url: session.url }
  } catch (err) {
    logger.error('invoice_checkout_create_failed', {
      invoiceId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Failed to start payment. Please try again.' }
  }
}
