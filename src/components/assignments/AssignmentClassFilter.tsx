'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/types'

/** Class dropdown for the admin submissions inbox; navigates on change. */
export function AssignmentClassFilter({
  classes,
  selected,
}: {
  classes: SelectOption[]
  selected: string
}) {
  const router = useRouter()
  return (
    <div className="max-w-xs">
      <Select
        label="Filter by room"
        options={classes}
        value={selected}
        placeholder="All classes"
        onChange={(e) => {
          const v = e.target.value
          router.push(v ? `/admin/assignments?classId=${v}` : '/admin/assignments')
        }}
      />
    </div>
  )
}
