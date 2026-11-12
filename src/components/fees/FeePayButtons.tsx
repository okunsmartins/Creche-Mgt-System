'use client'

import { useState, useTransition } from 'react'
import { CreditCard } from 'lucide-react'

export type FeePayMethod = 'card' | 'revolut'
export type FeePayResult = { url: string } | { error: string }

/** What the crèche accepts online (from getFeePaymentOptions on the server). */
export interface FeePayOptions {
  card: boolean
  revolut: boolean
}

/** Revolut's "R" mark, drawn inline so no external asset is needed. */
function RevolutMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-white text-[11px] font-black leading-none text-black"
    >
      R
    </span>
  )
}

/**
 * Pay buttons for a fee: "Pay by card" and/or "Pay with Revolut", depending on what
 * the crèche has connected. With neither connected, a single "Pay now" still shows
 * so the server can explain that online payment isn't set up.
 */
export function FeePayButtons({
  options,
  start,
}: {
  options: FeePayOptions
  start: (method?: FeePayMethod) => Promise<FeePayResult>
}) {
  const [pending, startTransition] = useTransition()
  const [which, setWhich] = useState<FeePayMethod | 'auto' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pay(method?: FeePayMethod) {
    setError(null)
    setWhich(method ?? 'auto')
    startTransition(async () => {
      const res = await start(method)
      if ('url' in res) {
        window.location.href = res.url
      } else {
        setError(res.error)
        setWhich(null)
      }
    })
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
  const none = !options.card && !options.revolut

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex flex-wrap justify-end gap-2">
        {(options.card || none) && (
          <button
            type="button"
            onClick={() => pay(none ? undefined : 'card')}
            disabled={pending}
            className={`${base} bg-primary text-white hover:bg-primary-hover`}
          >
            {options.card && <CreditCard className="h-4 w-4" aria-hidden="true" />}
            {pending && (which === 'card' || which === 'auto')
              ? 'Starting…'
              : options.card && options.revolut
                ? 'Pay by card'
                : 'Pay now'}
          </button>
        )}
        {options.revolut && (
          <button
            type="button"
            onClick={() => pay('revolut')}
            disabled={pending}
            className={`${base} bg-black text-white hover:bg-neutral-800`}
          >
            <RevolutMark />
            {pending && which === 'revolut' ? 'Starting…' : 'Pay with Revolut'}
          </button>
        )}
      </span>
      {error && <span className="max-w-[18rem] text-right text-xs text-error">{error}</span>}
    </span>
  )
}
