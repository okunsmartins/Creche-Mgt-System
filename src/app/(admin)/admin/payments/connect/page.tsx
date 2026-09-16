import type { Metadata } from 'next'
import { CheckCircle2, Clock, CreditCard, ArrowRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getSchoolConnect,
  connectStatus,
  syncSchoolConnectFromStripe,
  type ConnectStatus,
} from '@/lib/stripe/connect'
import { schoolHasOwnRevolut } from '@/lib/revolut/perSchool'
import { ConnectStripeButton } from '@/components/payments/ConnectStripeButton'
import { PaymentFlowDiagram } from '@/components/payments/PaymentFlowDiagram'
import { RevolutSettingsForm } from '@/components/payments/RevolutSettingsForm'
import { Badge } from '@/components/ui/Badge'

export const metadata: Metadata = { title: 'Payment setup | Admin' }

// Status flips via the account.updated webhook / on-return sync, so never cache.
export const dynamic = 'force-dynamic'

export default async function ConnectPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const { state } = await searchParams

  // Returning from Stripe's onboarding — pull the latest state immediately
  // rather than waiting for the webhook.
  const status: ConnectStatus =
    state === 'return' || state === 'refresh'
      ? await syncSchoolConnectFromStripe(schoolId)
      : connectStatus(await getSchoolConnect(schoolId))

  const revolutConfigured = await schoolHasOwnRevolut(schoolId)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payment setup</h1>
        <p className="mt-1 text-sm text-text-muted">
          Connect your school&apos;s own Stripe account so parent payments go straight to you.
        </p>
      </div>

      <PaymentFlowDiagram />

      <div className="card space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Stripe account</p>
              <p className="text-xs text-text-muted">
                Direct payments to your school — no fee from us.
              </p>
            </div>
          </div>
          {status === 'active' && <Badge variant="success">Connected</Badge>}
          {status === 'pending' && <Badge variant="warning">Setup incomplete</Badge>}
          {status === 'not_started' && <Badge variant="default">Not connected</Badge>}
        </div>

        <div className="border-t border-border pt-5">
          {status === 'active' ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary">You&apos;re ready to take payments.</p>
                <p className="mt-1">
                  Parent and guest payments for activities, trips and books go directly into your
                  school&apos;s Stripe account. You manage payouts, refunds and receipts from your
                  own{' '}
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    Stripe dashboard
                  </a>
                  .
                </p>
              </div>
            </div>
          ) : status === 'pending' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-sm text-text-secondary">
                  Your Stripe setup isn&apos;t finished yet, so you can&apos;t take payments.
                  Continue where you left off — Stripe may need a few more details (bank account,
                  ID).
                </p>
              </div>
              <ConnectStripeButton label="Continue Stripe setup" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                To collect payments from parents, connect your school&apos;s Stripe account. Money
                goes <strong>directly to your school</strong> — we don&apos;t take a cut.
                You&apos;ll add your bank details and verify your identity with Stripe (about 5
                minutes), then you&apos;re ready to get paid.
              </p>
              <ol className="ml-4 list-decimal space-y-1.5 text-sm text-text-secondary">
                <li>Click “Connect Stripe” below.</li>
                <li>
                  Sign in to Stripe (or create an account) and enter your school&apos;s details.
                </li>
                <li>Add the bank account where you want payments to land.</li>
                <li>
                  Return here — you&apos;ll be marked “Connected” and can start taking payments.
                </li>
              </ol>
              <ConnectStripeButton label="Connect Stripe" />
            </div>
          )}
        </div>
      </div>

      <RevolutSettingsForm configured={revolutConfigured} />

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
        Payments are processed securely by Stripe.
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        Your school is the merchant of record.
      </p>
    </div>
  )
}
