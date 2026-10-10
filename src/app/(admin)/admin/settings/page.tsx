import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { SchoolSettingsForm } from '@/components/admin/SchoolSettingsForm'
import { SchoolLogoUploader } from '@/components/admin/SchoolLogoUploader'
import { SocialLinksForm } from '@/components/admin/SocialLinksForm'
import { getSchoolSocialLinks } from '@/lib/social/queries'
import {
  updateSchoolSettingsAction,
  updateSchoolLogoAction,
  removeSchoolLogoAction,
} from '@/lib/schools/actions'
import type { SchoolRow } from '@/types/database'

export const metadata: Metadata = { title: 'Crèche Settings' }

type SchoolSettingsRow = Pick<
  SchoolRow,
  | 'name'
  | 'roll_number'
  | 'email'
  | 'phone'
  | 'website'
  | 'logo_url'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'county'
  | 'eircode'
>

export default async function SchoolSettingsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const supabase = createSupabaseAdminClient()
  // Tenant-scoped: only this admin's own school row.
  const { data } = await supabase
    .from('schools')
    .select(
      'name, roll_number, email, phone, website, logo_url, address_line1, address_line2, city, county, eircode',
    )
    .eq('id', admin.schoolId)
    .single()

  const school = data as SchoolSettingsRow | null
  const socialLinks = await getSchoolSocialLinks(admin.schoolId)
  if (!school) {
    return <p className="text-error">Could not load your crèche details.</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Crèche settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          These details appear on your portal, on receipts, and on the public Contact and Privacy
          pages.
        </p>
      </div>

      <div className="mb-8 border-b border-border pb-8">
        <SchoolLogoUploader
          action={updateSchoolLogoAction}
          removeAction={removeSchoolLogoAction}
          schoolName={school.name}
          logoUrl={school.logo_url}
        />
      </div>

      <SchoolSettingsForm
        action={updateSchoolSettingsAction}
        school={{
          name: school.name,
          rollNumber: school.roll_number ?? '',
          email: school.email ?? '',
          phone: school.phone ?? '',
          website: school.website ?? '',
          addressLine1: school.address_line1 ?? '',
          addressLine2: school.address_line2 ?? '',
          city: school.city ?? '',
          county: school.county ?? '',
          eircode: school.eircode ?? '',
        }}
      />

      <div id="social" className="mt-8 scroll-mt-24">
        <SocialLinksForm links={socialLinks} />
      </div>
    </div>
  )
}
