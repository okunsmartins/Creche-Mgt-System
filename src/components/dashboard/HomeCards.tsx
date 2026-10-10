import Link from 'next/link'
import { ArrowRight, LogIn, NotebookPen, type LucideIcon } from 'lucide-react'
import { Icon3D, type Icon3DName } from '@/components/ui/Icon3D'
import { Mascot } from '@/components/marketing/Mascot'
import { formatCurrency } from '@/lib/utils'
import type { MonthFeeSplit, SmartTip } from '@/lib/dashboard/home'
import type { RoomRatioStatus } from '@/lib/ratios/alerts'

// Presentational cards for the admin home dashboard (server components).

const chunky =
  'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function Card({
  title,
  icon3d,
  action,
  children,
  id,
  className = '',
}: {
  title: string
  icon3d?: Icon3DName
  action?: React.ReactNode
  children: React.ReactNode
  id?: string
  className?: string
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={`flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-5 shadow-card ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold text-text-primary">
          {icon3d && <Icon3D name={icon3d} size={32} />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f1eee6] px-3.5 py-1.5 text-[13px] font-extrabold text-text-primary hover:bg-primary-light hover:text-primary"
    >
      {children}
    </Link>
  )
}

export function GreetingBanner({
  firstName,
  dateLabel,
  summary,
}: {
  firstName: string
  dateLabel: string
  summary: string
}) {
  return (
    <section
      aria-label="Today"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#cfe6ff] via-[#e6f2ff] to-[#f3eeff] p-6 shadow-card sm:p-7"
    >
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#fff1c2]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 flex-[1_1_380px]">
          <p className="text-sm font-extrabold text-primary">{dateLabel}</p>
          <h1 className="mt-1 text-[clamp(26px,3vw,34px)] font-bold leading-tight text-text-primary">
            Good {timeOfDay()}, {firstName} 👋
          </h1>
          <p className="mt-1.5 text-[15px] font-semibold text-text-secondary">{summary}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/admin/check-in"
              className={`${chunky} bg-[#e5484d] shadow-[inset_0_-5px_0_#b3261e,0_6px_14px_rgba(229,72,77,0.25)]`}
            >
              <LogIn className="h-[18px] w-[18px]" aria-hidden="true" />
              Check a child in
            </Link>
            <Link
              href="/admin/daily-records"
              className={`${chunky} bg-primary shadow-[inset_0_-5px_0_#1b4fae,0_6px_14px_rgba(36,99,214,0.25)]`}
            >
              <NotebookPen className="h-[18px] w-[18px]" aria-hidden="true" />
              Record daily notes
            </Link>
          </div>
        </div>
        <Mascot size={120} className="hidden shrink-0 sm:block" />
      </div>
    </section>
  )
}

function timeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export type Tone = 'green' | 'purple' | 'yellow' | 'pink' | 'red'

const TONES: Record<Tone, { bg: string; chip: string; value: string }> = {
  green: { bg: 'bg-[#edf8ef]', chip: 'bg-[#2b8a3e]', value: 'text-[#1e6b2e]' },
  purple: { bg: 'bg-[#f3eeff]', chip: 'bg-[#7048e8]', value: 'text-[#5b37c8]' },
  yellow: { bg: 'bg-[#fff8dd]', chip: 'bg-[#b07200]', value: 'text-[#7a5000]' },
  pink: { bg: 'bg-[#ffeef5]', chip: 'bg-[#d6336c]', value: 'text-[#a61e4d]' },
  red: { bg: 'bg-error-light', chip: 'bg-error', value: 'text-error' },
}

export function StatTile({
  label,
  value,
  sub,
  subTone = 'muted',
  tone,
  icon3d,
  href,
}: {
  label: string
  value: string
  sub: string
  subTone?: 'muted' | 'good' | 'warn'
  tone: Tone
  icon3d: Icon3DName
  href: string
}) {
  const t = TONES[tone]
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-col gap-3 rounded-3xl p-5 shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${t.bg}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-text-primary">{label}</span>
        <Icon3D
          name={icon3d}
          size={52}
          className="-my-2 transition-transform group-hover:-rotate-6 group-hover:scale-110"
        />
      </div>
      <span className={`font-display text-[32px] font-bold leading-none ${t.value}`}>{value}</span>
      <span
        className={`text-[13px] font-bold ${
          subTone === 'good'
            ? 'text-success'
            : subTone === 'warn'
              ? 'text-warning'
              : 'text-text-secondary'
        }`}
      >
        {sub}
      </span>
    </Link>
  )
}

