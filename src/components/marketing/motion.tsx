'use client'

// Small motion islands for the Creche Wise homepage (inspired by wise.com):
// scroll reveals, count-up numbers and a self-playing phone.
// Everything respects `prefers-reduced-motion` (content simply shows, no movement).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Icon3D, type Icon3DName } from '@/components/ui/Icon3D'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Calls back once when the element first scrolls into view. */
function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView, threshold])
  return { ref, inView }
}

/** Fades + lifts its children in when scrolled into view (optionally staggered). */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15)
  return (
    <div
      ref={ref}
      className={`cw-reveal ${className}`}
      data-shown={inView ? '' : undefined}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/** Counts from 0 up to `to` when scrolled into view (renders the final value without JS). */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1400,
  delay = 0,
}: {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  delay?: number
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.3)
  const [value, setValue] = useState(to)
  const armed = useRef(false)

  // Start from 0 before first paint (only when motion is allowed).
  useIsoLayoutEffect(() => {
    if (!prefersReducedMotion()) {
      armed.current = true
      setValue(0)
    }
  }, [])

  useEffect(() => {
    if (!inView || !armed.current) return
    let raf = 0
    let start = 0
    const timer = window.setTimeout(() => {
      const step = (t: number) => {
        if (!start) start = t
        const p = Math.min(1, (t - start) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        setValue(Math.round(to * eased))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [inView, to, duration, delay])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString('en-IE')}
      {suffix}
    </span>
  )
}

const FEED = [
  { k: 'Lunch', v: 'Ate it all', t: '12:10', tint: 'bg-[#e3f6ec]', icon: 'check' as Icon3DName },
  { k: 'Nap', v: '1 hr 20 min', t: '13:05', tint: 'bg-[#e4f1fc]', icon: 'alarm' as Icon3DName },
  {
    k: 'Art & craft',
    v: '2 photos',
    t: '14:30',
    tint: 'bg-[#fff1d6]',
    icon: 'sparkles' as Icon3DName,
  },
]

/**
 * The parent-app phone "playing" like a product video: today's updates arrive one by
 * one, then the invoice flips to Paid — on a loop, with a pause button.
 */
export function LivePhoneFeed({ schoolName = 'Little Meadows Crèche' }: { schoolName?: string }) {
  // step: 0..3 = number of feed items shown, 4 = invoice paid
  const [step, setStep] = useState(4)
  const [playing, setPlaying] = useState(true)
  const { ref, inView } = useInView<HTMLDivElement>(0.3)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPlaying(false)
      return
    }
    setStep(0)
  }, [])

  useEffect(() => {
    if (!playing || !inView) return
    const id = window.setInterval(() => setStep((s) => (s >= 5 ? 0 : s + 1)), 1300)
    return () => window.clearInterval(id)
  }, [playing, inView])

  const shown = Math.min(step, FEED.length)
  const paid = step >= 4

  return (
    <div ref={ref} className="relative w-[270px] max-w-full">
      <div
        className="rounded-[40px] bg-[#1e2a3a] p-3 shadow-[0_24px_50px_rgba(30,42,58,0.25)]"
        aria-hidden="true"
      >
        <div className="min-h-[392px] overflow-hidden rounded-[30px] bg-[#fff9ef]">
          <div className="bg-[#573c9b] px-[18px] pb-[18px] pt-[22px] text-white">
            <div className="font-display text-lg font-bold">{schoolName}</div>
            <div className="text-[13px] text-[#e4dcf7]">Good afternoon, Sarah</div>
          </div>
          <div className="flex flex-col gap-2.5 p-3.5 text-[13px]">
            <div className="text-xs font-extrabold uppercase tracking-[0.05em] text-text-secondary">
              Emma&apos;s day
            </div>
            {FEED.map((f, i) => (
              <div
                key={f.k}
                className="cw-feed-item flex items-center gap-2.5 rounded-[14px] bg-white px-3 py-2"
                data-shown={i < shown ? '' : undefined}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${f.tint}`}
                >
                  <Icon3D name={f.icon} size={22} />
                </span>
                <span className="flex-1 font-bold">{f.k}</span>
                <span className="font-bold text-text-secondary">{f.v}</span>
              </div>
            ))}
            <div className="rounded-[14px] bg-[#fff4d1] p-3">
              <div className="font-extrabold">Fees due · €200.00</div>
              <div
                className={`mt-2 rounded-[10px] p-2 text-center font-extrabold text-white transition-colors duration-500 ${paid ? 'bg-[#2b8a3e]' : 'bg-[#573c9b]'}`}
              >
                {paid ? 'Paid ✓ Thank you!' : 'Pay now'}
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="absolute -right-3 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-text-primary shadow-[0_6px_16px_rgba(31,43,87,0.18)] hover:scale-105"
        aria-label={playing ? 'Pause the animation' : 'Play the animation'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </div>
  )
}

/**
 * Like <Reveal>, but for a container whose DIRECT children should each fade up as
 * they scroll into view (optionally staggered) — no per-child wrappers needed.
 */
export function RevealGroup({
  children,
  className = '',
  stagger = 0,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    const items = Array.from(root.children) as HTMLElement[]
    items.forEach((el, i) => {
      el.classList.add('cw-reveal')
      if (stagger) el.style.transitionDelay = `${i * stagger}ms`
    })
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [stagger])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
