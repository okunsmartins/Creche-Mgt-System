'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { requireFeature } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { schoolCodePrefix } from '@/lib/utils'
import { logger } from '@/lib/logging'
import { CHILD_FIELDS, STAFF_FIELDS, DATASET_FIELDS, autoMap, type ImportDataset } from './fields'
import { parseSpreadsheet, MAX_IMPORT_ROWS } from './parse'
import { validateRows, type ColumnMapping } from './validate'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

export type ParseResult =
  | { ok: true; headers: string[]; rows: string[][]; autoMapping: ColumnMapping; sheetName: string }
  | { ok: false; error: string }

/** Step 1: parse an uploaded .csv/.xlsx → headers, rows, and a suggested mapping. */
export async function parseImportAction(
  formData: FormData,
  dataset: ImportDataset = 'child',
): Promise<ParseResult> {
  const admin = await requireAdmin()
  await requireFeature('csv_import', admin.schoolId!)
  const fields = DATASET_FIELDS[dataset] ?? CHILD_FIELDS

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Choose a file to upload.' }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'File is larger than 5 MB.' }
  const name = file.name.toLowerCase()
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
    return { ok: false, error: 'Only .csv and .xlsx files are supported.' }
  }

  try {
    const buf = await file.arrayBuffer()
    const { headers, rows, sheetName } = parseSpreadsheet(buf, file.name)
    if (headers.length === 0) return { ok: false, error: 'No columns found in the first sheet.' }
    if (rows.length === 0) return { ok: false, error: 'No data rows found under the header row.' }
    return { ok: true, headers, rows, autoMapping: autoMap(headers, fields), sheetName }
  } catch (e) {
    logger.error('import_parse_failed', { error: (e as Error).message })
    return { ok: false, error: 'Could not read that file. Is it a valid .csv or .xlsx?' }
  }
}

export interface ImportChildrenInput {
  rows: string[][]
  mapping: ColumnMapping
}

export interface ImportChildrenResult {
  ok: boolean
  error?: string
  created?: number
  skipped?: number
  failed?: number
  missingRequired?: string[]
  rowErrors?: { rowNumber: number; errors: string[] }[]
}

// Fields that map to their own students columns; everything else rides in custom_fields.
const CORE_KEYS = new Set(['firstName', 'lastName', 'room'])

