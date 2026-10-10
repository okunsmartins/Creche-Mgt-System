import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { orderSocialLinks, socialSettingKey, SOCIAL_KEYS, type SocialLink } from './links'

/** A crèche's saved social links, in display order. School-scoped (service role). */
export async function getSchoolSocialLinks(schoolId: string): Promise<SocialLink[]> {
  const { data } = await createSupabaseAdminClient()
    .from('school_settings')
    .select('key, value')
    .eq('school_id', schoolId)
    .in('key', SOCIAL_KEYS.map(socialSettingKey))
  return orderSocialLinks((data as { key: string; value: string }[] | null) ?? [])
}
