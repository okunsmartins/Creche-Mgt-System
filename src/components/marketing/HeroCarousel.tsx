'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  ReceiptText,
  Upload,
  CreditCard,
  ClipboardCheck,
  Mail,
  CalendarDays,
  Building2,
  type LucideIcon,
} from 'lucide-react'

interface Slide {
  badge: string
  headline: string
  highlight: string
  emoji: string
  sub: string
  icon: LucideIcon
}

// Five crèche-focused value props for the CRECHE WISE PLATFORM landing only.
// (A signed-up crèche sees its own branded static hero, not this carousel.)
const SLIDES: Slide[] = [
  {
    badge: 'Crèche management platform',
    headline: 'Crèche management,',
    highlight: 'made simple',
    emoji: '🧸',
    sub: 'Enrolments, fees, subvention, attendance and parent payments — one calm, secure place for your crèche.',
    icon: Building2,
  },
  {
    badge: 'ECCE & NCS built in',
    headline: 'Fees & subvention,',
    highlight: 'sorted',
    emoji: '🧮',
    sub: 'ECCE and NCS are netted off every invoice automatically. No more spreadsheet maths at the end of the month.',
    icon: ReceiptText,
  },
  {
    badge: 'Onboarding in minutes',
    headline: 'Off spreadsheets,',
    highlight: 'in minutes',
    emoji: '📄',
    sub: 'Bring your existing children and staff lists straight in — upload your spreadsheet, map the columns, done.',
    icon: Upload,
  },
  {
    badge: 'Parent payments',
    headline: 'Parents pay',
    highlight: 'online',
    emoji: '💳',
    sub: 'Card or wallet, clear receipts, and the option to spread the cost over four instalments.',
    icon: CreditCard,
  },
  {
    badge: 'Ratios & communication',
    headline: 'Stay',
    highlight: 'ratio-ready',
    emoji: '✅',
    sub: 'Live room ratios, daily attendance, and messages that reach parents by email or text in seconds.',
    icon: ClipboardCheck,
  },
]

const AUTO_MS = 6000

export function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useRef(false)

  useEffect(() => {
    reducedMotion.current =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const go = useCallback((n: number) => setIndex(((n % SLIDES.length) + SLIDES.length) % SLIDES.length), [])

  useEffect(() => {
    if (paused || reducedMotion.current) return
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_MS)
    return () => clearInterval(t)
  }, [paused, index])

  const slide = SLIDES[index]!
  const Icon = slide.icon

  return (
    <section className="px-4 pb-10 pt-8 sm:px-6 md:pb-14 md:pt-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div
          className="relative flex flex-col justify-center overflow-hidden rounded-3xl px-6 py-10 shadow-card sm:px-10 md:min-h-[466px] md:px-14 md:py-14"
          style={{ background: 'linear-gradient(135deg, #3fc5c0 0%, #14b3ad 52%, #0f9b96 100%)' }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          role="region"
          aria-roledescription="carousel"
          aria-label="What Creche Wise does"
        >
          {/* Soft decorative blobs */}
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

          <div className="relative grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
            {/* Rotating copy */}
            <div className="text-center md:text-left" aria-live="polite">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {slide.badge}
              </div>
              <h1 key={index} className="hero-slide-in text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
                {slide.headline} <span className="text-[#ffd98a]">{slide.highlight}</span> <span aria-hidden>{slide.emoji}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-lg text-white/85 md:mx-0">{slide.sub}</p>

              {/* Platform CTA — fixed across slides */}
              <div className="mx-auto mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-2 md:mx-0 md:justify-start">
                <Link
                  href="/get-started"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Create your crèche portal
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Illustration — central emblem swaps per slide */}
            <div aria-hidden className="relative mx-auto hidden h-[300px] w-full max-w-sm md:block">
              <div className="absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
                <Icon key={index} className="hero-emblem-in h-24 w-24 text-white" strokeWidth={1.5} />
              </div>
              <div className="absolute left-2 top-6 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white/20 shadow-md ring-1 ring-white/30 backdrop-blur-sm">
                <CreditCard className="h-7 w-7 text-white" />
              </div>
              <div className="absolute right-3 top-2 flex h-16 w-16 rotate-6 items-center justify-center rounded-2xl bg-white/20 shadow-md ring-1 ring-white/30 backdrop-blur-sm">
                <Mail className="h-7 w-7 text-white" />
              </div>
              <div className="absolute bottom-6 left-6 flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-white/20 shadow-md ring-1 ring-white/30 backdrop-blur-sm">
                <CalendarDays className="h-7 w-7 text-white" />
              </div>
              <div className="absolute bottom-3 right-4 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white/20 shadow-md ring-1 ring-white/30 backdrop-blur-sm">
                <ClipboardCheck className="h-7 w-7 text-white" />
              </div>
              <Sparkles className="absolute right-10 top-1/2 h-6 w-6 text-[#ffd98a]" />
            </div>
          </div>

          {/* Controls: prev / dots / next */}
          <div className="relative mt-8 flex items-center justify-center gap-4 md:justify-start">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
            </button>
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose slide">
              {SLIDES.map((s, i) => (
                <button
                  key={s.headline}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Slide ${i + 1}: ${s.headline} ${s.highlight}`}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
