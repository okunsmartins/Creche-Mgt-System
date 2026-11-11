import Link from 'next/link'
import { ArrowRight, Receipt, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { ParentFeesSummary } from '@/lib/fees/parent-summary'

/**
 * Parent dashboard: the crèche's regular fees, first and full-width. It's the
 * bill every family has, so it shouldn't hide in a menu. Highlights what's due.
 */
export function ParentFeesCard({ summary }: { summary: ParentFeesSummary }) {
  const due = summary.outstandingCents > 0
  const status = due
    ? `${formatCurrency(summary.outstandingCents)} due · ${summary.unpaidCount} unpaid ${
        summary.unpaidCount === 1 ? 'invoice' : 'invoices'
      }`
    : summary.invoiceCount > 0
      ? 'All paid, thank you'
      : 'No invoices yet'

  return (
    <Link
      href="/parent/invoices"
      data-testid="parent-fees-card"
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:col-span-2 sm:flex-row sm:items-center sm:justify-between ${
        due
          ? 'border-error/30 bg-gradient-to-br from-[#fff1f1] to-[#ffe4e4]'
          : 'border-[#cdeedd] bg-gradient-to-br from-[#effaf4] to-[#e1f5ea]'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10">
          <Receipt className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-text-primary">Fees &amp; Invoices</p>
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-sm font-semibold ${
              due ? 'text-error' : summary.invoiceCount > 0 ? 'text-success' : 'text-text-muted'
            }`}
          >
            {!due && summary.invoiceCount > 0 && (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {status}
          </p>
        </div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-4 py-2 text-sm font-bold sm:self-center ${
          due ? 'bg-error text-white' : 'bg-primary/10 text-primary ring-1 ring-primary/20'
        }`}
      >
        {due ? 'Pay now' : 'View invoices'}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}
