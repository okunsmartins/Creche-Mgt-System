// Rainbow-lettered display text (each letter a different colour), as in the
// playful early-years brand reference. Colours are deepened so large text keeps
// at least 3:1 contrast on the cream and pale-blue backgrounds. Screen readers get
// the plain word; the per-letter spans are hidden from them.
export const RAINBOW = ['#e03131', '#e8590c', '#b07200', '#2b8a3e', '#1c7ed6', '#7048e8', '#d6336c']

export function RainbowText({
  text,
  offset = 0,
  animateFrom,
}: {
  text: string
  offset?: number
  /** Bounce the letters in one by one, starting after this many ms (homepage hero). */
  animateFrom?: number
}) {
  let i = offset
  return (
    <span className={animateFrom !== undefined ? 'cw-letters' : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((ch, idx) => {
          if (ch.trim() === '') return <span key={idx}>{ch}</span>
          const color = RAINBOW[i++ % RAINBOW.length]
          return (
            <span
              key={idx}
              style={
                animateFrom !== undefined
                  ? { color, animationDelay: `${animateFrom + idx * 90}ms` }
                  : { color }
              }
            >
              {ch}
            </span>
          )
        })}
      </span>
    </span>
  )
}
