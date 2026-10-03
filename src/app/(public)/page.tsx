import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Mail,
  MessageSquare,
  Wallet,
  CalendarOff,
  ClipboardCheck,
  CalendarDays,
  CreditCard,
  ReceiptText,
  GraduationCap,
  CalendarCheck,
  Upload,
  ClipboardList,
  Baby,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { getPublicViewerContext } from '@/lib/tenant/server'
import { HeroCarousel } from '@/components/marketing/HeroCarousel'

export const metadata: Metadata = { title: 'Home' }

interface Feature {
  icon: LucideIcon
  title: string
  label: string
  glow: string
  href?: string
  cta?: string
  comingSoon?: boolean
}

// Capabilities shown on the landing page. `comingSoon` cards are not yet built —
// they render with a badge and are non-clickable so we never advertise a feature
// a visitor can't actually use.
const features: Feature[] = [
  {
    icon: Mail,
    title: 'Email parents',
    label: 'Staff & admins message parents',
    href: '/login',
    cta: 'Staff sign in',
    glow: 'card-glow-green',
  },
  {
    icon: MessageSquare,
    title: 'Text parents',
    label: 'SMS straight to phones',
    glow: 'card-glow-teal',
    // Included with the plan, but kept "Coming soon" until the ComReg sender-ID
    // registration is approved (an unregistered sender is flagged "likely scam").
    // Flip to href:'/login', cta:'Staff sign in' once approved.
    comingSoon: true,
  },
  {
    icon: Wallet,
    title: 'Pay in 4 instalments',
    label: 'Spread the cost over four payments',
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-blue',
  },
  {
    icon: CalendarOff,
    title: 'Staff time off',
    label: 'Request & approve staff leave',
    href: '/login',
    cta: 'Staff sign in',
    glow: 'card-glow-green',
  },
  {
    icon: ClipboardCheck,
    title: 'Mark attendance',
    label: 'Daily register by room',
    href: '/login',
    cta: 'Staff sign in',
    glow: 'card-glow-teal',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance & absences',
    label: 'Parents view attendance and explain absences',
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-blue',
  },
  {
    icon: Upload,
    title: 'Learning journal',
    label: "Photos and notes from your child's day",
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-green',
  },
  {
    icon: GraduationCap,
    title: 'Development reports',
    label: 'Progress and observations shared with parents',
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-amber',
  },
  {
    icon: ClipboardList,
    title: 'Permission slips',
    label: 'Grant or decline consent online',
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-teal',
  },
  {
    icon: CalendarDays,
    title: 'Activities & programmes',
    label: 'Create and manage offerings',
    href: '/login',
    cta: 'Staff sign in',
    glow: 'card-glow-blue',
  },
  {
    icon: CreditCard,
    title: 'Pay for activities',
    label: 'Activities & programmes, securely',
    href: '/guest-payment',
    cta: 'Pay as guest',
    glow: 'card-glow-green',
  },
  {
    icon: ReceiptText,
    title: 'Payment history',
    label: 'Track orders & receipts',
    href: '/login',
    cta: 'Parent login',
    glow: 'card-glow-teal',
  },
]

