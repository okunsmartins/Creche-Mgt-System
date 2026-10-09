'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { renderBrandedEmail } from '@/lib/email/layout'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatCurrency } from '@/lib/utils'
import { computeLateFee, minutesLate, parseTimeToMinutes, type LateFeePolicy } from './fee'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string }

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Policy settings ────────────────────────────────────────────────────────────

export interface LateFeeSettingsInput {
  cutoffTime: string // 'HH:MM'
  graceMinutes: number
  flatFeeCents: number
  perBlockFeeCents: number
  blockMinutes: number
  isActive: boolean
}

/** Create or update this crèche's late-collection policy. */
export async function upsertLateCollectionSettingsAction(
  input: LateFeeSettingsInput,
): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  if (Number.isNaN(parseTimeToMinutes(input.cutoffTime)))
    return { ok: false, error: 'Enter a valid cutoff time (HH:MM).' }
  for (const [label, v, min] of [
    ['Grace minutes', input.graceMinutes, 0],
    ['Flat fee', input.flatFeeCents, 0],
    ['Per-block fee', input.perBlockFeeCents, 0],
    ['Block minutes', input.blockMinutes, 1],
  ] as const) {
    if (!Number.isInteger(v) || v < min)
      return { ok: false, error: `${label} must be a whole number of ${min} or more.` }
  }

  const db = createSupabaseAdminClient()
  const { error } = await db.from('late_collection_settings').upsert(
    {
      school_id: schoolId,
      cutoff_time: input.cutoffTime,
      grace_minutes: input.graceMinutes,
      flat_fee_cents: input.flatFeeCents,
      per_block_fee_cents: input.perBlockFeeCents,
      block_minutes: input.blockMinutes,
      is_active: input.isActive,
    },
    { onConflict: 'school_id' },
  )
  if (error) {
    logger.error('late_fee_settings_upsert_failed', { schoolId, error: error.message })
    return { ok: false, error: 'Could not save the late-collection policy.' }
  }
  revalidatePath('/admin/late-collection')
  return { ok: true }
}

// ─── Record an incident ──────────────────────────────────────────────────────────

export interface RecordLateCollectionInput {
  studentId: string
  /** Collection date, YYYY-MM-DD. */
  date: string
  /** Collection time, HH:MM (24h). */
  time: string
  note?: string
  /** Email the linked parent(s) about the fee. */
  alertParent: boolean
}

