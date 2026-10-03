'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { NotebookPen, Camera, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createObservationAction, type ObservationActionState } from '@/lib/observations/actions'
import {
  AISTEAR_THEMES,
  AISTEAR_THEME_LABELS,
  OBSERVATION_ACCEPT,
  OBSERVATION_MAX_BYTES,
  acceptedImageExt,
} from '@/lib/observations/observations'
import type { StudentOption } from '@/lib/observations/queries'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ObservationComposer({ studentOptions }: { studentOptions: StudentOption[] }) {
  const [state, formAction, isPending] = useActionState<ObservationActionState, FormData>(
    createObservationAction,
    {},
  )
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p)
        return null
      })
      setFileError(null)
    }
  }, [state.success])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p)
      return file && acceptedImageExt(file.type) ? URL.createObjectURL(file) : null
    })
    if (!file) return setFileError(null)
    if (!acceptedImageExt(file.type))
      return setFileError('Photo must be a JPG, PNG, WEBP or HEIC image.')
    if (file.size > OBSERVATION_MAX_BYTES) return setFileError('Photo is too large (max 10 MB).')
    setFileError(null)
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = ''
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p)
      return null
    })
    setFileError(null)
  }

  const noChildren = studentOptions.length === 0
  const options = studentOptions.map((s) => ({
    value: s.id,
    label: s.className ? `${s.name} · ${s.className}` : s.name,
  }))

  return (
    <div className="space-y-4">
      <div>
        <Button type="button" onClick={() => setOpen((v) => !v)} disabled={noChildren}>
          <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {open ? 'Cancel' : 'Record an observation'}
        </Button>
        {noChildren && (
          <p className="mt-2 text-xs text-text-muted">No children available to observe yet.</p>
        )}
      </div>

      {state.success && (
        <Alert variant="success">Observation saved. It appears in the timeline below.</Alert>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      {open && (
        <form
          ref={formRef}
          action={formAction}
          className="space-y-4 rounded-xl border border-border bg-surface p-5"
        >
          <Select
            name="studentId"
            label="Child"
            required
            options={options}
            placeholder="Choose a child"
          />

          <Input
            name="title"
            label="Title"
            required
            maxLength={140}
            placeholder="e.g. Water play at the sand &amp; water table"
          />

          <div>
            <label
              htmlFor="obs-story"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Learning story / observation
            </label>
            <textarea
              id="obs-story"
              name="learningStory"
              required
              rows={4}
              className="input-base"
              placeholder="What did you notice? What was the child doing, saying, exploring?"
            />
          </div>

          <Input
            name="observationDate"
            label="Observation date"
            type="date"
            required
            defaultValue={todayISO()}
          />

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-text-primary">
              Aistear themes <span className="font-normal text-text-muted">(optional)</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AISTEAR_THEMES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    name="themes"
                    value={t}
                    className="h-4 w-4 rounded border-border"
                  />
                  {AISTEAR_THEME_LABELS[t]}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="obs-next"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Next steps <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              id="obs-next"
              name="nextSteps"
              rows={2}
              className="input-base"
              placeholder="How will you build on this next?"
            />
          </div>

          <div>
            <label
              htmlFor="obs-photo"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Photo <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              ref={fileRef}
              id="obs-photo"
              name="file"
              type="file"
              accept={OBSERVATION_ACCEPT}
              capture="environment"
              onChange={onFileChange}
              className="block w-full cursor-pointer rounded-lg border border-border bg-background text-sm text-text-secondary file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-raised file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/10"
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              On a phone this opens the camera. JPG, PNG, WEBP or HEIC, up to 10 MB.
            </p>
            {fileError && <p className="mt-1 text-xs text-error">{fileError}</p>}
            {preview && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img
                  src={preview}
                  alt="Selected photo preview"
                  className="h-16 w-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Remove selected photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              name="sharedWithParents"
              defaultChecked
              className="h-4 w-4 rounded border-border"
            />
            Share with the child&apos;s parents
          </label>

          <Button type="submit" loading={isPending} disabled={isPending || !!fileError}>
            Save observation
          </Button>
        </form>
      )}
    </div>
  )
}