export default async function HomePage() {
  // Viewer-aware so the hero badge agrees with the header rendered by
  // (public)/layout.tsx — otherwise a signed-in St Marys user sees their school in
  // the header and the DEFAULT school's name in the hero on the same page. The
  // platform owner on the bare apex is treated as a platform visitor here too.
  const { school, tenantSlug } = await getPublicViewerContext()
  // Main landing = no school resolved for this viewer (anonymous apex). A
  // signed-in school user (even on the apex) is in their school's context, so
  // they get the crèche hero, not the "create your own portal" marketing — this
  // matches the header nav decided in (public)/layout.tsx.
  const isMainLanding = school === null
  // When browsing via a `/s/<school>` path, keep that prefix on school links so
  // navigation stays in the crèche (no sticky cookie carries it).
  const withTenant = (href: string) =>
    tenantSlug ? (href === '/' ? `/s/${tenantSlug}` : `/s/${tenantSlug}${href}`) : href
  return (
    <>
      {/* Hero — the 5-slide carousel is the Creche Wise PLATFORM landing only.
          A signed-up crèche's own portal gets a static hero branded to its name. */}
      {isMainLanding ? (
        <HeroCarousel />
      ) : (
        <section className="px-4 pb-10 pt-8 sm:px-6 md:pb-14 md:pt-12 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div
              className="relative flex flex-col justify-center overflow-hidden rounded-3xl px-6 py-10 shadow-card sm:px-10 md:min-h-[466px] md:px-14 md:py-14"
              style={{
                background: 'linear-gradient(135deg, #3fc5c0 0%, #14b3ad 52%, #0f9b96 100%)',
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              />

              <div className="relative grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
                <div className="text-center md:text-left">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {school?.name} Online Portal
                  </div>
                  <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
                    Welcome to <span className="text-[#ffd98a]">{school?.name}</span> 👋
                  </h1>
                  <p className="mx-auto mt-5 max-w-lg text-lg text-white/85 md:mx-0">
                    Pay fees, keep up with your child’s day, and stay in touch with the team — all
                    in one secure place.
                  </p>
                  <div className="mx-auto mt-8 w-full max-w-md space-y-3 md:mx-0">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={withTenant('/login')}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        Parent login
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={withTenant('/guest-payment')}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white/15 px-7 py-3 text-base font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-all hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        Pay as a guest
                      </Link>
                    </div>
                    <Link
                      href={withTenant('/login')}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Teacher or staff sign in
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Playful illustration */}
                <div
                  aria-hidden="true"
                  className="relative mx-auto hidden h-[300px] w-full max-w-sm md:block"
                >
                  <div className="absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur-sm">
                    <Baby className="h-24 w-24 text-white" strokeWidth={1.5} />
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
                  <span className="absolute left-10 top-1/2 h-2.5 w-2.5 rounded-full bg-white/50" />
                  <span className="absolute bottom-8 right-1/3 h-2 w-2 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="pb-16 pt-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Everything your crèche needs
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Fees, subvention, payments, communication and day-to-day admin — all in one portal.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, label, href, cta, comingSoon }, index) => {
              // On the platform landing every card funnels schools to sign-up; inside
              // a crèche's portal the original parent/staff CTAs are kept.
              const cardHref = isMainLanding ? '/get-started' : withTenant(href ?? '#')
              const cardCta = isMainLanding ? 'Create your portal' : cta
              // Evenly distribute the four card tints (diagonal): each colour
              // appears 3× across the 12 cards, with no side-by-side or stacked
              // repeats in the 4-column grid.
              const CARD_GLOWS = [
                'card-glow-green',
                'card-glow-teal',
                'card-glow-blue',
                'card-glow-amber',
              ]
              const glowClass =
                CARD_GLOWS[((index % 4) + Math.floor(index / 4)) % 4] ?? 'card-glow-blue'
              const inner = (
                <>
                  {/* Shimmer sweep (clickable cards only) */}
                  {!comingSoon && (
                    <div
                      className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
                      aria-hidden="true"
                    />
                  )}

                  {/* Coming-soon badge */}
                  {comingSoon && (
                    <span className="absolute right-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20">
                      Coming soon
                    </span>
                  )}

                  {/* Icon */}
                  <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10 transition-all group-hover:bg-white group-hover:ring-primary/25">
                    <Icon
                      className="h-[18px] w-[18px] text-primary transition-colors"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Title + label */}
                  <p className="text-xl font-bold tracking-tight text-text-primary transition-transform group-hover:-translate-y-0.5">
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-text-secondary transition-transform group-hover:-translate-y-0.5">
                    {label}
                  </p>

                  {/* Hover-reveal CTA (clickable cards only) */}
                  {!comingSoon && (
                    <div className="mt-4 overflow-hidden">
                      <div className="flex translate-y-8 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20 backdrop-blur-sm">
                          {cardCta}
                          <ArrowRight
                            className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )

              return comingSoon ? (
                <div
                  key={title}
                  aria-disabled="true"
                  className={`${glowClass} group relative overflow-hidden rounded-2xl p-5 opacity-70`}
                >
                  {inner}
                </div>
              ) : (
                <Link
                  key={title}
                  href={cardHref}
                  className={`${glowClass} group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA — viewer-aware, matching the hero/cards: the platform landing funnels
          schools to create their own portal, while inside a crèche's portal it
          invites parents to register (keeping the tenant prefix on /s/ paths). */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-text-primary">
            {isMainLanding ? 'Ready to get started?' : 'Not registered yet?'}
          </h2>
          <p className="mt-3 text-sm text-text-muted">
            {isMainLanding
              ? 'Set up your crèche’s own portal to collect payments, handle subvention and manage your service in one place.'
              : 'Create a parent account to manage payments for all your children in one place.'}
          </p>
          <Link
            href={isMainLanding ? '/get-started' : withTenant('/register')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
          >
            {isMainLanding ? 'Create your portal' : 'Create an account'}
          </Link>
        </div>
      </section>
    </>
  )
}
