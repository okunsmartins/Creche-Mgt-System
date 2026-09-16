'use client'

import { useActionState } from 'react'
import { SchoolCrest } from '@/components/layout/SchoolCrest'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { SchoolLogoActionState } from '@/lib/schools/schemas'

interface SchoolLogoUploaderProps {
  action: (prev: SchoolLogoActionState, formData: FormData) => Promise<SchoolLogoActionState>
  removeAction: () => Promise<void>
  schoolName: string
  logoUrl: string | null
}

export function SchoolLogoUploader({
  action,
  removeAction,
  schoolName,
  logoUrl,
}: SchoolLogoUploaderProps) {
  const [state, formAction, isPending] = useActionState<SchoolLogoActionState, FormData>(
    action,
    null,
  )

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">School logo</h2>
        <p className="text-xs text-text-muted">
          Shown in the portal header and on the sign-in page. PNG, JPG, or WebP, up to 1&nbsp;MB.
          Square images look best. Leave empty to use the initials crest.
        </p>
      </div>

      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.message}</Alert>}

      <div className="flex items-center gap-5">
        <SchoolCrest name={schoolName} size={72} logoUrl={logoUrl} className="text-xl" />

        <div className="flex-1 space-y-3">
          <form action={formAction} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="logo"
              aria-label="Choose a logo image (PNG, JPG, or WebP, up to 1 MB)"
              accept="image/png,image/jpeg,image/webp"
              required
              disabled={isPending}
              className="block w-full max-w-xs text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
            <Button type="submit" loading={isPending} size="sm">
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
          </form>

          {logoUrl && (
            <form action={removeAction}>
              <button
                type="submit"
                suppressHydrationWarning
                className="text-xs font-medium text-error hover:underline"
              >
                Remove logo
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
