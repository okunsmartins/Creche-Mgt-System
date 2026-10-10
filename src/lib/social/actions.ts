'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { normaliseSocialUrl, socialSettingKey, SOCIAL_PLATFORMS } from './links'

export type SocialLinksState = {
  ok?: boolean
  error?: string
  fieldErrors?: Partial<Record<string, string>>
} | null

interface ParsedLinks {
  set: { key: string; value: string; label: string }[]
  remove: string[]
}

/** Validate every network's box; blank = remove. */
function parseLinks(
  formData: FormData,
): { ok: true; links: ParsedLinks } | { ok: false; fieldErrors: Record<string, string> } {
  const links: ParsedLinks = { set: [], remove: [] }
  const fieldErrors: Record<string, string> = {}
  for (const p of SOCIAL_PLATFORMS) {
    const raw = formData.get(p.key)
    const result = normaliseSocialUrl(p.key, typeof raw === 'string' ? raw : '')
    if (!result.ok) fieldErrors[p.key] = result.error
    else if (result.url)
      links.set.push({ key: socialSettingKey(p.key), value: result.url, label: p.label })
    else links.remove.push(socialSettingKey(p.key))
  }
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, links }
}

/** Save the admin's crèche social links (blank removes a link). Admin-only, school-scoped. */
export async function saveSocialLinksAction(
  _prev: SocialLinksState,
  formData: FormData,
): Promise<SocialLinksState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }
  const parsed = parseLinks(formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }
  const schoolId = admin.schoolId

  const db = createSupabaseAdminClient()
  if (parsed.links.set.length) {
    const { error } = await db.from('school_settings').upsert(
      parsed.links.set.map((l) => ({
        school_id: schoolId,
        key: l.key,
        value: l.value,
        description: `${l.label} page`,
      })),
      { onConflict: 'school_id,key' },
    )
    if (error) {
      logger.error('social_links_save_failed', { schoolId, error: error.message })
      return { error: 'Could not save your social links. Please try again.' }
    }
  }
  if (parsed.links.remove.length) {
    await db
      .from('school_settings')
      .delete()
      .eq('school_id', schoolId)
      .in('key', parsed.links.remove)
  }

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout') // sign-in, public pages + footers show the links
  return { ok: true }
}

/** Save Creche Wise's own social links (platform owner only). */
export async function savePlatformSocialLinksAction(
  _prev: SocialLinksState,
  formData: FormData,
): Promise<SocialLinksState> {
  const user = await requireAuth()
  if (!isPlatformOwner(user)) return { error: 'Only the platform owner can change these.' }
  const parsed = parseLinks(formData)
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors }

  const db = createSupabaseAdminClient()
  if (parsed.links.set.length) {
    const { error } = await db.from('platform_settings').upsert(
      parsed.links.set.map((l) => ({ key: l.key, value: l.value })),
      { onConflict: 'key' },
    )
    if (error) {
      logger.error('platform_social_links_save_failed', { error: error.message })
      return {
        error:
          'Could not save. If this is the first time, apply migration 109 (platform_settings) in Supabase.',
      }
    }
  }
  if (parsed.links.remove.length) {
    await db.from('platform_settings').delete().in('key', parsed.links.remove)
  }

  revalidatePath('/platform/settings')
  revalidatePath('/', 'layout')
  return { ok: true }
}
