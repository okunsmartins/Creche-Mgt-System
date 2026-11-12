import { Fragment } from 'react'
import { Users, ShieldCheck, Landmark, ArrowRight } from 'lucide-react'

/**
 * Illustrated "how payments reach your crèche" flow, shown on the Payment Setup
 * page. Static (no client JS). Parent pays → Stripe processes → the money lands
 * in the SCHOOL's own bank, with Creche Wise taking 0%.
 */

const STEPS: { icon: typeof Users; title: string; caption: string }[] = [
  {
    icon: Users,
    title: 'A parent pays',
    caption: 'Card payment for fees, an invoice or an extra through your portal.',
  },
  {
    icon: ShieldCheck,
    title: 'Stripe processes it',
    caption: 'Secure card handling — card details never touch your crèche or us.',
  },
  {
    icon: Landmark,
    title: 'Your crèche gets paid',
    caption: 'Funds land in your crèche’s own bank account in a few days.',
  },
]

export function PaymentFlowDiagram() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">How payments reach your crèche</h2>
        <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          You keep 100% — we take 0%
        </span>
      </div>

      {/* Steps sit top-aligned with the arrows as separate items between them, so
          every icon lines up on the same row whatever the caption length. */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
        {STEPS.map(({ icon: Icon, title, caption }, i) => (
          <Fragment key={title}>
            <div className="flex flex-1 items-center gap-3 sm:flex-col sm:text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-primary/20">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div className="sm:mt-1">
                <p className="text-sm font-semibold text-text-primary">{title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{caption}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                className="hidden h-5 w-5 shrink-0 text-primary/50 sm:mt-3.5 sm:block"
                aria-hidden="true"
              />
            )}
          </Fragment>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Your crèche is the merchant of record: you manage payouts, receipts, refunds and any
        disputes from your own Stripe dashboard. Creche Wise never holds your money.
      </p>
    </div>
  )
}
