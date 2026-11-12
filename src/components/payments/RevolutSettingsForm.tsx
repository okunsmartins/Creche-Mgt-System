'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  saveRevolutCredentialsAction,
  disconnectRevolutAction,
  type RevolutSettingsState,
} from '@/lib/revolut/settingsActions'

/**
 * Connect the crèche's own Revolut Business account so parents can pay with Revolut
 * and the money goes straight to the crèche. The admin pastes ONE key; the server
 * sets up the webhook automatically. Keys are write-only: stored encrypted, never shown.
 */
export function RevolutSettingsForm({
  configured,
  testMode,
}: {
  configured: boolean
  testMode: boolean
}) {
  const [state, formAction, isPending] = useActionState<RevolutSettingsState, FormData>(
    saveRevolutCredentialsAction,
    null,
  )
  const [disc, discAction, discPending] = useActionState<RevolutSettingsState, FormData>(
    disconnectRevolutAction,
    null,
  )
  const keyKind = testMode ? 'Sandbox' : 'Production'

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-lg font-black text-white"
          >
            R
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Revolut Business</p>
            <p className="text-xs text-text-muted">
              Let parents pay with Revolut. Money goes straight to your Revolut account.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {testMode && <Badge variant="warning">Test mode</Badge>}
          {configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Connected
            </span>
          ) : (
            <Badge variant="default">Not connected</Badge>
          )}
        </div>
      </div>

      {state?.success && (
        <Alert variant="success">
          Revolut is connected. Parents now see a “Pay with Revolut” button on their invoices.
        </Alert>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {disc?.success && <Alert variant="success">Revolut disconnected.</Alert>}

      {configured ? (
        <p className="border-t border-border pt-4 text-sm text-text-secondary">
          You&apos;re ready to take Revolut payments. Parents can pay invoices, late fees and extras
          with Revolut, and you manage refunds and payouts in{' '}
          <a
            href="https://business.revolut.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Revolut Business
          </a>
          .
        </p>
      ) : (
        <ol className="ml-4 list-decimal space-y-1.5 border-t border-border pt-4 text-sm text-text-secondary">
          <li>
            Sign in to{' '}
            <a
              href={
                testMode ? 'https://sandbox-business.revolut.com' : 'https://business.revolut.com'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Revolut Business
            </a>{' '}
            and go to <strong>APIs → Merchant API</strong>.
          </li>
          <li>
            Copy your <strong>{keyKind} Secret key</strong> (it starts with <code>sk_</code>).
          </li>
          <li>Paste it below and click Connect. We set up everything else for you.</li>
        </ol>
      )}

      <form action={formAction} className="space-y-3">
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="sk_..."
          label={configured ? 'Secret key (paste a new one to replace it)' : 'Secret key'}
        />
        <details className="text-sm text-text-muted">
          <summary className="cursor-pointer select-none">Advanced</summary>
          <div className="mt-3">
            <Input
              id="webhookSecret"
              name="webhookSecret"
              type="password"
              autoComplete="off"
              label="Webhook signing secret (only if asked by support)"
              hint="Leave empty: we create the webhook for you automatically."
            />
          </div>
        </details>
        <Button type="submit" loading={isPending}>
          {configured ? 'Update Revolut key' : 'Connect Revolut'}
        </Button>
      </form>

      {configured && (
        <form action={discAction} className="border-t border-border pt-3">
          <button
            type="submit"
            disabled={discPending}
            className="text-xs font-medium text-error hover:underline disabled:opacity-50"
          >
            Disconnect Revolut
          </button>
        </form>
      )}
    </div>
  )
}
