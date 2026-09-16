'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  createProgrammeSchema,
  updateProgrammeSchema,
  publishProgrammeSchema,
  closeProgrammeSchema,
  archiveProgrammeSchema,
  type ProgrammeActionState,
} from './schemas'
import type { ProgrammeRow, AuditAction } from '@/types/database'

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function audit(params: {
  schoolId: string
  actorId: string
  actorEmail: string
  action: AuditAction
  resourceType: string
  resourceId?: string | undefined
  metadata?: Record<string, string | number | boolean | null> | undefined
}): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) {
    logger.error('audit_log_failed', { action: params.action, error: error.message })
  }
}

// ─── Create Programme ─────────────────────────────────────────────────────────

export async function createProgrammeAction(
  _prev: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const classIds = formData.getAll('classIds').filter((v): v is string => typeof v === 'string')
  const daysOfWeek = formData.getAll('daysOfWeek').filter((v): v is string => typeof v === 'string')

  const raw = {
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    priceEuros: formData.get('priceEuros'),
    pricingModel: formData.get('pricingModel'),
    daysOfWeek,
    sessionTime: formData.get('sessionTime') ?? undefined,
    termStart: formData.get('termStart') ?? undefined,
    termEnd: formData.get('termEnd') ?? undefined,
    maxEnrolments: formData.get('maxEnrolments') ?? undefined,
    classIds,
  }

  const result = createProgrammeSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        name: fe.name?.[0],
        description: fe.description?.[0],
        priceEuros: fe.priceEuros?.[0],
        pricingModel: fe.pricingModel?.[0],
        daysOfWeek: fe.daysOfWeek?.[0],
        sessionTime: fe.sessionTime?.[0],
        termStart: fe.termStart?.[0],
        termEnd: fe.termEnd?.[0],
        maxEnrolments: fe.maxEnrolments?.[0],
        classIds: fe.classIds?.[0],
      },
    }
  }

  const {
    name,
    description,
    priceEuros: priceCents,
    pricingModel,
    daysOfWeek: validDays,
    sessionTime,
    termStart,
    termEnd,
    maxEnrolments,
    classIds: validClassIds,
  } = result.data

  const adminClient = createSupabaseAdminClient()

  const { data: programme, error: programmeError } = await adminClient
    .from('programmes')
    .insert({
      school_id: admin.schoolId,
      name,
      description: description ?? null,
      price_cents: priceCents,
      currency: 'EUR',
      pricing_model: pricingModel,
      days_of_week: validDays,
      session_time: sessionTime ?? null,
      term_start: termStart ?? null,
      term_end: termEnd ?? null,
      max_enrolments: maxEnrolments ?? null,
      publication_status: 'draft',
      is_active: true,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (programmeError || !programme) {
    logger.error('create_programme_failed', { error: programmeError?.message })
    return { error: 'Failed to create programme. Please try again.' }
  }

  const programmeId = (programme as Pick<ProgrammeRow, 'id'>).id

  const { error: eligibilityError } = await adminClient
    .from('programme_class_eligibility')
    .insert(validClassIds.map((classId) => ({ programme_id: programmeId, class_id: classId })))

  if (eligibilityError) {
    logger.error('create_programme_eligibility_failed', {
      programmeId,
      error: eligibilityError.message,
    })
    return {
      error:
        'Programme created but class eligibility could not be saved. Please edit the programme.',
    }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'programme.created',
    resourceType: 'programme',
    resourceId: programmeId,
    metadata: { name, price_cents: priceCents, pricing_model: pricingModel },
  })

  revalidatePath('/admin/programmes')
  return { success: true, message: `"${name}" created as a draft.` }
}

// ─── Update Programme ─────────────────────────────────────────────────────────

