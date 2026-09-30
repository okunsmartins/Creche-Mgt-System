'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { validateEnquiry, isEnquiryStatus } from './enquiries'

type Result = { ok: true } | { ok: false; error: string }

export async function createEnquiryAction(input: {
  parentName: string
  parentEmail?: string
  parentPhone?: string
  childFirstName?: string
  childLastName?: string
  desiredStartDate?: string
  source?: string
  notes?: string
}): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const check = validateEnquiry({
    parentName: input.parentName,
    parentEmail: input.parentEmail ?? null,
  })
  if (!check.ok) return check

  const db = createSupabaseAdminClient()
  const { error } = await db.from('enquiries').insert({
    school_id: schoolId,
    parent_name: input.parentName.trim(),
    parent_email: input.parentEmail?.trim() || null,
    parent_phone: input.parentPhone?.trim() || null,
    child_first_name: input.childFirstName?.trim() || null,
    child_last_name: input.childLastName?.trim() || null,
    desired_start_date: input.desiredStartDate || null,
    source: input.source?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'new',
    created_by: admin.id,
  })
  if (error) {
    logger.error('enquiry_create_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not save the enquiry.' }
  }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}

export async function updateEnquiryStatusAction(id: string, status: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  if (!isEnquiryStatus(status)) return { ok: false, error: 'Invalid status.' }
  const db = createSupabaseAdminClient()
  const { error } = await db
    .from('enquiries')
    .update({ status })
    .eq('id', id)
    .eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not update the enquiry.' }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}

export async function deleteEnquiryAction(id: string): Promise<Result> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()
  const { error } = await db.from('enquiries').delete().eq('id', id).eq('school_id', schoolId)
  if (error) return { ok: false, error: 'Could not delete the enquiry.' }
  revalidatePath('/admin/enquiries')
  return { ok: true }
}
