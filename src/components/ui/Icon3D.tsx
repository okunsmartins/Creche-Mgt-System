// Soft 3D "clay" icons (Microsoft Fluent Emoji 3D, MIT — see public/icons/3d/LICENSE.txt),
// self-hosted as 128px WebP. Decorative by default: pair them with a visible text
// label. Pass `label` only when the icon stands alone and must be announced.

export const ICONS_3D = [
  'alarm',
  'bank',
  'bell',
  'bulb',
  'calendar',
  'card',
  'chart',
  'check',
  'child',
  'envelope',
  'euro',
  'gear',
  'heart',
  'locked',
  'house',
  'memo',
  'mobile',
  'moneybag',
  'party',
  'teacher',
  'phone',
  'pin',
  'plant',
  'scale',
  'school',
  'shield',
  'sparkles',
  'speech',
  'teddy',
  'wave',
] as const

export type Icon3DName = (typeof ICONS_3D)[number]

export function Icon3D({
  name,
  size = 40,
  label,
  className = '',
}: {
  name: Icon3DName
  size?: number
  label?: string
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static asset; next/image adds no value
    <img
      src={`/icons/3d/${name}.webp`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none drop-shadow-[0_3px_4px_rgba(31,43,87,0.15)] ${className}`}
    />
  )
}
