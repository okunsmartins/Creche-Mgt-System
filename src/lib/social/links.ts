// A crèche's social media links (Crèche Settings → shown on its login + public pages).
// Pure catalog + validation (unit-tested). Stored in school_settings as `social_<key>`.

export const SOCIAL_PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook',
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    placeholder: 'https://facebook.com/yourcreche',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    hosts: ['instagram.com'],
    placeholder: 'https://instagram.com/yourcreche or @yourcreche',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    hosts: ['tiktok.com'],
    placeholder: 'https://tiktok.com/@yourcreche or @yourcreche',
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    hosts: ['x.com', 'twitter.com'],
    placeholder: 'https://x.com/yourcreche or @yourcreche',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    hosts: ['youtube.com', 'youtu.be'],
    placeholder: 'https://youtube.com/@yourcreche',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    hosts: ['wa.me', 'whatsapp.com'],
    placeholder: 'https://wa.me/353871234567',
  },
] as const

export type SocialKey = (typeof SOCIAL_PLATFORMS)[number]['key']

export const SOCIAL_KEYS: readonly SocialKey[] = SOCIAL_PLATFORMS.map((p) => p.key)

/** school_settings key for a platform. */
export function socialSettingKey(key: SocialKey): string {
  return `social_${key}`
}

export interface SocialLink {
  key: SocialKey
  url: string
}

const HANDLE_RE = /^@?([A-Za-z0-9._]{1,60})$/

/** Where an `@handle` points for platforms that use handles. */
const HANDLE_URL: Partial<Record<SocialKey, (h: string) => string>> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
}

export type NormaliseResult = { ok: true; url: string | null } | { ok: false; error: string }

/**
 * Validate + normalise one link. Blank → null (remove). Accepts a full URL, a URL
 * without the scheme, or (Instagram/TikTok/X) an @handle. Only https links whose host
 * belongs to that platform are allowed, so a crèche page can't link elsewhere.
 */
export function normaliseSocialUrl(key: SocialKey, raw: string): NormaliseResult {
  const platform = SOCIAL_PLATFORMS.find((p) => p.key === key)
  if (!platform) return { ok: false, error: 'Unknown social network.' }
  const value = raw.trim()
  if (value === '') return { ok: true, url: null }
  if (value.length > 300) return { ok: false, error: `${platform.label} link is too long.` }

  const toHandleUrl = HANDLE_URL[key]
  if (toHandleUrl && value.startsWith('@')) {
    const m = HANDLE_RE.exec(value)
    if (!m) return { ok: false, error: `Enter a valid ${platform.label} handle or link.` }
    return { ok: true, url: toHandleUrl(m[1]!) }
  }

  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return { ok: false, error: `Enter a valid ${platform.label} link.` }
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password)
    return { ok: false, error: `Enter a valid ${platform.label} link.` }

  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '')
  const allowed = platform.hosts.some((h) => host === h || host.endsWith(`.${h}`))
  if (!allowed)
    return {
      ok: false,
      error: `That doesn't look like a ${platform.label} link (expected ${platform.hosts[0]}).`,
    }
  return { ok: true, url: url.toString() }
}

/** Order stored links by the catalog (stable display order), dropping unknown keys. */
export function orderSocialLinks(
  rows: ReadonlyArray<{ key: string; value: string }>,
): SocialLink[] {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  return SOCIAL_KEYS.flatMap((k) => {
    const url = byKey.get(socialSettingKey(k))
    return url ? [{ key: k, url }] : []
  })
}
