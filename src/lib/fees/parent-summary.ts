import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * What a parent owes across their children's invoices. Shown on the parent
 * dashboard's Fees & Invoices card and as the total on /parent/invoices.
 */

/** Statuses a parent can see. Drafts and voided invoices are never shown. */
export const PARENT_VISIBLE_INVOICE_STATUSES = ['issued', 'part_paid', 'paid'] as const

type InvoiceLike = { status: string; net_parent_cents: number; amount_paid_cents: number }

export type ParentFeesSummary = {
  /** Sum still to pay across unpaid / part-paid invoices. */
  outstandingCents: number
  /** Invoices with something still to pay. */
  unpaidCount: number
  /** All invoices the parent can see. */
  invoiceCount: number
}

/** Pure: unit-tested. */
export function summariseParentInvoices(invoices: InvoiceLike[]): ParentFeesSummary {
  let outstandingCents = 0
  let unpaidCount = 0
  for (const i of invoices) {
    if (i.status === 'paid') continue
    const left = Math.max(0, i.net_parent_cents - i.amount_paid_cents)
    if (left > 0) {
      outstandingCents += left
      unpaidCount += 1
    }
  }
  return { outstandingCents, unpaidCount, invoiceCount: invoices.length }
}

/**
 * The signed-in parent's summary. Scoped to their own ACTIVE child links: the
 * admin client bypasses RLS, so this scoping is the security boundary.
 */
export async function getParentFeesSummary(parentId: string): Promise<ParentFeesSummary> {
  const db = createSupabaseAdminClient()
  const { data: links } = await db
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('is_active', true)
  const childIds = (links ?? []).map((l) => (l as { student_id: string }).student_id)
  if (childIds.length === 0) return { outstandingCents: 0, unpaidCount: 0, invoiceCount: 0 }

  const { data } = await db
    .from('invoices')
    .select('status, net_parent_cents, amount_paid_cents')
    .in('student_id', childIds)
    .in('status', [...PARENT_VISIBLE_INVOICE_STATUSES])
  return summariseParentInvoices((data ?? []) as InvoiceLike[])
}
