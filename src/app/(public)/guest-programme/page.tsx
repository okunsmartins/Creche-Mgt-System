import type { Metadata } from 'next'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getViewerSchoolId } from '@/lib/tenant/server'
import { FindYourSchool } from '@/components/tenant/FindYourSchool'
import { GuestProgrammeForm } from '@/components/orders/GuestProgrammeForm'
import type { ProgrammeRow, ClassRow } from '@/types/database'

export const metadata: Metadata = { title: 'Enrol as Guest' }

type ProgrammeDetail = Pick<
  ProgrammeRow,
  'id' | 'name' | 'price_cents' | 'pricing_model' | 'publication_status' | 'is_active'
>

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>

export default async function GuestProgrammePage({
  searchParams,
}: {
  searchParams: Promise<{ programmeId?: string }>
}) {
  const { programmeId } = await searchParams

  if (!programmeId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Enrol as a guest</h1>
        <p className="mb-6 text-text-secondary">
          Select a programme from the{' '}
          <Link href="/programmes" className="text-primary hover:underline">
            programmes listing
          </Link>{' '}
          to begin guest enrolment.
        </p>
      </div>
    )
  }

  const adminClient = createSupabaseAdminClient()
  // No tenant identified → ask which school rather than guessing one.
  const schoolId = await getViewerSchoolId()
  if (!schoolId) return <FindYourSchool />

  const { data: programmeData } = await adminClient
    .from('programmes')
    .select('id, name, price_cents, pricing_model, publication_status, is_active')
    .eq('id', programmeId)
    .eq('school_id', schoolId)
    .single()

  const programme = programmeData as ProgrammeDetail | null

  if (!programme || programme.publication_status !== 'published' || !programme.is_active) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Programme not available</h1>
        <p className="mb-6 text-text-secondary">
          This programme is not currently accepting enrolments.
        </p>
        <Link href="/programmes" className="text-primary hover:underline">
          View all programmes
        </Link>
      </div>
    )
  }

  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('display_order')

  const classes = ((classData as ClassOption[] | null) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link href="/programmes" className="text-sm text-text-muted hover:underline">
          ← Back to programmes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Enrol as a guest</h1>
        <p className="mt-2 text-sm text-text-secondary">
          No account needed. You will receive an email receipt when payment is complete.{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          for a faster experience.
        </p>
      </div>

      <div className="card p-6">
        <GuestProgrammeForm
          programmeId={programme.id}
          programmeName={programme.name}
          pricingModel={programme.pricing_model}
          amountCents={programme.price_cents}
          classes={classes}
        />
      </div>
    </div>
  )
}
