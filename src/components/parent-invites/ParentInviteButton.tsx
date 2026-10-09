'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createParentInviteAction } from '@/lib/parent-invites/actions'

/**
 * Admin: generate a single-use parent invite link for this child. The crèche emails
 * the resulting URL to the parent, who creates an account (or signs in) and is
 * auto-linked to the child. Valid 14 days.
 */
export function ParentInviteButton({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function generate() {
    setError(null)
    setCopied(false)
    startTransition(async () => {
      const res = await createParentInviteAction(studentId)
      if (res.ok) setUrl(res.url)
      else setError(res.error)
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link and copy it manually.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Generate a single-use link (valid 14 days) to email the parent so they can set up their
        account and be linked to this child.
      </p>
      {error && <Alert variant="error">{error}</Alert>}

      {url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-gray-50 px-2 py-1.5 text-xs text-text-secondary">
              {url}
            </code>
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="text-xs text-text-muted hover:underline disabled:opacity-50"
          >
            {pending ? 'Generating…' : 'Generate a new link'}
          </button>
        </div>
      ) : (
        <Button type="button" onClick={generate} loading={pending}>
          Generate parent invite link
        </Button>
      )}
    </div>
  )
}