export async function updateProgrammeAction(
  _prev: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const classIds = formData.getAll('classIds').filter((v): v is string => typeof v === 'string')
  const daysOfWeek = formData.getAll('daysOfWeek').filter((v): v is string => typeof v === 'string')

  const raw = {
    programmeId: formData.get('programmeId'),
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    priceEuros: formData.get('priceEuros'),
    pricingModel: formData.get('pricingModel'),
    daysOfWeek,
    sessionTime: formData.get('sessionTime') ?? undefined,
    termStart: formData.get('termStart') ?? undefined,
    termEnd: formData.get('termEnd') ?? undefined,
    maxEnrolments: formData.get('maxEnrolments') ?? undefined,
    classIds,
  }

  const result = updateProgrammeSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        name: fe.name?.[0],
        description: fe.description?.[0],
        priceEuros: fe.priceEuros?.[0],
        pricingModel: fe.pricingModel?.[0],
        daysOfWeek: fe.daysOfWeek?.[0],
        sessionTime: fe.sessionTime?.[0],
        termStart: fe.termStart?.[0],
        termEnd: fe.termEnd?.[0],
        maxEnrolments: fe.maxEnrolments?.[0],
        classIds: fe.classIds?.[0],
      },
    }
  }

  const {
    programmeId,
    name,
    description,
    priceEuros: priceCents,
    pricingModel,
    daysOfWeek: validDays,
    sessionTime,
    termStart,
    termEnd,
    maxEnrolments,
    classIds: validClassIds,
  } = result.data

  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('programmes')
    .select('id, publication_status')
    .eq('id', programmeId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Programme not found.' }

  const existingRow = existing as Pick<ProgrammeRow, 'id' | 'publication_status'>
  if (existingRow.publication_status === 'archived') {
    return { error: 'Archived programmes cannot be edited.' }
  }

  const { error: updateError } = await adminClient
    .from('programmes')
    .update({
      name,
      description: description ?? null,
      price_cents: priceCents,
      pricing_model: pricingModel,
      days_of_week: validDays,
      session_time: sessionTime ?? null,
      term_start: termStart ?? null,
      term_end: termEnd ?? null,
      max_enrolments: maxEnrolments ?? null,
    })
    .eq('id', programmeId)

  if (updateError) {
    logger.error('update_programme_failed', { programmeId, error: updateError.message })
    return { error: 'Failed to update programme. Please try again.' }
  }

  // Replace class eligibility: delete all then re-insert
  await adminClient.from('programme_class_eligibility').delete().eq('programme_id', programmeId)

  const { error: eligibilityError } = await adminClient
    .from('programme_class_eligibility')
    .insert(validClassIds.map((classId) => ({ programme_id: programmeId, class_id: classId })))

  if (eligibilityError) {
    logger.error('update_programme_eligibility_failed', {
      programmeId,
      error: eligibilityError.message,
    })
    return { error: 'Programme updated but class eligibility could not be saved.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'programme.updated',
    resourceType: 'programme',
    resourceId: programmeId,
    metadata: { name, price_cents: priceCents, pricing_model: pricingModel },
  })

  revalidatePath('/admin/programmes')
  revalidatePath(`/admin/programmes/${programmeId}`)
  return { success: true, message: 'Programme updated.' }
}

// ─── Publish Programme ────────────────────────────────────────────────────────

export async function publishProgrammeAction(
  _prev: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = publishProgrammeSchema.safeParse({ programmeId: formData.get('programmeId') })
  if (!result.success) return { error: 'Invalid programme.' }

  const { programmeId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('programmes')
    .select('id, name, publication_status')
    .eq('id', programmeId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Programme not found.' }

  const existingRow = existing as Pick<ProgrammeRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status !== 'draft' && existingRow.publication_status !== 'closed') {
    return { error: 'Only draft or closed programmes can be published.' }
  }

  const { error } = await adminClient
    .from('programmes')
    .update({ publication_status: 'published' })
    .eq('id', programmeId)

  if (error) {
    logger.error('publish_programme_failed', { programmeId, error: error.message })
    return { error: 'Failed to publish programme. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'programme.published',
    resourceType: 'programme',
    resourceId: programmeId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/programmes')
  revalidatePath(`/admin/programmes/${programmeId}`)
  return { success: true, message: `"${existingRow.name}" is now published.` }
}

// ─── Close Programme ──────────────────────────────────────────────────────────

export async function closeProgrammeAction(
  _prev: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = closeProgrammeSchema.safeParse({ programmeId: formData.get('programmeId') })
  if (!result.success) return { error: 'Invalid programme.' }

  const { programmeId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('programmes')
    .select('id, name, publication_status')
    .eq('id', programmeId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Programme not found.' }

  const existingRow = existing as Pick<ProgrammeRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status !== 'published') {
    return { error: 'Only published programmes can be closed.' }
  }

  const { error } = await adminClient
    .from('programmes')
    .update({ publication_status: 'closed' })
    .eq('id', programmeId)

  if (error) {
    logger.error('close_programme_failed', { programmeId, error: error.message })
    return { error: 'Failed to close programme. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'programme.closed',
    resourceType: 'programme',
    resourceId: programmeId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/programmes')
  revalidatePath(`/admin/programmes/${programmeId}`)
  return { success: true, message: `"${existingRow.name}" has been closed.` }
}

// ─── Archive Programme ────────────────────────────────────────────────────────

export async function archiveProgrammeAction(
  _prev: ProgrammeActionState,
  formData: FormData,
): Promise<ProgrammeActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = archiveProgrammeSchema.safeParse({ programmeId: formData.get('programmeId') })
  if (!result.success) return { error: 'Invalid programme.' }

  const { programmeId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('programmes')
    .select('id, name, publication_status')
    .eq('id', programmeId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Programme not found.' }

  const existingRow = existing as Pick<ProgrammeRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status === 'archived') {
    return { error: 'Programme is already archived.' }
  }

  const { error } = await adminClient
    .from('programmes')
    .update({ publication_status: 'archived' })
    .eq('id', programmeId)

  if (error) {
    logger.error('archive_programme_failed', { programmeId, error: error.message })
    return { error: 'Failed to archive programme. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'programme.archived',
    resourceType: 'programme',
    resourceId: programmeId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/programmes')
  revalidatePath(`/admin/programmes/${programmeId}`)
  return { success: true, message: `"${existingRow.name}" has been archived.` }
}
