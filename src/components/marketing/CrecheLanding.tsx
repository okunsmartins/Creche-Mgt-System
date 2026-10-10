import Link from 'next/link'
import { ArrowRight, Check, Lock, MapPin } from 'lucide-react'
import type { School } from '@/lib/tenant/server'
import { RainbowText } from '@/components/ui/RainbowText'
import { Icon3D } from '@/components/ui/Icon3D'
import { Mascot, Star, WaveEdge } from './Mascot'
import { WaitingListForm } from './WaitingListForm'
import { SocialLinks } from '@/components/social/SocialLinks'
import type { SocialLink } from '@/lib/social/links'

// A crèche's own parent-facing page (tenant resolved). Only shows facts the crèche
// has actually entered — name, logo, rooms, contact details — and hides a section
// when the data isn't there. The parent-app preview uses illustrative sample data.

export interface CrecheRoom {
  name: string
  capacity: number | null
}

// Rainbow dashed-card palette, as in the brand reference (border / badge).
const ROOM_TINTS = [
  { border: 'border-[#f48fb1]', badge: '#ec4f8b' },
  { border: 'border-[#f5c84c]', badge: '#f7931e' },
  { border: 'border-[#a5d6a7]', badge: '#4caf50' },
  { border: 'border-[#90caf9]', badge: '#3a8ee6' },
  { border: 'border-[#b39ddb]', badge: '#8b5cf6' },
  { border: 'border-[#ef9a9a]', badge: '#ef5350' },
]

const DAY = [
  ['Arrive & settle', 'A warm hello and time to settle in', 'border-primary'],
  ['Play & learn', 'Art, music, stories and sensory play', 'border-accent-sunny'],
  ['Meals & snacks', 'Healthy food through the day', 'border-accent-leaf'],
  ['Rest time', 'Naps for little ones, quiet time for big ones', 'border-accent-sky'],
  ['Outdoor play', 'Fresh air and room to run', 'border-accent-coral'],
  ['Home time', 'Wind down, ready for collection', 'border-accent-grape'],
] as const

function StarBadge({ n, color }: { n: number; color: string }) {
  return (
    <span className="relative flex h-12 w-12 flex-none items-center justify-center">
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-12 w-12" aria-hidden="true">
        <path
          d="m12 2 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 16.9 6.1 20l1.2-6.5L2.5 8.9 9.1 8z"
          fill={color}
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative pt-0.5 font-display text-lg font-bold text-white">{n}</span>
    </span>
  )
}

