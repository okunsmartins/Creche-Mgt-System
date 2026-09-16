import { Users, ShieldCheck, Landmark, ArrowRight } from 'lucide-react'

/**
 * Illustrated "how payments reach your school" flow, shown on the Payment Setup
 * page. Static (no client JS). Parent pays → Stripe processes → the money lands
 * in the SCHOOL's own bank, with Skool Bido taking 0%.
 */

const STEPS: { icon: typeof Users; title: string; caption: string }[] = [
  {
    icon: Users,
    title: 'A parent pays',
    caption: 'Card payment for a trip, activity or book through your portal.',
  },
  {
    icon: ShieldCheck,
    title: 'Stripe processes it',
    caption: 'Secure card handling — card details never touch your school or us.',
  },
  {
    icon: Landmark,
    title: 'Your school gets paid',
    caption: 'Funds land in your school’s own bank account in a few days.',
  },
]

export function PaymentFlowDiagram() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">How payments reach your school</h2>
        <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          You keep 100% — we take 0%
        </span>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {STEPS.map(({ icon: Icon, title, caption }, i) => (
          <div key={title} className="flex flex-1 items-center gap-3 sm:flex-col sm:text-center">
            <div className="flex flex-col items-center gap-2 sm:w-full">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-primary/20">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
            </div>
            <div className="sm:mt-1">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-0.5 text-xs text-text-muted">{caption}</p>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                className="mx-2 hidden h-5 w-5 shrink-0 rotate-90 text-primary/50 sm:block sm:rotate-0"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Your school is the merchant of record: you manage payouts, receipts, refunds and any
        disputes from your own Stripe dashboard. Skool Bido never holds your money.
      </p>
    </div>
  )
}
