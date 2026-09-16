'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createPermissionSlipAction, type SlipActionState } from '@/lib/permission-slips/actions'
import type { SelectOption } from '@/types'

interface Props {
  classes: SelectOption[]
  /** Admins may target the whole school; teachers may not. */
  allowSchool: boolean
}

export function PermissionSlipForm({ classes, allowSchool }: Props) {
  const [state, formAction, isPending] = useActionState<SlipActionState, FormData>(
    createPermissionSlipAction,
    {},
  )
  const [audience, setAudience] = useState(allowSchool ? 'school' : 'class')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setAudience(allowSchool ? 'school' : 'class')
    }
  }, [state.success, allowSchool])

  const audienceOptions: SelectOption[] = [
    ...(allowSchool ? [{ value: 'school', label: 'Whole school' }] : []),
    { value: 'class', label: 'A class' },
  ]

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.success && <Alert variant="success">Permission slip created.</Alert>}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Input
        name="title"
        label="Title"
        required
        maxLength={140}
        placeholder="e.g. School trip to the zoo"
      />
      <Textarea
        name="description"
        label="Details (optional)"
        rows={4}
        maxLength={2000}
        placeholder="What are parents consenting to?"
      />
      <Input name="dueDate" type="date" label="Respond by (optional)" />

      <Select
        name="audienceType"
        label="Who is this for?"
        options={audienceOptions}
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
      />
      {audience === 'class' && (
        <Select
          name="classId"
          label="Class"
          options={classes}
          placeholder="Choose a class"
          required
        />
      )}

      <Button type="submit" loading={isPending} disabled={isPending}>
        <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Create slip
      </Button>
    </form>
  )
}