export interface AttentionItem {
  icon: LucideIcon
  title: string
  detail: string
  href: string
  cta: string
  tone: 'red' | 'amber'
}

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  return (
    <Card
      id="attention"
      icon3d="bell"
      title="Needs attention"
      action={
        <span
          className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-sm font-extrabold text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] ${items.length ? 'bg-accent-grape' : 'bg-[#2b8a3e]'}`}
          aria-label={`${items.length} item${items.length === 1 ? '' : 's'}`}
        >
          {items.length}
        </span>
      }
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-success-light p-4">
          <Icon3D name="party" size={44} />
          <span>
            <span className="block font-extrabold text-text-primary">All clear 🎉</span>
            <span className="text-sm text-text-secondary">Nothing needs your attention.</span>
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map(({ icon: Icon, title, detail, href, cta, tone }) => (
            <li key={title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${tone === 'red' ? 'bg-error' : 'bg-accent-orange'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-text-primary">{title}</span>
                <span className="block text-[13px] text-text-secondary">{detail}</span>
              </span>
              <Link
                href={href}
                className="shrink-0 pt-0.5 text-[13px] font-extrabold text-primary hover:underline"
              >
                {cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Dashed rainbow room cards (brand reference), cycling colours by display order.
const ROOM_TINTS = [
  { border: 'border-[#f48fb1]', bar: 'bg-[#ec4f8b]', track: 'bg-[#ffeef5]' },
  { border: 'border-[#f5c84c]', bar: 'bg-[#e8a800]', track: 'bg-[#fff8dd]' },
  { border: 'border-[#a5d6a7]', bar: 'bg-[#4caf50]', track: 'bg-[#edf8ef]' },
  { border: 'border-[#90caf9]', bar: 'bg-[#3a8ee6]', track: 'bg-[#eaf3fd]' },
  { border: 'border-[#b39ddb]', bar: 'bg-[#8b5cf6]', track: 'bg-[#f3eeff]' },
]

export function RoomsNowCard({
  rooms,
  capacityByRoom,
}: {
  rooms: RoomRatioStatus[]
  capacityByRoom: Map<string, number | null>
}) {
  return (
    <Card
      title="Rooms right now"
      icon3d="school"
      action={<PillLink href="/admin/ratios">Ratios ›</PillLink>}
    >
      {rooms.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Add your rooms to see live numbers and ratios here.{' '}
          <Link href="/admin/classes" className="font-bold text-primary underline">
            Add rooms
          </Link>
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rooms.map((r, i) => {
            const t = ROOM_TINTS[i % ROOM_TINTS.length]!
            const cap = capacityByRoom.get(r.roomId) ?? null
            const pct = cap ? Math.min(100, Math.round((r.childrenPresent / cap) * 100)) : null
            const short = r.required - r.available
            return (
              <li
                key={r.roomId}
                className={`flex flex-col gap-2 rounded-2xl border-2 border-dashed p-3.5 ${t.border} ${r.inRatio ? '' : 'bg-error-light'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-extrabold text-text-primary">{r.roomName}</span>
                  {r.inRatio ? (
                    <span className="shrink-0 text-[13px] font-extrabold text-success">
                      In ratio ✓
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] font-extrabold text-error">
                      Needs {short} more staff
                    </span>
                  )}
                </div>
                {pct !== null && (
                  <div
                    className={`h-2.5 overflow-hidden rounded-full ${t.track}`}
                    role="img"
                    aria-label={`${r.childrenPresent} of ${cap} places in use`}
                  >
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                <span className="text-[13px] font-semibold text-text-secondary">
                  {r.childrenPresent} in{cap ? ` of ${cap}` : ''} · {r.available} staff
                  {r.required > 0 ? ` (needs ${r.required})` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

const FEE_SLICES = [
  { key: 'paidCents', label: 'Paid', color: '#2b8a3e' },
  { key: 'upcomingCents', label: 'Not yet due', color: '#3a8ee6' },
  { key: 'overdueCents', label: 'Overdue', color: '#e8590c' },
] as const

export function FeesDonutCard({ split, monthLabel }: { split: MonthFeeSplit; monthLabel: string }) {
  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0
  const collectedPct = split.totalCents ? Math.round((split.paidCents / split.totalCents) * 100) : 0
  return (
    <Card
      icon3d="moneybag"
      title={`Fees for ${monthLabel}`}
      action={<PillLink href="/admin/fees/due">Fees due ›</PillLink>}
    >
      {split.totalCents === 0 ? (
        <p className="text-sm text-text-secondary">
          No invoices are due this month yet.{' '}
          <Link href="/admin/fees" className="font-bold text-primary underline">
            Create invoices
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="70" cy="70" r={R} fill="none" stroke="#f1eee6" strokeWidth="18" />
              {FEE_SLICES.map((s) => {
                const v = split[s.key]
                if (!v) return null
                const dash = (v / split.totalCents) * C
                const el = (
                  <circle
                    key={s.key}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-acc}
                  />
                )
                acc += dash
                return el
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold text-text-primary">
                {collectedPct}%
              </span>
              <span className="text-[11px] font-bold text-text-secondary">collected</span>
            </div>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
            {FEE_SLICES.map((s) => {
              const v = split[s.key]
              const pct = Math.round((v / split.totalCents) * 100)
              return (
                <li key={s.key} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-[4px]"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1 font-bold text-text-primary">{s.label}</span>
                  <span className="font-extrabold text-text-primary">{formatCurrency(v)}</span>
                  <span className="w-10 text-right text-text-secondary">{pct}%</span>
                </li>
              )
            })}
            <li className="flex items-center gap-2.5 border-t border-border pt-2.5 text-sm">
              <span className="flex-1 font-extrabold text-text-primary">Billed this month</span>
              <span className="font-extrabold text-text-primary">
                {formatCurrency(split.totalCents)}
              </span>
              <span className="w-10" />
            </li>
          </ul>
        </div>
      )}
    </Card>
  )
}

export interface Arrival {
  id: string
  name: string
  room: string | null
  time: string
  out: boolean
}

const AVATAR_TINTS = [
  'bg-[#ffeef5] text-[#a61e4d]',
  'bg-[#eaf3fd] text-[#1864ab]',
  'bg-[#f3eeff] text-[#5b37c8]',
  'bg-[#fff8dd] text-[#7a5000]',
  'bg-[#edf8ef] text-[#1e6b2e]',
]

export function ArrivalsCard({ arrivals }: { arrivals: Arrival[] }) {
  return (
    <Card
      title="Today's arrivals"
      icon3d="wave"
      action={<PillLink href="/admin/check-in">Check-in ›</PillLink>}
    >
      {arrivals.length === 0 ? (
        <p className="text-sm text-text-secondary">No children checked in yet today.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {arrivals.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-[#fbf8f1] px-3 py-2.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                aria-hidden="true"
              >
                {a.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">
                {a.name}
                {a.room && <span className="font-semibold text-text-secondary"> · {a.room}</span>}
              </span>
              <span
                className={`shrink-0 text-[13px] font-extrabold ${a.out ? 'text-text-secondary' : 'text-primary'}`}
              >
                {a.out ? 'Gone home' : a.time}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function SmartTipCard({ tip }: { tip: SmartTip }) {
  return (
    <section
      aria-label="Smart tip"
      className={`flex flex-wrap items-center gap-4 rounded-3xl p-5 shadow-card ${tip.allClear ? 'bg-success-light' : 'bg-gradient-to-br from-[#fff4c7] to-[#ffe9a8]'}`}
    >
      <Icon3D name={tip.allClear ? 'party' : 'bulb'} size={56} />
      <div className="min-w-0 flex-[1_1_280px]">
        <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-text-secondary">
          Smart tip
        </p>
        <p className="font-display text-lg font-bold text-text-primary">{tip.title}</p>
        <p className="text-sm font-semibold text-text-secondary">{tip.body}</p>
      </div>
      <Link href={tip.href} className={`${chunky} bg-secondary shadow-[inset_0_-4px_0_#a11f52]`}>
        {tip.cta}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
