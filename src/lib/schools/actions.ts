'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  updateSchoolSettingsSchema,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
  LOGO_EXTENSIONS,
  type SchoolSettingsActionState,
  type SchoolLogoActionState,
} from './schemas'

const LOGO_BUCKET = 'school-logos'

/** Refresh every surface that renders school branding/details. */
function revalidateSchoolSurfaces(): void {
  revalidatePath('/admin/settings')
  revalidatePath('/contact')
  revalidatePath('/privacy')
  revalidatePath('/', 'layout') // public/auth headers pull the crest via getViewerSchool
}

/** If a prior logo lived in our bucket, delete its object (best-effort). */
async function removeOldLogoObject(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  previousUrl: string | null,
): Promise<void> {
  if (!previousUrl) return
  const marker = `/${LOGO_BUCKET}/`
  const idx = previousUrl.indexOf(marker)
  if (idx === -1) return
  const path = previousUrl.slice(idx + marker.length)
  if (!path) return
  const { error } = await adminClient.storage.from(LOGO_BUCKET).remove([path])
  if (error) logger.warn('school_logo_old_remove_failed', { error: error.message })
}

/**
 * Update the signed-in admin's own school details (name, roll number, contact
 * details, address). These feed the public contact/privacy pages and the
 * per-tenant email sender name.
 *
 * Multi-tenant correctness: the service-role client bypasses RLS, so the UPDATE
 * is scoped with `.eq('id', admin.schoolId)` — an admin can only ever edit their
 * own school, never another tenant's.
 */
export async function updateSchoolSettingsAction(
  _prev: SchoolSettingsActionState,
  formData: FormData,
): Promise<SchoolSettingsActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = updateSchoolSettingsSchema.safeParse({
    name: formData.get('name'),
    rollNumber: formData.get('rollNumber'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    website: formData.get('website'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    city: formData.get('city'),
    county: formData.get('county'),
    eircode: formData.get('eircode'),
  })

  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        name: fe.name?.[0],
        rollNumber: fe.rollNumber?.[0],
        email: fe.email?.[0],
        phone: fe.phone?.[0],
        website: fe.website?.[0],
        addressLine1: fe.addressLine1?.[0],
        addressLine2: fe.addressLine2?.[0],
        city: fe.city?.[0],
        county: fe.county?.[0],
        eircode: fe.eircode?.[0],
      },
    }
  }

  const v = result.data
  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('schools')
    .update({
      name: v.name,
      roll_number: v.rollNumber ?? null,
      email: v.email ?? null,
      phone: v.phone ?? null,
      website: v.website ?? null,
      address_line1: v.addressLine1 ?? null,
      address_line2: v.addressLine2 ?? null,
      city: v.city ?? null,
      county: v.county ?? null,
      eircode: v.eircode ?? null,
    })
    .eq('id', admin.schoolId)

  if (error) {
    logger.error('school_settings_update_failed', {
      schoolId: admin.schoolId,
      error: error.message,
    })
    return { error: 'Could not save your changes. Please try again.' }
  }

  // Non-sensitive audit trail (INSERT on audit_logs is admin-client only).
  const { error: auditError } = await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email ?? '',
    action: 'settings.updated',
    resource_type: 'school',
    resource_id: admin.schoolId,
    metadata: { fields: 'name,contact,address' },
    correlation_id: null,
    ip_address: null,
  })
  if (auditError) {
    logger.error('school_settings_audit_failed', { error: auditError.message })
  }

  // The public legal pages + header branding read these fields; refresh them.
  revalidateSchoolSurfaces()

  return { success: true, message: 'School details saved.' }
}

/**
 * Upload (or replace) the signed-in admin's school logo. Same permission as the
 * settings form (any admin). The file goes to the public `school-logos` bucket
 * via the service-role client, and its public URL is stored on schools.logo_url.
 * Tenant-scoped: path is namespaced by schoolId and the row update is filtered
 * by `.eq('id', admin.schoolId)`.
 */
export async function updateSchoolLogoAction(
  _prev: SchoolLogoActionState,
  formData: FormData,
): Promise<SchoolLogoActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please choose an image to upload.' }
  }
  if (!LOGO_ALLOWED_TYPES.includes(file.type as (typeof LOGO_ALLOWED_TYPES)[number])) {
    return { error: 'Logo must be a PNG, JPG, or WebP image.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { error: 'Logo must be 1 MB or smaller.' }
  }

  const adminClient = createSupabaseAdminClient()
  const ext = LOGO_EXTENSIONS[file.type as (typeof LOGO_ALLOWED_TYPES)[number]]
  // Timestamped path busts CDN caching so a replaced logo shows immediately.
  const path = `${admin.schoolId}/logo-${Date.now()}.${ext}`

  const { error: uploadError } = await adminClient.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) {
    logger.error('school_logo_upload_failed', {
      schoolId: admin.schoolId,
      error: uploadError.message,
    })
    return { error: 'Could not upload the logo. Please try again.' }
  }

  const { data: pub } = adminClient.storage.from(LOGO_BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  // Read the previous logo so we can clean up its object after a successful swap.
  const { data: prev } = await adminClient
    .from('schools')
    .select('logo_url')
    .eq('id', admin.schoolId)
    .single()
  const previousUrl = (prev as { logo_url: string | null } | null)?.logo_url ?? null

  const { error: updateError } = await adminClient
    .from('schools')
    .update({ logo_url: publicUrl })
    .eq('id', admin.schoolId)
  if (updateError) {
    logger.error('school_logo_save_failed', {
      schoolId: admin.schoolId,
      error: updateError.message,
    })
    // Roll back the just-uploaded object so we don't orphan it.
    await adminClient.storage.from(LOGO_BUCKET).remove([path])
    return { error: 'Could not save the logo. Please try again.' }
  }

  await removeOldLogoObject(adminClient, previousUrl)
  await logoAudit(admin.id, admin.email, admin.schoolId, 'uploaded')
  revalidateSchoolSurfaces()
  return { success: true, message: 'Logo updated.' }
}

/**
 * Remove the school's logo — clears schools.logo_url and deletes the object.
 * The portal falls back to the initials crest.
 */
export async function removeSchoolLogoAction(): Promise<void> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return

  const adminClient = createSupabaseAdminClient()
  const { data: prev } = await adminClient
    .from('schools')
    .select('logo_url')
    .eq('id', admin.schoolId)
    .single()
  const previousUrl = (prev as { logo_url: string | null } | null)?.logo_url ?? null

  const { error } = await adminClient
    .from('schools')
    .update({ logo_url: null })
    .eq('id', admin.schoolId)
  if (error) {
    logger.error('school_logo_remove_failed', { schoolId: admin.schoolId, error: error.message })
    return
  }

  await removeOldLogoObject(adminClient, previousUrl)
  await logoAudit(admin.id, admin.email, admin.schoolId, 'removed')
  revalidateSchoolSurfaces()
}

async function logoAudit(
  actorId: string,
  actorEmail: string | null,
  schoolId: string,
  change: 'uploaded' | 'removed',
): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: actorId,
    actor_email: actorEmail ?? '',
    action: 'settings.updated',
    resource_type: 'school',
    resource_id: schoolId,
    metadata: { field: 'logo', change },
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('school_logo_audit_failed', { error: error.message })
}
