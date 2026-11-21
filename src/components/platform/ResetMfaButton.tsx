'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetAdminMfaAction } from '@/lib/platform/mfaActions'

/** Owner removes an admin's authenticator (lost phone). Confirmed first; audited server-side. */
export function ResetMfaButton({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="flex items-center justify-end gap-2">
      {msg && <span className="text-xs text-text-muted">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Reset two-step sign-in for ${name}? They'll have to set it up again with their phone at their next sign-in.`,
            )
          )
            return
          setMsg(null)
          startTransition(async () => {
            const res = await resetAdminMfaAction(userId)
            setMsg(res.error ?? 'Reset. They set it up again at their next sign-in.')
          })
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-error ring-1 ring-error/30 transition-colors hover:bg-error/10 disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? 'Resetting…' : 'Reset'}
      </button>
    </div>
  )
}
