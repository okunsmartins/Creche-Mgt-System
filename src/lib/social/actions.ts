'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { normaliseSocialUrl, socialSettingKey, SOCIAL_PLATFORMS } from './links'

export type SocialLinksState = {
  ok?: boolean
  error?: string
  fieldErrors?: Partial<Record<string, string>>
} | null

/** Save the admin's crèche social links (blank removes a link). Admin-only, school-scoped. */
export async function saveSocialLinksAction(
  _prev: SocialLinksState,
  formData: FormData,
): Promise<SocialLinksState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }

  const upserts: { school_id: string; key: string; value: string; description: string }[] = []
  const removals: string[] = []
  const fieldErrors: Record<string, string> = {}

  for (const p of SOCIAL_PLATFORMS) {
    const raw = formData.get(p.key)
    const result = normaliseSocialUrl(p.key, typeof raw === 'string' ? raw : '')
    if (!result.ok) {
      fieldErrors[p.key] = result.error
      continue
    }
    if (result.url)
      upserts.push({
        school_id: admin.schoolId,
        key: socialSettingKey(p.key),
        value: result.url,
        description: `${p.label} page`,
      })
    else removals.push(socialSettingKey(p.key))
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors }

  const db = createSupabaseAdminClient()
  if (upserts.length) {
    const { error } = await db
      .from('school_settings')
      .upsert(upserts, { onConflict: 'school_id,key' })
    if (error) {
      logger.error('social_links_save_failed', { schoolId: admin.schoolId, error: error.message })
      return { error: 'Could not save your social links. Please try again.' }
    }
  }
  if (removals.length) {
    await db.from('school_settings').delete().eq('school_id', admin.schoolId).in('key', removals)
  }

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout') // sign-in + public crèche pages show the links
  return { ok: true }
}