export async function recordLateCollectionAction(
  input: RecordLateCollectionInput,
): Promise<ActionResult<{ feeCents: number; minutesLate: number; alerted: boolean }>> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: 'Enter a valid date.' }
  if (Number.isNaN(parseTimeToMinutes(input.time)))
    return { ok: false, error: 'Enter a valid collection time (HH:MM).' }

  const db = createSupabaseAdminClient()

  // Child must belong to this crèche.
  const { data: child } = await db
    .from('students')
    .select('id, first_name, last_name')
    .eq('id', input.studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }
  const childRow = child as { id: string; first_name: string; last_name: string }

  // Resolve the active policy (defaults if none configured).
  const { data: settings } = await db
    .from('late_collection_settings')
    .select(
      'cutoff_time, grace_minutes, flat_fee_cents, per_block_fee_cents, block_minutes, is_active',
    )
    .eq('school_id', schoolId)
    .maybeSingle()
  const s = settings as {
    cutoff_time: string
    grace_minutes: number
    flat_fee_cents: number
    per_block_fee_cents: number
    block_minutes: number
    is_active: boolean
  } | null

  const policy: LateFeePolicy = {
    cutoffTime: (s?.cutoff_time ?? '18:00').slice(0, 5),
    graceMinutes: s?.grace_minutes ?? 0,
    flatFeeCents: s?.flat_fee_cents ?? 0,
    perBlockFeeCents: s?.per_block_fee_cents ?? 0,
    blockMinutes: s?.block_minutes ?? 15,
  }

  const late = Math.max(0, minutesLate(policy.cutoffTime, input.time))
  const feeCents = s?.is_active === false ? 0 : computeLateFee(policy, late)
  // Stored (and displayed) as the wall-clock the admin entered — consistent round-trip.
  const collectedAtISO = `${input.date}T${input.time}:00.000Z`

  const { data: inserted, error } = await db
    .from('late_collections')
    .insert({
      school_id: schoolId,
      student_id: input.studentId,
      collected_at: collectedAtISO,
      minutes_late: late,
      fee_cents: feeCents,
      note: input.note?.trim() || null,
      parent_alerted: false,
      recorded_by: admin.id,
    })
    .select('id')
    .single()
  if (error || !inserted) {
    logger.error('late_collection_insert_failed', { schoolId, error: error?.message })
    return { ok: false, error: 'Could not record the late collection.' }
  }
  const incidentId = (inserted as { id: string }).id

  // Best-effort parent alert.
  let alerted = false
  if (input.alertParent) {
    alerted = await alertParents(db, {
      schoolId,
      studentId: input.studentId,
      childName: `${childRow.first_name} ${childRow.last_name}`,
      date: input.date,
      time: input.time,
      minutesLate: late,
      feeCents,
    })
    if (alerted) {
      await db.from('late_collections').update({ parent_alerted: true }).eq('id', incidentId)
    }
  }

  await db.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'late_collection.recorded',
    resource_type: 'late_collection',
    resource_id: incidentId,
    metadata: { minutes_late: late, fee_cents: feeCents, alerted },
    correlation_id: null,
    ip_address: null,
  })

  logger.info('late_collection_recorded', { schoolId, incidentId, feeCents, late, alerted })
  revalidatePath('/admin/late-collection')
  revalidatePath('/admin/dashboard')
  return { ok: true, feeCents, minutesLate: late, alerted }
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function alertParents(
  db: AdminClient,
  p: {
    schoolId: string
    studentId: string
    childName: string
    date: string
    time: string
    minutesLate: number
    feeCents: number
  },
): Promise<boolean> {
  try {
    const { data: links } = await db
      .from('parent_student_links')
      .select('parent_id')
      .eq('student_id', p.studentId)
      .eq('school_id', p.schoolId)
      .eq('is_active', true)
    const parentIds = (links ?? []).map((l) => (l as { parent_id: string }).parent_id)
    if (parentIds.length === 0) return false

    const { data: profiles } = await db
      .from('profiles')
      .select('email, first_name')
      .in('id', parentIds)
    const recipients = (profiles ?? [])
      .map((x) => x as { email: string | null; first_name: string | null })
      .filter((x): x is { email: string; first_name: string | null } => !!x.email)
    if (recipients.length === 0) return false

    const { data: schoolRow } = await db
      .from('schools')
      .select('name')
      .eq('id', p.schoolId)
      .maybeSingle()
    const schoolName = (schoolRow as { name: string } | null)?.name ?? 'your crèche'
    const from = buildEmailFrom(schoolName)
    const resend = getResend()
    const feeLine =
      p.feeCents > 0
        ? `A late collection fee of <strong>${formatCurrency(p.feeCents)}</strong> applies.`
        : `No fee has been applied on this occasion.`
    const portalUrl = `${serverEnv.appUrl}/parent`

    let sent = 0
    for (const r of recipients) {
      const greeting = r.first_name ? `Hi ${esc(r.first_name)},` : 'Hi,'
      const html = renderBrandedEmail({
        schoolName,
        subtitle: 'Late collection',
        bodyHtml: `
          <p style="margin:0 0 12px">${greeting}</p>
          <p><strong>${esc(p.childName)}</strong> was collected late on <strong>${esc(p.date)}</strong> at <strong>${esc(p.time)}</strong>
             (${p.minutesLate} minute${p.minutesLate === 1 ? '' : 's'} after our collection cutoff).</p>
          <p>${feeLine}</p>
          <p style="color:#6b7280;font-size:13px">Please ensure collection by the agreed time. Thank you.</p>
          <p style="margin:16px 0 0"><a href="${portalUrl}" style="color:#573c9b;font-weight:600">Open your parent portal</a></p>`,
      })
      const text =
        `${r.first_name ? `Hi ${r.first_name},` : 'Hi,'}\n\n` +
        `${p.childName} was collected late on ${p.date} at ${p.time} (${p.minutesLate} min after cutoff).\n` +
        (p.feeCents > 0
          ? `A late collection fee of ${formatCurrency(p.feeCents)} applies.\n`
          : `No fee has been applied on this occasion.\n`) +
        `\nParent portal: ${portalUrl}\n`
      const { error } = await resend.emails.send({
        from,
        to: r.email,
        subject: `Late collection for ${p.childName}${p.feeCents > 0 ? ` — ${formatCurrency(p.feeCents)}` : ''}`,
        html,
        text,
      })
      if (!error) sent++
      else logger.error('late_collection_alert_failed', { error: error.message })
    }
    return sent > 0
  } catch (err) {
    logger.error('late_collection_alert_exception', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    return false
  }
}
