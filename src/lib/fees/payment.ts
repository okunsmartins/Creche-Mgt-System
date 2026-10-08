'use server'

import { requireVerifiedAuth } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getSchoolConnect, connectStatus } from '@/lib/stripe/connect'
import { revolutPost } from '@/lib/revolut/client'
import { resolveRevolutApiKey, schoolHasOwnRevolut } from '@/lib/revolut/perSchool'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

type CheckoutResult = { url: string } | { error: string }
type SubjectKind = 'invoice' | 'late_fee'

const PAYABLE_INVOICE = new Set(['issued', 'part_paid'])

const NOT_SET_UP =
  'This crèche hasn’t finished setting up card payments yet. Please contact the crèche.'

/**
 * Start a card checkout for a fees invoice / late-collection fee on the crèche's OWN
 * payment account — Stripe Connect if active, else the crèche's own Revolut. Funds go
 * to the crèche; the webhook (metadata.kind) marks the subject paid on success.
 */
async function startFeeCheckout(p: {
  schoolId: string
  kind: SubjectKind
  subjectId: string
  amountCents: number
  amountPaidCents: number
  label: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const metaIdKey = p.kind === 'invoice' ? 'invoice_id' : 'late_collection_id'
  const metadata = { kind: p.kind, [metaIdKey]: p.subjectId, school_id: p.schoolId }

  // 1) Stripe Connect (direct charge on the crèche's connected account).
  const connect = await getSchoolConnect(p.schoolId)
  if (connectStatus(connect) === 'active' && connect?.stripe_connect_account_id) {
    try {
      const session = await getStripe().checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: { name: p.label },
                unit_amount: p.amountCents,
              },
              quantity: 1,
            },
          ],
          success_url: p.successUrl,
          cancel_url: p.cancelUrl,
          metadata,
          payment_intent_data: { metadata },
        },
        {
          stripeAccount: connect.stripe_connect_account_id,
          idempotencyKey: `${p.kind}-${p.subjectId}-${p.amountPaidCents}-${p.amountCents}`,
        },
      )
      return session.url
        ? { url: session.url }
        : { error: 'Failed to start payment. Please try again.' }
    } catch (err) {
      logger.error('fee_stripe_checkout_failed', {
        kind: p.kind,
        subjectId: p.subjectId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return { error: 'Failed to start payment. Please try again.' }
    }
  }

  // 2) The crèche's own Revolut account.
  if (await schoolHasOwnRevolut(p.schoolId)) {
    try {
      const apiKey = await resolveRevolutApiKey(p.schoolId)
      // ext_ref lets the webhook resolve the crèche (see schoolIdFromExtRef).
      const extRef = `${p.kind === 'invoice' ? 'INVPAY' : 'LFPAY'}_${p.subjectId}`
      const created = await revolutPost<{ id: string; checkout_url?: string }>(
        '/orders',
        {
          amount: p.amountCents,
          currency: 'EUR',
          merchant_order_ext_ref: extRef,
          metadata,
          redirect_url: p.successUrl,
        },
        apiKey,
      )
      return created.checkout_url
        ? { url: created.checkout_url }
        : { error: 'Failed to start payment. Please try again.' }
    } catch (err) {
      logger.error('fee_revolut_checkout_failed', {
        kind: p.kind,
        subjectId: p.subjectId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return { error: 'Failed to start payment. Please try again.' }
    }
  }

  return { error: NOT_SET_UP }
}

/** Start a checkout for a parent to pay a fees invoice online. Parent-authed. */
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

  if (!(await parentLinkedToChild(db, user.id, invoice.student_id, invoice.school_id)))
    return { error: 'Invoice not found.' }

  if (!PAYABLE_INVOICE.has(invoice.status))
    return {
      error:
        invoice.status === 'paid'
          ? 'This invoice is already paid.'
          : 'This invoice cannot be paid yet.',
    }
  const outstanding = Math.max(0, invoice.net_parent_cents - invoice.amount_paid_cents)
  if (outstanding <= 0) return { error: 'This invoice is already paid.' }

  if (!(await schoolHasProAccess(invoice.school_id)))
    return { error: 'This crèche’s portal is not active. Please contact the crèche.' }

  const appUrl = serverEnv.appUrl
  return startFeeCheckout({
    schoolId: invoice.school_id,
    kind: 'invoice',
    subjectId: invoice.id,
    amountCents: outstanding,
    amountPaidCents: invoice.amount_paid_cents,
    label: `Fees invoice ${invoice.invoice_number}`,
    successUrl: `${appUrl}/parent/invoices?paid=1`,
    cancelUrl: `${appUrl}/parent/invoices`,
  })
}

/** Start a checkout for a parent to pay a late-collection fee online. Parent-authed. */
export async function createLateFeePaymentCheckoutAction(
  lateCollectionId: string,
): Promise<CheckoutResult> {
  const user = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  const { data: lcData } = await db
    .from('late_collections')
    .select('id, school_id, student_id, fee_cents, amount_paid_cents')
    .eq('id', lateCollectionId)
    .maybeSingle()
  const lc = lcData as {
    id: string
    school_id: string
    student_id: string
    fee_cents: number
    amount_paid_cents: number
  } | null
  if (!lc) return { error: 'Late fee not found.' }

  if (!(await parentLinkedToChild(db, user.id, lc.student_id, lc.school_id)))
    return { error: 'Late fee not found.' }

  const outstanding = Math.max(0, lc.fee_cents - lc.amount_paid_cents)
  if (outstanding <= 0) return { error: 'This late fee is already paid.' }

  if (!(await schoolHasProAccess(lc.school_id)))
    return { error: 'This crèche’s portal is not active. Please contact the crèche.' }

  const appUrl = serverEnv.appUrl
  return startFeeCheckout({
    schoolId: lc.school_id,
    kind: 'late_fee',
    subjectId: lc.id,
    amountCents: outstanding,
    amountPaidCents: lc.amount_paid_cents,
    label: 'Late collection fee',
    successUrl: `${appUrl}/parent/late-fees?paid=1`,
    cancelUrl: `${appUrl}/parent/late-fees`,
  })
}

type DbClient = ReturnType<typeof createSupabaseAdminClient>

/** The signed-in parent must have an active link to this child in this crèche. */
async function parentLinkedToChild(
  db: DbClient,
  parentId: string,
  studentId: string,
  schoolId: string,
): Promise<boolean> {
  const { data } = await db
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle()
  return Boolean(data)
}
