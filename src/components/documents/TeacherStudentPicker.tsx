'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/types'

/** Student dropdown for the teacher reports page; navigates on change. */
export function TeacherStudentPicker({
  students,
  selected,
}: {
  students: SelectOption[]
  selected: string
}) {
  const router = useRouter()
  return (
    <div className="max-w-sm">
      <Select
        label="Choose a pupil"
        options={students}
        value={selected}
        placeholder="Select a pupil…"
        onChange={(e) => {
          const v = e.target.value
          router.push(v ? `/teacher/reports?studentId=${v}` : '/teacher/reports')
        }}
      />
    </div>
  )
}
