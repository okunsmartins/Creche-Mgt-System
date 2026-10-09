/** The Creche Wise teddy-bear mascot (decorative). */
export function Mascot({ size = 104, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={className}
      focusable="false"
    >
      <circle cx="30" cy="30" r="18" fill="#C98A4B" />
      <circle cx="90" cy="30" r="18" fill="#C98A4B" />
      <circle cx="30" cy="30" r="9" fill="#F2C99A" />
      <circle cx="90" cy="30" r="9" fill="#F2C99A" />
      <circle cx="60" cy="66" r="44" fill="#D9995A" />
      <ellipse cx="60" cy="80" rx="20" ry="15" fill="#F6D9B4" />
      <circle cx="45" cy="60" r="5" fill="#1E2A3A" />
      <circle cx="75" cy="60" r="5" fill="#1E2A3A" />
      <circle cx="46.5" cy="58.5" r="1.6" fill="#FFFFFF" />
      <circle cx="76.5" cy="58.5" r="1.6" fill="#FFFFFF" />
      <ellipse cx="60" cy="74" rx="6" ry="4.5" fill="#1E2A3A" />
      <path
        d="M53 84 Q60 90 67 84"
        stroke="#1E2A3A"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="36" cy="77" r="5" fill="#F4A3A3" />
      <circle cx="84" cy="77" r="5" fill="#F4A3A3" />
    </svg>
  )
}

/** A small decorative star. */
export function Star({
  size = 24,
  color,
  className,
}: {
  size?: number
  color: string
  className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 2 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.9 6.1 20l1.2-6.5L2.5 8.9 9.1 8z"
        fill={color}
      />
    </svg>
  )
}

/** Wavy bottom edge for a hero section; `fill` should match the next section's background. */
export function WaveEdge({ fill = '#fff8ee' }: { fill?: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute bottom-0 left-0 block h-[70px] w-full"
    >
      <path d="M0 44 C 240 92 480 4 720 42 S 1200 92 1440 30 V80 H0 Z" fill={fill} />
    </svg>
  )
}
