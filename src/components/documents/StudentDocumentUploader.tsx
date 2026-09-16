'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Upload } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { uploadStudentDocumentAction, type DocumentActionState } from '@/lib/documents/actions'
import { ASSIGNMENT_ACCEPT } from '@/lib/assignments/validate'
import type { DocumentCategory } from '@/types'

interface StudentDocumentUploaderProps {
  studentId: string
  category: DocumentCategory
  titleLabel: string
  titlePlaceholder: string
  /** Show a free-text term field (report cards). */
  showTerm?: boolean
}

/** Staff form to upload one document (test result / report card) for a student. */
export function StudentDocumentUploader({
  studentId,
  category,
  titleLabel,
  titlePlaceholder,
  showTerm = false,
}: StudentDocumentUploaderProps) {
  const [state, formAction, isPending] = useActionState<DocumentActionState, FormData>(
    uploadStudentDocumentAction,
    {},
  )
  const formRef = useRef<HTMLFormElement>(null)
  const fileId = `doc-file-${category}-${studentId}`

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.success && <Alert variant="success">Uploaded — the parents can now see it.</Alert>}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="category" value={category} />

      <Input name="title" label={titleLabel} placeholder={titlePlaceholder} maxLength={120} />
      {showTerm && (
        <Input name="term" label="Term" placeholder="e.g. Term 1 2025/26" maxLength={60} />
      )}

      <div>
        <label htmlFor={fileId} className="mb-1.5 block text-sm font-medium text-text-primary">
          File (PDF or image)
        </label>
        <input
          id={fileId}
          name="file"
          type="file"
          accept={ASSIGNMENT_ACCEPT}
          className="block w-full cursor-pointer rounded-lg border border-border bg-background text-sm text-text-secondary file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-raised file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/10"
        />
      </div>

      <Button type="submit" loading={isPending} disabled={isPending}>
        <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Upload
      </Button>
    </form>
  )
}