/** Step 2: validate server-side (authoritative) and insert the valid children. */
export async function importChildrenAction(
  input: ImportChildrenInput,
): Promise<ImportChildrenResult> {
  const admin = await requireAdmin()
  await requireFeature('csv_import', admin.schoolId!)
  const schoolId = admin.schoolId!

  const rows = Array.isArray(input.rows) ? input.rows.slice(0, MAX_IMPORT_ROWS) : []
  const result = validateRows(rows, input.mapping, CHILD_FIELDS)
  if (result.missingRequired.length > 0) {
    return {
      ok: false,
      missingRequired: result.missingRequired,
      error: 'Map all required fields first.',
    }
  }

  const adminClient = createSupabaseAdminClient()

  // Dedup set: existing first|last|class in this school.
  const { data: existing } = await adminClient
    .from('students')
    .select('first_name, last_name, class_id')
    .eq('school_id', schoolId)
  const seen = new Set(
    (existing ?? []).map(
      (s: { first_name: string; last_name: string; class_id: string }) =>
        `${s.first_name.toLowerCase()}|${s.last_name.toLowerCase()}|${s.class_id}`,
    ),
  )

  const classCache = new Map<string, string>()
  async function resolveClassId(roomName: string | null): Promise<string | null> {
    const name = (roomName ?? '').trim() || 'Unassigned'
    if (classCache.has(name)) return classCache.get(name)!
    const { data: found } = await adminClient
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', name)
      .maybeSingle()
    let id = (found as { id: string } | null)?.id ?? null
    if (!id) {
      const { data: made } = await adminClient
        .from('classes')
        .insert({ school_id: schoolId, name })
        .select('id')
        .single()
      id = (made as { id: string } | null)?.id ?? null
    }
    if (id) classCache.set(name, id)
    return id
  }

  const prefix = schoolCodePrefix(admin.schoolName ?? '')
  let created = 0
  let skipped = 0
  let failed = 0
  const rowErrors: { rowNumber: number; errors: string[] }[] = []

  for (const r of result.rows) {
    if (r.errors.length > 0) {
      rowErrors.push({ rowNumber: r.rowNumber, errors: r.errors })
      continue
    }
    const firstName = r.values['firstName']!
    const lastName = r.values['lastName']!
    const classId = await resolveClassId(r.values['room'] ?? null)
    if (!classId) {
      failed++
      rowErrors.push({ rowNumber: r.rowNumber, errors: ['Could not resolve a room/class.'] })
      continue
    }

    const dedupKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${classId}`
    if (seen.has(dedupKey)) {
      skipped++
      continue
    }

    // Non-core mapped values ride in custom_fields until dedicated columns exist.
    const customFields: Record<string, string> = {}
    for (const f of CHILD_FIELDS) {
      if (CORE_KEYS.has(f.key)) continue
      const v = r.values[f.key]
      if (v) customFields[f.key] = v
    }

    const codeRes = await adminClient.rpc('generate_pupil_code', { p_prefix: prefix })
    const pupilCode = codeRes.data as string | null
    if (!pupilCode) {
      failed++
      rowErrors.push({ rowNumber: r.rowNumber, errors: ['Could not generate a pupil code.'] })
      continue
    }

    const ins = await adminClient.from('students').insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      class_id: classId,
      pupil_payment_code: pupilCode,
      is_active: true,
      custom_fields: customFields,
    })
    if (ins.error) {
      failed++
      rowErrors.push({ rowNumber: r.rowNumber, errors: ['Database insert failed.'] })
      continue
    }
    seen.add(dedupKey)
    created++
  }

  logger.info('children_imported', { schoolId, created, skipped, failed, total: rows.length })
  revalidatePath('/admin/students')

  return { ok: true, created, skipped, failed, rowErrors: rowErrors.slice(0, 100) }
}

const STAFF_CORE_KEYS = new Set(['firstName', 'lastName', 'email'])

/** Import staff into the teachers table (extras → custom_fields). Dedupe by name+email. */
export async function importStaffAction(input: ImportChildrenInput): Promise<ImportChildrenResult> {
  const admin = await requireAdmin()
  await requireFeature('csv_import', admin.schoolId!)
  const schoolId = admin.schoolId!

  const rows = Array.isArray(input.rows) ? input.rows.slice(0, MAX_IMPORT_ROWS) : []
  const result = validateRows(rows, input.mapping, STAFF_FIELDS)
  if (result.missingRequired.length > 0) {
    return {
      ok: false,
      missingRequired: result.missingRequired,
      error: 'Map all required fields first.',
    }
  }

  const adminClient = createSupabaseAdminClient()
  const { data: existing } = await adminClient
    .from('teachers')
    .select('first_name, last_name, email')
    .eq('school_id', schoolId)
  const seen = new Set(
    (existing ?? []).map(
      (t: { first_name: string; last_name: string; email: string | null }) =>
        `${t.first_name.toLowerCase()}|${t.last_name.toLowerCase()}|${(t.email ?? '').toLowerCase()}`,
    ),
  )

  let created = 0
  let skipped = 0
  let failed = 0
  const rowErrors: { rowNumber: number; errors: string[] }[] = []

  for (const r of result.rows) {
    if (r.errors.length > 0) {
      rowErrors.push({ rowNumber: r.rowNumber, errors: r.errors })
      continue
    }
    const firstName = r.values['firstName']!
    const lastName = r.values['lastName']!
    const email = r.values['email'] ?? null

    const dedupKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${(email ?? '').toLowerCase()}`
    if (seen.has(dedupKey)) {
      skipped++
      continue
    }

    const customFields: Record<string, string> = {}
    for (const f of STAFF_FIELDS) {
      if (STAFF_CORE_KEYS.has(f.key)) continue
      const v = r.values[f.key]
      if (v) customFields[f.key] = v
    }

    const ins = await adminClient.from('teachers').insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      email,
      is_active: true,
      custom_fields: customFields,
    })
    if (ins.error) {
      failed++
      rowErrors.push({ rowNumber: r.rowNumber, errors: ['Database insert failed.'] })
      continue
    }
    seen.add(dedupKey)
    created++
  }

  logger.info('staff_imported', { schoolId, created, skipped, failed, total: rows.length })
  revalidatePath('/admin/teachers')

  return { ok: true, created, skipped, failed, rowErrors: rowErrors.slice(0, 100) }
}
