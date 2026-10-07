'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { isCertificationKind } from './certifications'

export type CertificationActionResult = { ok: boolean; error?: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** '' / nullish → null; valid `YYYY-MM-DD` → itself; anything else → undefined (invalid). */
function normalizeDate(v: string | null | undefined): string | null | undefined {
  if (v == null || v.trim() === '') return null
  return ISO.test(v.trim()) ? v.trim() : undefined
}

export interface UpsertCertificationInput {
  id?: string
  teacherId: string
  kind: string
  name: string
  reference?: string | null
  issuedDate?: string | null
  expiryDate?: string | null
  notes?: string | null
}

/**
 * Create (no id) or update (with id) a staff certification. Verifies the teacher — and, on
 * update, the existing record — belong to the admin's crèche.
 */
export async function upsertCertificationAction(
  input: UpsertCertificationInput,
): Promise<CertificationActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!input.teacherId) return { ok: false, error: 'Missing staff member.' }
  if (!isCertificationKind(input.kind)) return { ok: false, error: 'Invalid certification type.' }
  const name = input.name?.trim() ?? ''
  if (name === '') return { ok: false, error: 'A name is required.' }

  const issuedDate = normalizeDate(input.issuedDate)
  const expiryDate = normalizeDate(input.expiryDate)
  if (issuedDate === undefined) return { ok: false, error: 'Invalid issue date.' }
  if (expiryDate === undefined) return { ok: false, error: 'Invalid expiry date.' }

  const db = createSupabaseAdminClient()

  // The teacher must be in this school.
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('id', input.teacherId)
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  if (!teacher) return { ok: false, error: 'Staff member not found for your crèche.' }

  const fields = {
    teacher_id: input.teacherId,
    kind: input.kind,
    name,
    reference: input.reference?.trim() || null,
    issued_date: issuedDate,
    expiry_date: expiryDate,
    notes: input.notes?.trim() || null,
  }

  if (input.id) {
    const { data, error } = await db
      .from('staff_certifications')
      .update(fields)
      .eq('id', input.id)
      .eq('school_id', admin.schoolId)
      .select('id')
    if (error) {
      logger.error('certification_update_failed', {
        schoolId: admin.schoolId,
        error: error.message,
      })
      return { ok: false, error: 'Could not save the certification.' }
    }
    if ((data ?? []).length === 0) return { ok: false, error: 'Certification not found.' }
  } else {
    const { error } = await db
      .from('staff_certifications')
      .insert({ ...fields, school_id: admin.schoolId, created_by: admin.id })
    if (error) {
      logger.error('certification_insert_failed', {
        schoolId: admin.schoolId,
        error: error.message,
      })
      return { ok: false, error: 'Could not add the certification.' }
    }
  }

  revalidatePath('/admin/certifications')
  return { ok: true }
}

/** Delete a staff certification. School-scoped. */
export async function deleteCertificationAction(id: string): Promise<CertificationActionResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  if (!id) return { ok: false, error: 'Missing certification.' }

  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('staff_certifications')
    .delete()
    .eq('id', id)
    .eq('school_id', admin.schoolId)
  if (error) {
    logger.error('certification_delete_failed', { schoolId: admin.schoolId, error: error.message })
    return { ok: false, error: 'Could not delete the certification.' }
  }

  revalidatePath('/admin/certifications')
  return { ok: true }
}
