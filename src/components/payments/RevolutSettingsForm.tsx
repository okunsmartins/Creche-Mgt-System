'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  saveRevolutCredentialsAction,
  disconnectRevolutAction,
  type RevolutSettingsState,
} from '@/lib/revolut/settingsActions'

/**
 * Lets an admin store their school's own Revolut Merchant API key (+ webhook
 * secret), so Revolut parent payments go to the school. Keys are write-only:
 * saved encrypted, never shown back.
 */
export function RevolutSettingsForm({ configured }: { configured: boolean }) {
  const [state, formAction, isPending] = useActionState<RevolutSettingsState, FormData>(
    saveRevolutCredentialsAction,
    null,
  )
  const [disc, discAction, discPending] = useActionState<RevolutSettingsState, FormData>(
    disconnectRevolutAction,
    null,
  )

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Revolut (optional)</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Prefer Revolut? Add your school&apos;s Revolut Merchant API key so those payments go
            straight to your Revolut account.
          </p>
        </div>
        {configured && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Connected
          </span>
        )}
      </div>

      {state?.success && <Alert variant="success">Saved. Your Revolut account is connected.</Alert>}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {disc?.success && <Alert variant="success">Revolut disconnected.</Alert>}

      <form action={formAction} className="space-y-3 border-t border-border pt-4">
        <div>
          <label htmlFor="apiKey" className="mb-1 block text-sm font-medium text-text-primary">
            Merchant API key{' '}
            {configured && <span className="text-text-muted">(enter to replace)</span>}
          </label>
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder="sk_..."
            className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div>
          <label
            htmlFor="webhookSecret"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Webhook signing secret <span className="text-text-muted">(recommended)</span>
          </label>
          <input
            id="webhookSecret"
            name="webhookSecret"
            type="password"
            autoComplete="off"
            className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
          <p className="mt-1 text-xs text-text-muted">
            From your Revolut webhook set to
            <span className="font-mono"> /api/webhooks/revolut</span>. Stored encrypted; never shown
            again.
          </p>
        </div>
        <Button type="submit" loading={isPending}>
          {configured ? 'Update Revolut details' : 'Save Revolut details'}
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
