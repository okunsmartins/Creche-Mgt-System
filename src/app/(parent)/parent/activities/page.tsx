import type { Metadata } from 'next'
import Link from 'next/link'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { ActivityRow, ActivityClassEligibilityRow, ClassRow } from '@/types/database'
import {
  ActivityCardWithBasket,
  type ActivityCardProps,
} from '@/components/activities/ActivityCardWithBasket'

export const metadata: Metadata = { title: 'Activities' }

type LinkedStudent = {
  id: string
  first_name: string
  last_name: string
  class_id: string
  is_active: boolean
}

type ActivityWithEligibility = Pick<
  ActivityRow,
  'id' | 'name' | 'description' | 'amount_cents' | 'closes_at'
> & {
  activity_class_eligibility: (Pick<ActivityClassEligibilityRow, 'class_id'> & {
    classes: Pick<ClassRow, 'name'> | null
  })[]
}

export default async function ParentActivitiesPage() {
  const user = await requireVerifiedAuth()
  // Use admin client: auth.uid() evaluates to NULL in Server Component contexts,
  // so RLS policies gated on it return 0 rows. Scope manually to user.id.
  const supabase = createSupabaseAdminClient()

  // Get linked active students with class info
  const { data: linksData } = await supabase
    .from('parent_student_links')
    .select('students(id, first_name, last_name, class_id, is_active)')
    .eq('parent_id', user.id)
    .eq('is_active', true)

  type RawLink = { students: LinkedStudent | null }
  const links = (linksData as RawLink[] | null) ?? []

  const linkedStudents = links
    .map((l) => l.students)
    .filter((s): s is LinkedStudent => s !== null && s.is_active)

  if (linkedStudents.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-text-primary">Activities</h1>
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">
            No children are linked to your account yet.{' '}
            <Link href="/parent/children" className="text-primary hover:underline">
              Link a child
            </Link>{' '}
            to see activities available for their class.
          </p>
        </div>
      </div>
    )
  }

  const classIds = [...new Set(linkedStudents.map((s) => s.class_id))]
  const studentIds = linkedStudents.map((s) => s.id)

  // Fetch class names for the students' classes (used for individually-eligible student display)
  const { data: classesData } = await supabase.from('classes').select('id, name').in('id', classIds)

  const globalClassNameById: Record<string, string> = {}
  for (const cls of (classesData as { id: string; name: string }[] | null) ?? []) {
    globalClassNameById[cls.id] = cls.name
  }

  // Get activity IDs eligible for those classes
  const { data: classEligData } = await supabase
    .from('activity_class_eligibility')
    .select('activity_id')
    .in('class_id', classIds)

  // Get activity IDs eligible for those pupils individually
  const { data: pupilEligData } = await supabase
    .from('activity_pupil_eligibility')
    .select('activity_id, student_id')
    .in('student_id', studentIds)

  const classActivityIds = new Set(
    ((classEligData as Pick<ActivityClassEligibilityRow, 'activity_id'>[] | null) ?? []).map(
      (e) => e.activity_id,
    ),
  )

  // Map: activity_id → Set of student IDs that are individually eligible
  const pupilEligMap = new Map<string, Set<string>>()
  for (const pe of (pupilEligData as { activity_id: string; student_id: string }[] | null) ?? []) {
    const existing = pupilEligMap.get(pe.activity_id)
    if (existing) {
      existing.add(pe.student_id)
    } else {
      pupilEligMap.set(pe.activity_id, new Set([pe.student_id]))
    }
  }

  const allActivityIds = [...new Set([...classActivityIds, ...pupilEligMap.keys()])]

  if (allActivityIds.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-text-primary">Activities</h1>
        <p className="text-text-muted">
          There are no activities available for your children&apos;s classes at the moment.
        </p>
      </div>
    )
  }

  // Fetch published, open activities — admin client bypasses RLS, so filter explicitly
  const now = new Date().toISOString()
  const { data: activitiesData } = await supabase
    .from('activities')
    .select(
      'id, name, description, amount_cents, closes_at, activity_class_eligibility(class_id, classes(name))',
    )
    .in('id', allActivityIds)
    .eq('publication_status', 'published')
    .eq('is_active', true)
    .or(`opens_at.is.null,opens_at.lte.${now}`)
    .or(`closes_at.is.null,closes_at.gt.${now}`)
    .order('name')

  const activities = (activitiesData as ActivityWithEligibility[] | null) ?? []

  // Build map: class_id → students in that class
  const classStudentMap = linkedStudents.reduce<
    Record<string, { id: string; firstName: string; lastName: string; className: string }[]>
  >((acc, s) => {
    const entry = {
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      className: globalClassNameById[s.class_id] ?? '',
    }
    const existing = acc[s.class_id]
    if (existing) {
      existing.push(entry)
    } else {
      acc[s.class_id] = [entry]
    }
    return acc
  }, {})

  // Build activity card props — resolve per-activity eligible students
  const cards: ActivityCardProps[] = activities.map((activity) => {
    // Per-activity class name map (from the joined eligibility data)
    const activityClassNameById: Record<string, string> = {}
    for (const e of activity.activity_class_eligibility) {
      if (e.classes?.name) activityClassNameById[e.class_id] = e.classes.name
    }

    const classNames = activity.activity_class_eligibility
      .map((e) => e.classes?.name)
      .filter((n): n is string => n !== null && n !== undefined)

    // Students eligible via class membership
    const classEligibleStudents = activity.activity_class_eligibility.flatMap((e) => {
      const studentsInClass = classStudentMap[e.class_id] ?? []
      return studentsInClass.map((s) => ({
        ...s,
        className: activityClassNameById[e.class_id] ?? s.className,
      }))
    })

    // Students eligible individually but not already covered by class eligibility
    const classEligibleIds = new Set(classEligibleStudents.map((s) => s.id))
    const individualStudents = linkedStudents
      .filter((s) => pupilEligMap.get(activity.id)?.has(s.id) && !classEligibleIds.has(s.id))
      .map((s) => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        className: globalClassNameById[s.class_id] ?? '',
      }))

    const eligibleStudents = [...classEligibleStudents, ...individualStudents]

    // Deduplicate by ID
    const seen = new Set<string>()
    const uniqueStudents = eligibleStudents.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })

    return {
      activityId: activity.id,
      activityName: activity.name,
      description: activity.description,
      amountCents: activity.amount_cents,
      classNames,
      closesAt: activity.closes_at,
      eligibleStudents: uniqueStudents,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Activities</h1>
          <p className="mt-1 text-sm text-text-muted">
            {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} available for your
            children.
          </p>
        </div>
        <Link
          href="/parent/basket"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary"
        >
          View basket
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="py-8 text-center text-text-muted">
          No activities are available at the moment. Check back soon.
        </p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <ActivityCardWithBasket key={card.activityId} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}
