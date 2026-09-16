import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TeacherClass } from '@/lib/teachers/classes'

interface ClassSwitcherProps {
  classes: TeacherClass[]
  selectedId: string
  basePath: string
  /** Extra query params to preserve when switching class (e.g. a date range). */
  params?: Record<string, string>
}

/**
 * Tab row letting a teacher switch between their assigned classes. Renders
 * nothing when the teacher has one class or none. The selected class travels in
 * the `classId` query param so each page resolves it server-side.
 */
export function ClassSwitcher({ classes, selectedId, basePath, params }: ClassSwitcherProps) {
  if (classes.length <= 1) return null

  function hrefFor(classId: string): string {
    const search = new URLSearchParams({ ...params, classId })
    return `${basePath}?${search.toString()}`
  }

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select class">
      {classes.map((c) => {
        const active = c.id === selectedId
        return (
          <Link
            key={c.id}
            href={hrefFor(c.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-primary',
            )}
          >
            {c.name}
          </Link>
        )
      })}
    </div>
  )
}
