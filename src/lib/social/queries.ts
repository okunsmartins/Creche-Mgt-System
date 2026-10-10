import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { orderSocialLinks, socialSettingKey, SOCIAL_KEYS, type SocialLink } from './links'

const SOCIAL_SETTING_KEYS = SOCIAL_KEYS.map(socialSettingKey)

/** A crèche's saved social links, in display order. School-scoped (service role). */
export async function getSchoolSocialLinks(schoolId: string): Promise<SocialLink[]> {
  const { data } = await createSupabaseAdminClient()
    .from('school_settings')
    .select('key, value')
    .eq('school_id', schoolId)
    .in('key', SOCIAL_SETTING_KEYS)
  return orderSocialLinks((data as { key: string; value: string }[] | null) ?? [])
}

/**
 * Creche Wise's own social links (platform owner sets them in /platform/settings).
 * Tolerant of the platform_settings table not existing yet (migration 109) → none.
 */
export async function getPlatformSocialLinks(): Promise<SocialLink[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from('platform_settings')
    .select('key, value')
    .in('key', SOCIAL_SETTING_KEYS)
  if (error) {
    logger.warn('platform_social_links_unavailable', { error: error.message })
    return []
  }
  return orderSocialLinks((data as { key: string; value: string }[] | null) ?? [])
}
