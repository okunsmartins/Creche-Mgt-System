'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { SOCIAL_PLATFORMS, type SocialLink } from '@/lib/social/links'
import { saveSocialLinksAction, type SocialLinksState } from '@/lib/social/actions'
import { SOCIAL_GLYPHS } from '@/components/social/socialGlyphs'

/** Crèche Settings → Social media: one optional link per network. */
export function SocialLinksForm({ links }: { links: SocialLink[] }) {
  const [state, action, pending] = useActionState<SocialLinksState, FormData>(
    saveSocialLinksAction,
    null,
  )
  const current = new Map(links.map((l) => [l.key, l.url]))

  return (
    <form action={action} className="card space-y-4 p-6" noValidate>
      <div>
        <h2 className="text-lg font-bold text-text-primary">Social media</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Add your crèche&apos;s pages and they appear as buttons on your sign-in page and your
          public page. Leave a box empty to hide that network.
        </p>
      </div>

      {state?.ok && <Alert variant="success">Social links saved.</Alert>}
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {SOCIAL_PLATFORMS.map((p) => {
        const g = SOCIAL_GLYPHS[p.key]
        const err = state?.fieldErrors?.[p.key]
        return (
          <div key={p.key} className="flex flex-col gap-1">
            <label htmlFor={`social-${p.key}`} className="form-label flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill={g.hex} aria-hidden="true">
                <path d={g.path} />
              </svg>
              {p.label}
            </label>
            <input
              id={`social-${p.key}`}
              name={p.key}
              type="text"
              inputMode="url"
              autoComplete="off"
              defaultValue={current.get(p.key) ?? ''}
              placeholder={p.placeholder}
              aria-invalid={!!err}
              aria-describedby={err ? `social-${p.key}-error` : undefined}
              className="input-base"
            />
            {err && (
              <p id={`social-${p.key}-error`} role="alert" className="text-xs text-error">
                {err}
              </p>
            )}
          </div>
        )
      })}

      <Button type="submit" loading={pending}>
        Save social links
      </Button>
    </form>
  )
}
