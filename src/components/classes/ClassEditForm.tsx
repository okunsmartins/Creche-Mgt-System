'use client'

import { useActionState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import type { ClassActionState } from '@/lib/classes/actions'
import type { ClassRow, TeacherRow } from '@/types/database'

type Teacher = Pick<TeacherRow, 'id' | 'first_name' | 'last_name' | 'display_name' | 'is_active'>
type Cls = Pick<ClassRow, 'id' | 'name' | 'academic_year' | 'is_active' | 'teacher_id'>

interface ClassEditFormProps {
  action: (prev: ClassActionState, formData: FormData) => Promise<ClassActionState>
  cls: Cls
  teachers: Teacher[]
}

const initialState: ClassActionState = {}

export function ClassEditForm({ action, cls, teachers }: ClassEditFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">Room updated successfully.</Alert>}

      {/* Room name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-text-primary">
          Room name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          defaultValue={cls.name}
          className="input-base"
        />
      </div>

      {/* Teacher assignment */}
      <div>
        <label htmlFor="teacherId" className="mb-1 block text-sm font-medium text-text-primary">
          Assigned staff member
        </label>
        <select
          id="teacherId"
          name="teacherId"
          defaultValue={cls.teacher_id ?? ''}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">— Unassigned —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name ?? `${t.first_name} ${t.last_name}`}
            </option>
          ))}
        </select>
      </div>

      {/* Academic year */}
      <div>
        <label htmlFor="academicYear" className="mb-1 block text-sm font-medium text-text-primary">
          Academic year
        </label>
        <input
          id="academicYear"
          name="academicYear"
          type="text"
          defaultValue={cls.academic_year ?? ''}
          placeholder="e.g. 2025-2026"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Active status — hidden-input + nameless-checkbox pattern.
          The hidden input is initialised to the current value so that
          saving without touching the checkbox preserves the existing state. */}
      <input type="hidden" name="isActive" defaultValue={cls.is_active ? 'true' : 'false'} />
      <div className="flex items-center gap-3">
        <input
          id="isActive"
          type="checkbox"
          name=""
          defaultChecked={cls.is_active}
          onChange={(e) => {
            const hidden = e.currentTarget.form?.elements.namedItem(
              'isActive',
            ) as HTMLInputElement | null
            if (hidden) hidden.value = e.currentTarget.checked ? 'true' : 'false'
          }}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor="isActive" className="text-sm text-text-primary">
          Class is active
        </label>
      </div>

      <Button type="submit" loading={pending} className="w-full">
        Save changes
      </Button>
    </form>
  )
}
