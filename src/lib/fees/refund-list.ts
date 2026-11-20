// Fee refunds (online invoice / late-collection fee payments) for the admin Refunds page
// and its CSV export. Fee refunds have no row in `refunds` (that table is order-only:
// `refunds.order_id` is NOT NULL), so each one is read from its `refund.completed` audit
// event (resource_type 'payment'), written by the admin refund action and by the Stripe
// `charge.refunded` webhook. School-scoped at every step.

import type { createSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface FeeRefundListRow {
  id: string
  createdAt: string
  amountCents: number
  /** "Invoice INV-2026-000028" or "Late collection fee". */
  subjectLabel: string
  childName: string
  studentId: string | null
  /** Admin email, or "Stripe dashboard" when the webhook recorded it. */
  initiatedBy: string
  reason: string | null
  providerRefundId: string | null
  paymentReference: string | null
}

export interface FeeRefundAudit {
  id: string
  created_at: string
  actor_email: string | null
  resource_id: string
  metadata: {
    amount_cents?: number
    subject?: string
    reason?: string | null
    provider_refund_id?: string
    charge_id?: string
  } | null
}

export interface FeeRefundPayment {
  id: string
  payment_reference: string | null
  invoice_id: string | null
  late_collection_id: string | null
}

/**
 * Pure join of audit events → payments → this school's invoices / late fees → children.
 * Events whose payment doesn't resolve to a subject in `subjectStudent` (another crèche's,
 * or deleted) are dropped, so nothing outside the school can appear.
 */
export function buildFeeRefundRows(
  audits: FeeRefundAudit[],
  payments: FeeRefundPayment[],
  /** invoice / late-collection id → student id, for THIS school only. */
  subjectStudent: Map<string, string>,
  childNames: Map<string, string>,
): FeeRefundListRow[] {
  const paymentById = new Map(payments.map((p) => [p.id, p]))
  const rows: FeeRefundListRow[] = []
  for (const a of audits) {
    const p = paymentById.get(a.resource_id)
    const subjectId = p?.invoice_id ?? p?.late_collection_id ?? null
    const studentId = subjectId ? subjectStudent.get(subjectId) : undefined
    if (!p || !studentId) continue
    const m = a.metadata ?? {}
    rows.push({
      id: a.id,
      createdAt: a.created_at,
      amountCents: Number(m.amount_cents ?? 0),
      subjectLabel: m.subject ?? (p.invoice_id ? 'Invoice' : 'Late collection fee'),
      childName: childNames.get(studentId) ?? '—',
      studentId,
      initiatedBy: a.actor_email === 'stripe-webhook' ? 'Stripe dashboard' : (a.actor_email ?? '—'),
      reason: m.reason ?? null,
      providerRefundId: m.provider_refund_id ?? m.charge_id ?? null,
      paymentReference: p.payment_reference,
    })
  }
  return rows
}

/** This school's fee refunds, newest first. */
export async function listFeeRefunds(
  db: AdminClient,
  schoolId: string,
  limit = 200,
): Promise<FeeRefundListRow[]> {
  const { data: auditData } = await db
    .from('audit_logs')
    .select('id, created_at, actor_email, resource_id, metadata')
    .eq('school_id', schoolId)
    .eq('action', 'refund.completed')
    .eq('resource_type', 'payment')
    .order('created_at', { ascending: false })
    .limit(limit)
  const audits = (auditData ?? []) as FeeRefundAudit[]
  if (audits.length === 0) return []

  const { data: payData } = await db
    .from('payments')
    .select('id, payment_reference, invoice_id, late_collection_id')
    .in('id', [...new Set(audits.map((a) => a.resource_id))])
  const payments = (payData ?? []) as FeeRefundPayment[]

  const invoiceIds = [...new Set(payments.map((p) => p.invoice_id).filter(Boolean))] as string[]
  const lateIds = [
    ...new Set(payments.map((p) => p.late_collection_id).filter(Boolean)),
  ] as string[]
  const [{ data: invData }, { data: lateData }] = await Promise.all([
    invoiceIds.length
      ? db.from('invoices').select('id, student_id').eq('school_id', schoolId).in('id', invoiceIds)
      : Promise.resolve({ data: [] }),
    lateIds.length
      ? db
          .from('late_collections')
          .select('id, student_id')
          .eq('school_id', schoolId)
          .in('id', lateIds)
      : Promise.resolve({ data: [] }),
  ])
  const subjectStudent = new Map<string, string>()
  for (const r of [
    ...((invData ?? []) as { id: string; student_id: string }[]),
    ...((lateData ?? []) as { id: string; student_id: string }[]),
  ])
    subjectStudent.set(r.id, r.student_id)

  const studentIds = [...new Set(subjectStudent.values())]
  const { data: kidData } = studentIds.length
    ? await db
        .from('students')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)
        .in('id', studentIds)
    : { data: [] }
  const childNames = new Map(
    ((kidData ?? []) as { id: string; first_name: string; last_name: string }[]).map((k) => [
      k.id,
      `${k.first_name} ${k.last_name}`,
    ]),
  )

  return buildFeeRefundRows(audits, payments, subjectStudent, childNames)
}
