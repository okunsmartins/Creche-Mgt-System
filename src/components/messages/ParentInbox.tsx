'use client'

import { useState } from 'react'
import { Mail, MailOpen } from 'lucide-react'
import { markMessageReadAction } from '@/lib/messages/actions'

export interface InboxMessage {
  recipientId: string
  subject: string
  body: string
  senderName: string
  createdAt: string
  read: boolean
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ParentInbox({ messages }: { messages: InboxMessage[] }) {
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(messages.filter((m) => m.read).map((m) => m.recipientId)),
  )

  if (messages.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
        You have no messages yet.
      </p>
    )
  }

  function handleToggle(m: InboxMessage, open: boolean) {
    if (open && !readIds.has(m.recipientId)) {
      setReadIds((prev) => new Set(prev).add(m.recipientId))
      // Fire-and-forget; the row is already shown, marking read is best-effort.
      void markMessageReadAction(m.recipientId)
    }
  }

  return (
    <ul className="space-y-2">
      {messages.map((m) => {
        const isRead = readIds.has(m.recipientId)
        return (
          <li key={m.recipientId}>
            <details
              className="group overflow-hidden rounded-xl border border-border bg-surface"
              onToggle={(e) => handleToggle(m, (e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-surface-raised">
                {isRead ? (
                  <MailOpen
                    className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                ) : (
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${isRead ? 'font-medium text-text-primary' : 'font-bold text-text-primary'}`}
                  >
                    {m.subject}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {m.senderName} · {formatWhen(m.createdAt)}
                  </span>
                </span>
                {!isRead && (
                  <span className="mt-1 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    New
                  </span>
                )}
              </summary>
              <div className="whitespace-pre-wrap border-t border-border px-4 py-3 text-sm leading-relaxed text-text-secondary">
                {m.body}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
