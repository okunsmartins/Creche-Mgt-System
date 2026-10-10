import { SOCIAL_GLYPHS } from './socialGlyphs'
import { SOCIAL_KEYS, type SocialLink } from '@/lib/social/links'

/**
 * Round brand buttons linking to a crèche's (or Creche Wise's) social pages; each
 * opens in a new tab. With `showPlaceholders`, every network is shown: saved ones
 * are full-colour links, the rest are faded, non-clickable placeholders until a link
 * is added in Settings. Without it, only saved links render (nothing if none).
 */
export function SocialLinks({
  links,
  schoolName,
  size = 44,
  className = '',
  showPlaceholders = false,
}: {
  links: SocialLink[]
  schoolName: string
  size?: number
  className?: string
  showPlaceholders?: boolean
}) {
  if (!links.length && !showPlaceholders) return null
  const byKey = new Map(links.map((l) => [l.key, l.url]))
  const keys = showPlaceholders ? SOCIAL_KEYS : links.map((l) => l.key)
  const circle =
    'flex items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(31,43,87,0.12)]'

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-3 ${className}`}
      aria-label={`${schoolName} on social media`}
    >
      {keys.map((key) => {
        const g = SOCIAL_GLYPHS[key]
        const url = byKey.get(key)
        const glyph = (
          <svg
            viewBox="0 0 24 24"
            width={Math.round(size * 0.48)}
            height={Math.round(size * 0.48)}
            aria-hidden="true"
            fill={g.hex}
          >
            <path d={g.path} />
          </svg>
        )
        return (
          <li key={key}>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${schoolName} on ${g.title} (opens in a new tab)`}
                title={g.title}
                className={`${circle} transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                style={{ width: size, height: size }}
              >
                {glyph}
              </a>
            ) : (
              // Placeholder: shown so the spot is visible, but not a link until set.
              <span
                aria-hidden="true"
                title={`${g.title} — not set up yet`}
                className={`${circle} opacity-40 grayscale`}
                style={{ width: size, height: size }}
              >
                {glyph}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
