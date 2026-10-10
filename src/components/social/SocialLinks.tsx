import { SOCIAL_GLYPHS } from './socialGlyphs'
import type { SocialLink } from '@/lib/social/links'

/** Round brand buttons linking to a crèche's social pages (each opens in a new tab). */
export function SocialLinks({
  links,
  schoolName,
  size = 44,
  className = '',
}: {
  links: SocialLink[]
  schoolName: string
  size?: number
  className?: string
}) {
  if (!links.length) return null
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {links.map(({ key, url }) => {
        const g = SOCIAL_GLYPHS[key]
        return (
          <li key={key}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${schoolName} on ${g.title} (opens in a new tab)`}
              title={g.title}
              className="flex items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(31,43,87,0.12)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              style={{ width: size, height: size }}
            >
              <svg
                viewBox="0 0 24 24"
                width={Math.round(size * 0.48)}
                height={Math.round(size * 0.48)}
                aria-hidden="true"
                fill={g.hex}
              >
                <path d={g.path} />
              </svg>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
