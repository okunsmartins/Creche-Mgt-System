'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Camera, Upload, FileText, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { uploadAssignmentAction, type AssignmentActionState } from '@/lib/assignments/actions'
import {
  ASSIGNMENT_ACCEPT,
  ASSIGNMENT_MAX_BYTES,
  acceptedAssignmentType,
  formatFileSize,
} from '@/lib/assignments/validate'
import type { SelectOption } from '@/types'

interface AssignmentUploaderProps {
  /** The parent's linked children, as select options (value = studentId). */
  childOptions: SelectOption[]
}

interface Picked {
  name: string
  size: number
  isImage: boolean
  previewUrl: string | null
  tooBig: boolean
  unsupported: boolean
}

export function AssignmentUploader({ childOptions }: AssignmentUploaderProps) {
  const [state, formAction, isPending] = useActionState<AssignmentActionState, FormData>(
    uploadAssignmentAction,
    {},
  )
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)

  // Clear the form + preview once an upload succeeds.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setPicked((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return null
      })
    }
  }, [state.success])

  // Revoke the object URL on unmount.
  useEffect(() => {
    return () => {
      if (picked?.previewUrl) URL.revokeObjectURL(picked.previewUrl)
    }
  }, [picked?.previewUrl])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setPicked((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      if (!file) return null
      const accepted = acceptedAssignmentType(file.type)
      const isImage = accepted?.kind === 'image'
      return {
        name: file.name,
        size: file.size,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        tooBig: file.size > ASSIGNMENT_MAX_BYTES,
        unsupported: accepted === null,
      }
    })
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = ''
    setPicked((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  const noChildren = childOptions.length === 0
  const blockSubmit = isPending || !picked || picked.tooBig || picked.unsupported

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.success && (
        <Alert variant="success">Uploaded. It now appears under your child below.</Alert>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Select
        name="studentId"
        label="Child"
        required
        options={childOptions}
        placeholder={noChildren ? 'No linked children' : 'Choose a child'}
        disabled={noChildren}
      />

      <Input
        name="title"
        label="Title (optional)"
        placeholder="e.g. Maths homework – page 12"
        maxLength={120}
      />

      <div>
        <label
          htmlFor="assignment-file"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Photo or PDF
        </label>
        <input
          ref={fileRef}
          id="assignment-file"
          name="file"
          type="file"
          accept={ASSIGNMENT_ACCEPT}
          capture="environment"
          onChange={onFileChange}
          disabled={noChildren}
          className="block w-full cursor-pointer rounded-lg border border-border bg-background text-sm text-text-secondary file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-raised file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          On a phone this opens the camera. JPG, PNG or PDF, up to{' '}
          {formatFileSize(ASSIGNMENT_MAX_BYTES)}.
        </p>
      </div>

      {picked && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
          {picked.isImage && picked.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img
              src={picked.previewUrl}
              alt="Selected assignment preview"
              className="h-16 w-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-raised">
              <FileText className="h-7 w-7 text-text-muted" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{picked.name}</p>
            <p className="text-xs text-text-muted">{formatFileSize(picked.size)}</p>
            {picked.tooBig && (
              <p className="mt-1 text-xs text-error">
                Too large — max {formatFileSize(ASSIGNMENT_MAX_BYTES)}.
              </p>
            )}
            {picked.unsupported && (
              <p className="mt-1 text-xs text-error">Only photos (JPG/PNG) or PDFs are allowed.</p>
            )}
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="shrink-0 text-text-muted hover:text-text-primary"
            aria-label="Remove selected file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Button type="submit" loading={isPending} disabled={blockSubmit}>
        <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Upload assignment
      </Button>
    </form>
  )
}