export function CrecheLanding({
  school,
  rooms,
  withTenant,
  socialLinks = [],
}: {
  school: School
  rooms: CrecheRoom[]
  withTenant: (href: string) => string
  socialLinks?: SocialLink[]
}) {
  const address = [
    school.address_line1,
    school.address_line2,
    school.city,
    school.county ? `Co. ${school.county.replace(/^co\.?\s*/i, '')}` : null,
    school.eircode,
  ].filter((p): p is string => !!p && p.trim() !== '')
  const mapsHref = address.length
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.name}, ${address.join(', ')}`)}`
    : null
  const hasContact = address.length > 0 || !!school.phone || !!school.email

  return (
    <div className="bg-background text-text-primary">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f3eeff]">
        <div
          aria-hidden="true"
          className="absolute -left-28 bottom-16 h-72 w-72 rounded-full bg-secondary-light"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#fff1c2]"
        />
        <Star size={30} color="#FFC93C" className="absolute left-[47%] top-11 hidden md:block" />
        <Star size={20} color="#EC4F8B" className="absolute right-[4%] top-40" />
        <Star size={18} color="#3A8EE6" className="absolute bottom-32 left-[3%]" />
        <div className="relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-4 pb-[120px] pt-12 sm:px-8 md:pt-16">
          <div className="min-w-0 flex-[1_1_460px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-extrabold text-primary">
              <span className="h-2 w-2 rounded-full bg-accent-leaf" />
              Welcome to {school.name}
            </span>
            <h1 className="mt-5 text-[clamp(40px,5.2vw,64px)] font-bold leading-[1.05]">
              A <span className="text-primary">safe</span>,{' '}
              <span className="text-secondary">happy</span> place to{' '}
              <RainbowText text="learn & grow." />
            </h1>
            <p className="mt-5 max-w-[540px] text-[19px] text-text-secondary">
              Caring for your little ones every day — and keeping you close with our parent app,
              where you can follow your child&apos;s day, see invoices and hear from the team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#visit"
                className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-primary px-6 py-3.5 text-[17px] font-extrabold text-white transition-colors hover:bg-primary-hover"
              >
                Join our waiting list
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link
                href={withTenant('/login')}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full border-2 border-primary/25 bg-white px-6 py-3.5 text-[17px] font-extrabold transition-colors hover:border-primary"
              >
                <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
                Parent sign in
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-bold text-text-secondary">
              <Link href={withTenant('/guest-payment')} className="underline underline-offset-4">
                Pay as a guest
              </Link>
              <Link href={withTenant('/login')} className="underline underline-offset-4">
                Staff sign in
              </Link>
            </div>
          </div>

          {/* Decorative collage: the crèche's logo when it has one, else the mascot */}
          <div
            className="relative hidden min-h-[400px] min-w-0 flex-[1_1_420px] md:block"
            aria-hidden="true"
          >
            <div className="absolute inset-[0_70px_60px_0] flex items-center justify-center rounded-[48%_52%_44%_56%/52%_44%_56%_48%] border-[6px] border-white bg-[repeating-linear-gradient(135deg,#e5dbff_0_14px,#ede5ff_14px_28px)] shadow-[0_20px_50px_rgba(87,60,155,0.18)]">
              {school.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={school.logo_url}
                  alt=""
                  className="max-h-[55%] max-w-[55%] rounded-3xl bg-white object-contain p-4 shadow-lg"
                />
              ) : (
                <Mascot size={170} />
              )}
            </div>
            <div className="absolute bottom-0 right-0 flex h-[170px] w-[200px] items-center justify-center rounded-[38px] border-[6px] border-white bg-[repeating-linear-gradient(135deg,#ffe7a8_0_12px,#fff0c4_12px_24px)] shadow-[0_16px_36px_rgba(31,43,87,0.15)]">
              <Icon3D name="house" size={96} />
            </div>
            <div className="absolute bottom-8 left-0 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-[0_14px_34px_rgba(31,43,87,0.14)]">
              <Icon3D name="mobile" size={40} />
              <span className="leading-tight">
                <span className="block text-sm font-extrabold">Parent app</span>
                <span className="text-xs font-semibold text-text-secondary">
                  Updates through the day
                </span>
              </span>
            </div>
          </div>
        </div>
        <WaveEdge fill="#fff8ec" />
      </section>

      {/* Contact strip */}
      {hasContact && (
        <section
          aria-label="Contact details"
          className="relative mx-auto -mt-10 max-w-[1200px] px-4 sm:px-8"
        >
          <div className="grid gap-5 rounded-[26px] bg-white p-6 shadow-[0_18px_46px_rgba(31,43,87,0.09)] sm:grid-cols-3">
            {address.length > 0 && (
              <div className="flex items-start gap-3.5">
                <Icon3D name="pin" size={44} />
                <span>
                  <span className="block font-extrabold">Find us</span>
                  <span className="text-sm text-text-secondary">{address.join(', ')}</span>
                </span>
              </div>
            )}
            {school.phone && (
              <div className="flex items-start gap-3.5">
                <Icon3D name="phone" size={44} />
                <span>
                  <span className="block font-extrabold">Call us</span>
                  <a href={`tel:${school.phone.replace(/\s+/g, '')}`} className="text-sm underline">
                    {school.phone}
                  </a>
                </span>
              </div>
            )}
            {school.email && (
              <div className="flex items-start gap-3.5">
                <Icon3D name="envelope" size={44} />
                <span className="min-w-0">
                  <span className="block font-extrabold">Email us</span>
                  <a href={`mailto:${school.email}`} className="break-all text-sm underline">
                    {school.email}
                  </a>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Rooms */}
      {rooms.length > 0 && (
        <section id="rooms" className="mx-auto max-w-[1200px] px-4 pb-6 pt-24 sm:px-8">
          <div className="mx-auto max-w-[640px] text-center">
            <span className="text-sm font-extrabold uppercase tracking-[0.06em] text-secondary">
              Our rooms
            </span>
            <h2 className="mt-2 text-[clamp(32px,3.6vw,44px)] font-bold leading-[1.1]">
              A room for every stage
            </h2>
            <p className="mt-3.5 text-lg text-text-secondary">
              Small groups with familiar faces, so every child gets real attention.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.map((room, i) => {
              const tint = ROOM_TINTS[i % ROOM_TINTS.length]!
              return (
                <article
                  key={`${i}-${room.name}`}
                  className={`flex items-center gap-4 rounded-[26px] border-2 border-dashed bg-white p-5 shadow-[0_10px_30px_rgba(31,43,87,0.06)] ${tint.border}`}
                >
                  <StarBadge n={i + 1} color={tint.badge} />
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-semibold leading-tight">{room.name}</h3>
                    {room.capacity ? (
                      <p className="text-sm font-bold text-text-secondary">
                        Up to {room.capacity} children
                      </p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* A day with us */}
      <section id="day" className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
        <div className="rounded-[34px] border-2 border-dashed border-[#b39ddb] bg-white p-6 sm:p-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-sm font-extrabold uppercase tracking-[0.06em] text-secondary">
                A day with us
              </span>
              <h2 className="mt-2 text-[clamp(30px,3.4vw,40px)] font-bold leading-[1.1]">
                What a typical day looks like
              </h2>
            </div>
            <p className="max-w-[360px] text-[15px] text-text-secondary">
              Every room keeps its own rhythm, especially for babies — ask us about yours.
            </p>
          </div>
          <ol className="mt-9 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {DAY.map(([title, body, border]) => (
              <li key={title} className={`border-t-[5px] pt-3.5 ${border}`}>
                <span className="font-display text-xl font-bold">{title}</span>
                <p className="mt-1 text-[15px] text-text-secondary">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Parent app */}
      <section id="portal" className="bg-primary text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-4 py-20 sm:px-8">
          <div className="min-w-0 flex-[1_1_420px]">
            <span className="text-sm font-extrabold uppercase tracking-[0.06em] text-accent-sunny">
              For our parents
            </span>
            <h2 className="mt-2 text-[clamp(32px,3.8vw,46px)] font-bold leading-[1.1] text-white">
              Stay close all day, wherever you are
            </h2>
            <p className="mt-4 text-lg text-white/85">
              Our parent app shows you meals, naps and nappies as they happen, plus your invoices
              and messages from your child&apos;s room.
            </p>
            <ul className="mt-6 flex flex-col gap-3 font-bold">
              {[
                "Your child's day: meals, sleep and nappy changes",
                'Invoices and payments in one place',
                'Permission slips, messages and absence notes',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-accent-sunny text-text-primary">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={withTenant('/login')}
                className="inline-flex min-h-[52px] items-center rounded-full bg-accent-sunny px-6 text-[17px] font-extrabold text-text-primary"
              >
                Sign in to the parent app
              </Link>
              <span className="text-sm text-white/85">
                New parent? Use the invite link we email you, or{' '}
                <Link href={withTenant('/register')} className="font-bold text-white underline">
                  create an account
                </Link>
                .
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_340px] justify-center" aria-hidden="true">
            <div className="w-[300px] max-w-full rounded-[44px] bg-text-primary p-3 shadow-[0_30px_60px_rgba(0,0,0,0.28)]">
              <div className="overflow-hidden rounded-[34px] bg-[#f6f3fc] text-text-primary">
                <div className="bg-secondary px-[18px] pb-[18px] pt-[22px] text-white">
                  <span className="text-xs font-bold text-white/80">{school.name}</span>
                  <div className="font-display text-xl font-bold">Here&apos;s Emma&apos;s day</div>
                </div>
                <div className="flex flex-col gap-2.5 p-3.5 text-[13px]">
                  {[
                    ['Lunch', 'ate most of it', '12:10', 'bg-[#e3f6ec]'],
                    ['Nap', '1 hr 20 min', '13:05', 'bg-[#e4f1fc]'],
                    ['Nappy', 'changed', '14:30', 'bg-[#fff1d6]'],
                  ].map(([k, v, t, bg]) => (
                    <div key={k} className="flex items-center gap-2.5 rounded-2xl bg-white p-3">
                      <span className={`h-[34px] w-[34px] flex-none rounded-[10px] ${bg}`} />
                      <span className="flex-1">
                        <b>{k}</b> · {v}
                      </span>
                      <span className="text-text-secondary">{t}</span>
                    </div>
                  ))}
                  <div className="rounded-2xl border-2 border-accent-sunny bg-white p-3">
                    <div className="flex justify-between font-extrabold">
                      <span>October invoice</span>
                      <span>€200.00</span>
                    </div>
                    <div className="mt-2 rounded-full bg-primary p-2 text-center font-extrabold text-white">
                      Pay now
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Waiting list + find us */}
      <section
        id="visit"
        className="mx-auto flex max-w-[1200px] flex-wrap gap-7 px-4 pb-24 pt-20 sm:px-8"
      >
        <div className="relative min-w-0 flex-[1.3_1_460px] rounded-[32px] bg-white p-6 shadow-[0_14px_40px_rgba(31,43,87,0.08)] sm:p-10">
          <h2 className="text-[clamp(28px,3.2vw,38px)] font-bold leading-[1.1]">
            Join our waiting list or book a visit
          </h2>
          <p className="mt-2.5 text-text-secondary">
            Tell us a little about your child and we&apos;ll be in touch.
          </p>
          <WaitingListForm schoolName={school.name} />
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <div className="rounded-[32px] border-2 border-dashed border-[#f48fb1] bg-white p-7">
            <h3 className="text-2xl font-bold">Questions about fees?</h3>
            <p className="mt-2.5 text-text-secondary">
              Ask us for a full breakdown. Once your child starts, invoices appear in the parent
              app, with any ECCE or NCS funding you&apos;re due already taken off.
            </p>
          </div>
          {socialLinks.length > 0 && (
            <div className="rounded-[32px] bg-white p-7 shadow-[0_10px_30px_rgba(31,43,87,0.06)]">
              <h3 className="text-2xl font-bold">Follow us</h3>
              <p className="mt-1 text-text-secondary">See what we get up to day to day.</p>
              <SocialLinks
                links={socialLinks}
                schoolName={school.name}
                className="mt-4 !justify-start"
              />
            </div>
          )}
          {hasContact && (
            <div className="rounded-[32px] bg-[#f3eeff] p-7">
              <h3 className="text-2xl font-bold">Find us</h3>
              {address.length > 0 && (
                <p className="mt-2.5 font-semibold text-text-secondary">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-3 flex flex-col gap-1 font-bold">
                {school.phone && (
                  <a href={`tel:${school.phone.replace(/\s+/g, '')}`}>{school.phone}</a>
                )}
                {school.email && (
                  <a href={`mailto:${school.email}`} className="break-all text-primary underline">
                    {school.email}
                  </a>
                )}
              </p>
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 font-extrabold text-primary"
                >
                  <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
