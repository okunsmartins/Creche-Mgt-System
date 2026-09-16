import type { Metadata } from 'next'
import Link from 'next/link'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { ProgrammeRow, ProgrammeClassEligibilityRow } from '@/types/database'
import {
  ProgrammeCardWithBasket,
  type ProgrammeCardProps,
} from '@/components/programmes/ProgrammeCardWithBasket'

export const metadata: Metadata = { title: 'Programmes' }

type LinkedStudent = {
  id: string
  first_name: string
  last_name: string
  class_id: string
  is_active: boolean
}

type ProgrammeWithEligibility = Pick<
  ProgrammeRow,
  | 'id'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'pricing_model'
  | 'days_of_week'
  | 'session_time'
  | 'term_start'
  | 'term_end'
  | 'max_enrolments'
> & {
  programme_class_eligibility: (Pick<ProgrammeClassEligibilityRow, 'class_id'> & {
    classes: { name: string } | null
  })[]
}

export default async function ParentProgrammesPage() {
  const user = await requireVerifiedAuth()
  // Use admin client: auth.uid() evaluates to NULL in Server Component contexts,
  // so RLS policies gated on it return 0 rows. Scope manually to user.id.
  const supabase = createSupabaseAdminClient()

  // Get linked active students
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
        <h1 className="mb-6 text-2xl font-bold text-text-primary">Programmes</h1>
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">
            No children are linked to your account yet.{' '}
            <Link href="/parent/children" className="text-primary hover:underline">
              Link a child
            </Link>{' '}
            to see programmes available for their class.
          </p>
        </div>
      </div>
    )
  }

  const classIds = [...new Set(linkedStudents.map((s) => s.class_id))]

  // Fetch class names
  const { data: classesData } = await supabase.from('classes').select('id, name').in('id', classIds)

  const classNameById: Record<string, string> = {}
  for (const cls of (classesData as { id: string; name: string }[] | null) ?? []) {
    classNameById[cls.id] = cls.name
  }

  // Get programme IDs eligible for those classes
  const { data: eligData } = await supabase
    .from('programme_class_eligibility')
    .select('programme_id')
    .in('class_id', classIds)

  const eligibleProgrammeIds = [
    ...new Set(
      ((eligData as Pick<ProgrammeClassEligibilityRow, 'programme_id'>[] | null) ?? []).map(
        (e) => e.programme_id,
      ),
    ),
  ]

  if (eligibleProgrammeIds.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-text-primary">Programmes</h1>
        <p className="text-text-muted">
          There are no programmes available for your children&apos;s classes at the moment.
        </p>
      </div>
    )
  }

  // Fetch published, active programmes with class eligibility
  const { data: programmesData } = await supabase
    .from('programmes')
    .select(
      'id, name, description, price_cents, pricing_model, days_of_week, session_time, term_start, term_end, max_enrolments, programme_class_eligibility(class_id, classes(name))',
    )
    .in('id', eligibleProgrammeIds)
    .eq('publication_status', 'published')
    .eq('is_active', true)
    .order('name')

  const programmes = (programmesData as ProgrammeWithEligibility[] | null) ?? []

  // Build class → students map
  const classStudentMap = linkedStudents.reduce<
    Record<string, { id: string; firstName: string; lastName: string; className: string }[]>
  >((acc, s) => {
    const entry = {
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      className: classNameById[s.class_id] ?? '',
    }
    const existing = acc[s.class_id]
    if (existing) {
      existing.push(entry)
    } else {
      acc[s.class_id] = [entry]
    }
    return acc
  }, {})

  // Build programme card props
  const cards: ProgrammeCardProps[] = programmes.map((programme) => {
    const classNames = programme.programme_class_eligibility
      .map((e) => e.classes?.name)
      .filter((n): n is string => n !== null && n !== undefined)

    const eligibleStudents = programme.programme_class_eligibility.flatMap((e) => {
      const studentsInClass = classStudentMap[e.class_id] ?? []
      const className = e.classes?.name ?? classNameById[e.class_id] ?? ''
      return studentsInClass.map((s) => ({ ...s, className }))
    })

    // Deduplicate by student ID
    const seen = new Set<string>()
    const uniqueStudents = eligibleStudents.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })

    return {
      programmeId: programme.id,
      programmeName: programme.name,
      description: programme.description,
      priceCents: programme.price_cents,
      pricingModel: programme.pricing_model,
      daysOfWeek: programme.days_of_week,
      sessionTime: programme.session_time,
      termStart: programme.term_start,
      termEnd: programme.term_end,
      classNames,
      eligibleStudents: uniqueStudents,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Programmes</h1>
          <p className="mt-1 text-sm text-text-muted">
            {programmes.length} programme{programmes.length !== 1 ? 's' : ''} available for your
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
          No programmes are available at the moment. Check back soon.
        </p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <ProgrammeCardWithBasket key={card.programmeId} {...card} />
          ))}
        </div>
      )}
    </div>
  )
}
