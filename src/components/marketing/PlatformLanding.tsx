import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CreditCard,
  Heart,
  Landmark,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { RainbowText } from '@/components/ui/RainbowText'
import { Mascot, Star, WaveEdge } from './Mascot'

// Creche Wise platform landing page (the bare apex, no crèche resolved). Ported from
// the approved homepage mock-up. Figures inside the product previews are
// illustrative sample data, not real crèche data.

const DEMO_MAILTO =
  'mailto:info@crechewise.com?subject=' + encodeURIComponent('Book a Creche Wise demo')

function Tick({ className = 'text-primary' }: { className?: string }) {
  return (
    <Check
      className={`mt-0.5 h-[18px] w-[18px] flex-none ${className}`}
      strokeWidth={3}
      aria-hidden="true"
    />
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-extrabold uppercase tracking-[0.06em] text-secondary">
      {children}
    </span>
  )
}

const trustItems: { icon: LucideIcon; title: string; body: string; tint: string }[] = [
  {
    icon: Landmark,
    title: 'Built for Irish crèches',
    body: 'ECCE & NCS subvention worked out for you',
    tint: 'bg-primary-light text-primary',
  },
  {
    icon: ShieldCheck,
    title: 'Child data kept safe',
    body: 'Encrypted PPSNs, each crèche walled off',
    tint: 'bg-[#eeeafe] text-[#5b46d6]',
  },
  {
    icon: CreditCard,
    title: 'Paid straight to you',
    body: 'Parents pay into your own Stripe or Revolut',
    tint: 'bg-[#fff4d1] text-[#7a5600]',
  },
  {
    icon: Heart,
    title: 'A portal parents love',
    body: 'Fees, daily records & messages in one place',
    tint: 'bg-[#ffe6e1] text-[#c2412d]',
  },
]

const featureGroups: {
  icon: LucideIcon
  title: string
  items: string[]
  card: string
  chip: string
  tick: string
}[] = [
  {
    icon: CreditCard,
    title: 'Fees & money',
    items: [
      'Invoices with ECCE & NCS netted off',
      'Online payments & instalments',
      'Fees due, arrears & reminders',
      'Late-collection fees',
    ],
    card: 'border-[#f5c84c]',
    chip: 'bg-accent-sunny text-text-primary',
    tick: 'text-[#7a5600]',
  },
  {
    icon: Heart,
    title: 'Children & care',
    items: [
      'Daily check-in & check-out',
      'Sleep, meals, nappies & incidents',
      'Learning journals & reports',
      'Places, vacancies & waiting list',
    ],
    card: 'border-[#f48fb1]',
    chip: 'bg-accent-coral text-white',
    tick: 'text-[#c2412d]',
  },
  {
    icon: Users,
    title: 'Staff & ratios',
    items: [
      'Live room ratios & cover alerts',
      'Rota, timesheets & reports',
      'Garda vetting & training reminders',
      'Time off requests & approvals',
    ],
    card: 'border-[#b39ddb]',
    chip: 'bg-accent-grape text-white',
    tick: 'text-[#5b46d6]',
  },
  {
    icon: MessageSquare,
    title: 'Parents & messages',
    items: [
      'Parent portal with invite links',
      'Branded emails from your crèche',
      'Permission slips & collectors',
      'Enquiries & waiting list',
    ],
    card: 'border-[#90caf9]',
    chip: 'bg-accent-sky text-white',
    tick: 'text-[#1a6fb5]',
  },
]

const pricingIncludes = [
  'Every feature included',
  'ECCE & NCS built in',
  'Parent portal & branded emails',
  'Payments into your own account',
  'Import from your spreadsheets',
  'Any device, nothing to install',
]

function TourList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-2 font-bold">
      {items.map((i) => (
        <li key={i} className="flex gap-2.5">
          <Tick />
          {i}
        </li>
      ))}
    </ul>
  )
}

export function PlatformLanding({ monthlyPrice }: { monthlyPrice: string }) {
  return (
    <div className="bg-background text-text-primary">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-light">
        {/* Soft pastel blobs + stars, as in the brand reference */}
        <div
          aria-hidden="true"
          className="absolute -left-28 bottom-16 h-72 w-72 rounded-full bg-secondary-light"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#fff1c2]"
        />
        <Star size={34} color="#FFC93C" className="absolute left-[46%] top-12 hidden md:block" />
        <Star size={22} color="#EC4F8B" className="absolute right-[5%] top-36" />
        <Star size={18} color="#8B5CF6" className="absolute bottom-36 left-[4%]" />
        <div className="relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-4 pb-[120px] pt-12 sm:px-8 md:pt-16">
          <div className="min-w-0 flex-[1_1_460px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-extrabold text-primary">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              Crèche management for Ireland
            </span>
            <h1 className="mt-5 text-[clamp(40px,5.4vw,66px)] font-bold leading-[1.05]">
              Crèche admin, made <span className="text-primary">simple</span>,{' '}
              <span className="text-secondary">secure</span> &amp; <RainbowText text="joyful." />
            </h1>
            <p className="mt-5 max-w-[540px] text-[19px] text-text-secondary">
              Fees with ECCE &amp; NCS worked out, daily check-in and ratios, staff rotas and a
              parent portal — one calm place to run your crèche.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/get-started"
                className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-primary px-6 py-3.5 text-[17px] font-extrabold text-white transition-colors hover:bg-primary-hover"
              >
                Start your free month
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <a
                href="#demo"
                className="inline-flex min-h-[52px] items-center rounded-full border-2 border-primary/25 bg-white px-6 py-3.5 text-[17px] font-extrabold text-text-primary transition-colors hover:border-primary"
              >
                Book a demo
              </a>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-bold text-text-secondary">
              {['First month free', 'Unlimited children & rooms', 'Works on any device'].map(
                (t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" strokeWidth={3} aria-hidden="true" />
                    {t}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Product preview (illustrative sample data) */}
          <div className="relative min-w-0 flex-[1_1_460px] px-3 pb-10 pt-7">
            <div
              className="overflow-hidden rounded-[22px] bg-white shadow-[0_30px_70px_rgba(30,42,58,0.16)]"
              role="img"
              aria-label="Example of the Creche Wise admin dashboard"
            >
              <div className="flex items-center gap-2 border-b border-[#efe6d3] bg-[#f7f3ea] px-4 py-3">
                <span className="h-[11px] w-[11px] rounded-full bg-[#e8604c]" />
                <span className="h-[11px] w-[11px] rounded-full bg-accent-sunny" />
                <span className="h-[11px] w-[11px] rounded-full bg-accent-leaf" />
                <span className="ml-2.5 rounded-full bg-white px-3.5 py-0.5 text-xs font-bold text-text-secondary">
                  crechewise.com/admin
                </span>
              </div>
              <div className="p-5" aria-hidden="true">
                <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                  <p className="font-display text-[21px] font-semibold">
                    Good morning, Little Meadows
                  </p>
                  <span className="text-[13px] font-bold text-text-secondary">Thu 9 Oct</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                    ['Children in today', '38 / 42', 'bg-primary-light', 'text-primary'],
                    ['Rooms in ratio', '4 of 4', 'bg-[#eeeafe]', 'text-[#5b46d6]'],
                    ['Fees this week', '€2,140', 'bg-[#fff4d1]', 'text-[#7a5600]'],
                  ].map(([label, value, bg, fg]) => (
                    <div key={label} className={`rounded-2xl p-2.5 sm:p-3.5 ${bg}`}>
                      <div className="text-xs font-bold text-text-secondary">{label}</div>
                      <div className={`font-display text-xl font-bold sm:text-[26px] ${fg}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[13px] font-extrabold text-text-secondary">
                  Today&apos;s arrivals
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {[
                    ['EB', 'Emma Byrne', 'Toddlers', '08:42', 'bg-[#ffe6e1] text-[#c2412d]'],
                    ['JM', 'Jack Murphy', 'Wobblers', '08:51', 'bg-[#e1f1fd] text-[#1a6fb5]'],
                    ['AK', 'Aoife Kelly', 'Preschool', '09:05', 'bg-[#eeeafe] text-[#5b46d6]'],
                  ].map(([initials, name, room, time, tint]) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-[14px] bg-[#fbf8f1] px-3 py-2.5"
                    >
                      <span
                        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-extrabold ${tint}`}
                      >
                        {initials}
                      </span>
                      <span className="flex-1 text-sm font-bold">
                        {name} <span className="font-semibold text-text-secondary">· {room}</span>
                      </span>
                      <span className="text-[13px] font-extrabold text-primary">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_14px_34px_rgba(30,42,58,0.16)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcf3e6]">
                <Check className="h-[18px] w-[18px] text-[#1b7a45]" strokeWidth={3} />
              </span>
              <span className="text-[13px] leading-tight">
                <strong className="block">Payment received</strong>
                <span className="font-bold text-text-secondary">€200.00 · Emma Byrne</span>
              </span>
            </div>
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_14px_34px_rgba(30,42,58,0.16)]"
            >
              <span className="text-[13px] leading-tight">
                <strong className="block">Toddlers Room</strong>
                <span className="font-bold text-text-secondary">2 staff · 9 children</span>
              </span>
              <span className="rounded-full bg-[#eeeafe] px-2.5 py-1 text-xs font-extrabold text-[#5b46d6]">
                1:5 · In ratio
              </span>
            </div>
            <Mascot size={104} className="absolute -bottom-4 -right-2" />
          </div>
        </div>
        <WaveEdge fill="#fff8ec" />
      </section>

      {/* Trust strip */}
      <section
        aria-label="Why crèches choose Creche Wise"
        className="relative mx-auto -mt-10 max-w-[1200px] px-4 sm:px-8"
      >
        <div className="grid gap-5 rounded-[26px] bg-white p-6 shadow-[0_18px_46px_rgba(30,42,58,0.09)] sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(({ icon: Icon, title, body, tint }) => (
            <div key={title} className="flex items-start gap-3.5">
              <span
                className={`flex h-[50px] w-[50px] flex-none items-center justify-center rounded-2xl ${tint}`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <div className="font-extrabold">{title}</div>
                <div className="text-sm text-text-secondary">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1200px] px-4 pb-10 pt-24 sm:px-8">
        <div className="mx-auto max-w-[720px] text-center">
          <Eyebrow>Everything in one place</Eyebrow>
          <h2 className="mt-2 text-[clamp(32px,3.6vw,46px)] font-bold leading-[1.1]">
            Everything your crèche runs on, <span className="text-primary">finally together</span>
          </h2>
          <p className="mt-3.5 text-lg text-text-secondary">
            Four areas, one login — so the money, the children, the team and the parents never live
            in separate spreadsheets again.
          </p>
        </div>
        <div className="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featureGroups.map(({ icon: Icon, title, items, card, chip, tick }) => (
            <div
              key={title}
              className={`flex flex-col gap-4 rounded-[26px] border-2 border-dashed bg-white p-7 shadow-[0_10px_30px_rgba(31,43,87,0.06)] ${card}`}
            >
              <span
                className={`flex h-[54px] w-[54px] items-center justify-center rounded-[18px] ${chip}`}
              >
                <Icon className="h-[26px] w-[26px]" aria-hidden="true" />
              </span>
              <h3 className="text-[25px] font-semibold">{title}</h3>
              <ul className="flex flex-col gap-2.5 text-[15px]">
                {items.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <Tick className={tick} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Product tour (illustrative sample data in the previews) */}
      <section id="tour" className="pb-6 pt-14">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-[72px] px-4 sm:px-8">
          {/* Fees */}
          <div className="flex flex-wrap items-center gap-12">
            <div className="min-w-0 flex-[1_1_400px]">
              <span className="inline-block rounded-full bg-[#fff4d1] px-3.5 py-1 text-[13px] font-extrabold text-[#5b4300]">
                Fees &amp; subvention
              </span>
              <h2 className="mt-3.5 text-[clamp(28px,3vw,38px)] font-bold leading-[1.15]">
                Invoices that already know about ECCE &amp; NCS
              </h2>
              <p className="mt-3.5 text-[17px] text-text-secondary">
                Set each child&apos;s fee schedule once. Creche Wise nets ECCE and NCS off every
                invoice, so parents only see what they owe — and you can see what Pobal owes you.
              </p>
              <TourList
                items={[
                  "A term's invoices in one click",
                  'Parents pay online into your account',
                  'Arrears and reminders handled for you',
                ]}
              />
            </div>
            <div
              className="min-w-0 flex-[1_1_420px] rounded-[30px] bg-[#fff4d1] p-5 sm:p-11"
              aria-hidden="true"
            >
              <div className="rounded-[20px] bg-white p-6 shadow-[0_16px_40px_rgba(30,42,58,0.1)]">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-[0.05em] text-text-secondary">
                      Invoice
                    </div>
                    <div className="font-extrabold">INV-2026-000123</div>
                  </div>
                  <span className="self-start rounded-full bg-[#fff4d1] px-3 py-1 text-xs font-extrabold text-[#5b4300]">
                    Due 21 Oct
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-bold text-text-secondary">
                  Emma Byrne · Weekly full day
                </div>
                <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
                  <div className="flex justify-between">
                    <span>Gross fee</span>
                    <span className="font-bold">€240.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NCS subsidy</span>
                    <span className="font-extrabold text-[#1b7a45]">−€40.00</span>
                  </div>
                  <div className="h-px bg-[#efe6d3]" />
                  <div className="flex items-baseline justify-between">
                    <span className="font-extrabold">Parent pays</span>
                    <span className="font-display text-[28px] font-bold">€200.00</span>
                  </div>
                </div>
                <div className="mt-4 flex min-h-[48px] items-center justify-center rounded-[14px] bg-primary font-extrabold text-white">
                  Pay now
                </div>
              </div>
            </div>
          </div>

          {/* Ratios */}
          <div className="flex flex-wrap-reverse items-center gap-12">
            <div
              className="min-w-0 flex-[1_1_420px] rounded-[30px] bg-[#eeeafe] p-5 sm:p-11"
              aria-hidden="true"
            >
              <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-5 shadow-[0_16px_40px_rgba(30,42,58,0.1)]">
                <div className="text-[15px] font-extrabold">Rooms right now</div>
                {[
                  ['Wobblers', '1–2 yrs', '1:3 · In ratio', false],
                  ['Toddlers', '2–3 yrs', '1:5 · In ratio', false],
                  ['Preschool', '3–5 yrs', '1:8 · In ratio', false],
                  ['School-Age', '5+ yrs', 'Needs 1 more staff', true],
                ].map(([room, ages, status, alert]) => (
                  <div
                    key={room as string}
                    className={`flex flex-wrap items-center gap-2.5 rounded-[14px] px-3.5 py-3 ${alert ? 'border border-[#f6c2b8] bg-[#fff1ee]' : 'bg-[#fbf8f1]'}`}
                  >
                    <span className="flex-1 font-bold">
                      {room} <span className="font-semibold text-text-secondary">({ages})</span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${alert ? 'bg-[#ffe6e1] text-[#9e2f1e]' : 'bg-[#dcf3e6] text-[#1b6e40]'}`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-[1_1_400px]">
              <span className="inline-block rounded-full bg-[#eeeafe] px-3.5 py-1 text-[13px] font-extrabold text-[#4532b8]">
                Attendance &amp; ratios
              </span>
              <h2 className="mt-3.5 text-[clamp(28px,3vw,38px)] font-bold leading-[1.15]">
                Know every room is in ratio — before an inspector asks
              </h2>
              <p className="mt-3.5 text-[17px] text-text-secondary">
                As children check in, Creche Wise compares each room&apos;s ages against your ratios
                and the staff on duty, and flags a room on the dashboard the moment it slips.
              </p>
              <TourList
                items={[
                  'Check-in and check-out times on record',
                  'Ratios you can set per age band',
                  'Day, week and month reports to export',
                ]}
              />
            </div>
          </div>

          {/* Parent portal */}
          <div className="flex flex-wrap items-center gap-12">
            <div className="min-w-0 flex-[1_1_400px]">
              <span className="inline-block rounded-full bg-[#e1f1fd] px-3.5 py-1 text-[13px] font-extrabold text-[#135c96]">
                Parent portal
              </span>
              <h2 className="mt-3.5 text-[clamp(28px,3vw,38px)] font-bold leading-[1.15]">
                Give parents their own portal — not another group chat
              </h2>
              <p className="mt-3.5 text-[17px] text-text-secondary">
                Send a one-time invite link. Parents see their child&apos;s day, pay fees, sign
                permission slips and get messages from you — on any phone, tablet or computer.
              </p>
              <TourList
                items={[
                  'Daily records and learning journals',
                  'Fees, invoices and "Pay now"',
                  "Emails branded with your crèche's name",
                ]}
              />
            </div>
            <div
              className="flex min-w-0 flex-[1_1_420px] justify-center rounded-[30px] bg-[#e1f1fd] p-5 sm:p-11"
              aria-hidden="true"
            >
              <div className="w-[270px] max-w-full rounded-[40px] bg-text-primary p-3 shadow-[0_24px_50px_rgba(30,42,58,0.25)]">
                <div className="overflow-hidden rounded-[30px] bg-[#fff9ef]">
                  <div className="bg-[#573c9b] px-[18px] pb-[18px] pt-[22px] text-white">
                    <div className="font-display text-lg font-bold">Little Meadows Crèche</div>
                    <div className="text-[13px] text-[#e4dcf7]">Good morning, Sarah</div>
                  </div>
                  <div className="flex flex-col gap-2.5 p-3.5 text-[13px]">
                    <div className="text-xs font-extrabold uppercase tracking-[0.05em] text-text-secondary">
                      Emma&apos;s day
                    </div>
                    {[
                      ['Nap', '12:30 – 13:50'],
                      ['Lunch', 'Ate it all'],
                      ['Art & craft', '2 photos'],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between rounded-[14px] bg-white px-3 py-2.5"
                      >
                        <span className="font-bold">{k}</span>
                        <span className="font-bold text-text-secondary">{v}</span>
                      </div>
                    ))}
                    <div className="rounded-[14px] bg-[#fff4d1] p-3">
                      <div className="font-extrabold">Fees due · €200.00</div>
                      <div className="mt-2 rounded-[10px] bg-[#573c9b] p-2 text-center font-extrabold text-white">
                        Pay now
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-[1200px] px-4 pb-10 pt-24 sm:px-8">
        <div className="mx-auto max-w-[680px] text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-2 text-[clamp(32px,3.6vw,46px)] font-bold leading-[1.1]">
            One simple price. <span className="text-primary">Everything included.</span>
          </h2>
        </div>
        <div className="mx-auto mt-10 max-w-[560px] overflow-hidden rounded-[30px] bg-white shadow-[0_24px_60px_rgba(30,42,58,0.12)]">
          <div className="bg-accent-sunny p-3 text-center font-extrabold">
            Your first month is free
          </div>
          <div className="px-5 py-9 text-center sm:px-11">
            <div className="flex flex-wrap items-baseline justify-center gap-1.5">
              <span className="font-display text-[72px] font-bold leading-none">
                {monthlyPrice}
              </span>
              <span className="text-lg font-bold text-text-secondary">/ month per crèche</span>
            </div>
            <p className="mt-2.5 font-bold text-text-secondary">
              Unlimited children · Unlimited rooms
            </p>
            <ul className="mt-6 grid gap-3 text-left text-[15px] sm:grid-cols-2">
              {pricingIncludes.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <Tick />
                  {i}
                </li>
              ))}
            </ul>
            <Link
              href="/get-started"
              className="mt-8 flex min-h-[54px] w-full items-center justify-center rounded-full bg-primary text-[17px] font-extrabold text-white transition-colors hover:bg-primary-hover"
            >
              Start your free month
            </Link>
            <p className="mt-3.5 text-sm text-text-secondary">
              Running more than one crèche? Each one gets its own portal at {monthlyPrice} a month.{' '}
              <Link href="/pricing" className="font-bold text-primary underline">
                Full pricing
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Testimonial — placeholder until a crèche manager approves a quote. Hidden
          from the live page so a "[quote]" placeholder never ships to visitors. */}

      {/* Book a demo */}
      <section id="demo" className="mx-auto max-w-[1200px] px-4 pb-24 pt-14 sm:px-8">
        <div className="flex flex-wrap items-center gap-12">
          <div className="min-w-0 flex-[1_1_400px]">
            <Eyebrow>See it for yourself</Eyebrow>
            <h2 className="mt-2 text-[clamp(32px,3.6vw,46px)] font-bold leading-[1.1]">
              See Creche Wise with your own crèche in it
            </h2>
            <ol className="mt-6 flex flex-col gap-4">
              {[
                [
                  '1',
                  'Book a short call at a time that suits you',
                  'bg-accent-sunny text-text-primary',
                ],
                ['2', 'We set up your portal and import your children', 'bg-[#e8604c] text-white'],
                ['3', 'Use everything free for your first month', 'bg-[#6e5ae6] text-white'],
              ].map(([n, text, tint]) => (
                <li key={n} className="flex items-start gap-3.5">
                  <span
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-full font-display text-lg font-bold ${tint}`}
                  >
                    {n}
                  </span>
                  <span className="pt-[7px] font-bold">{text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-[30px] bg-accent-sunny p-6 sm:p-10">
            <h3 className="text-[28px] font-bold">Book a free demo</h3>
            <p className="font-semibold">
              Email us with your crèche&apos;s name and a good time to call, and we&apos;ll set up a
              short walkthrough — usually within one working day.
            </p>
            <a
              href={DEMO_MAILTO}
              className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-text-primary px-6 text-[17px] font-extrabold text-white transition-transform hover:-translate-y-0.5"
            >
              <Mail className="h-5 w-5" aria-hidden="true" />
              Email info@crechewise.com
            </a>
            <Link
              href="/get-started"
              className="text-center font-extrabold text-text-primary underline underline-offset-4"
            >
              Or start your free month now
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 px-4 py-16 sm:px-8">
          <div className="flex min-w-0 flex-[1_1_520px] flex-wrap items-center gap-6">
            <Mascot size={96} className="flex-none" />
            <div className="min-w-0 flex-[1_1_300px]">
              <h2 className="text-[clamp(28px,3vw,40px)] font-bold leading-[1.15] text-white">
                Ready to give your crèche its calm back?
              </h2>
              <p className="mt-2 text-[17px] text-white/85">
                Set up your crèche&apos;s portal today. Your first month is on us.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/get-started"
              className="inline-flex min-h-[52px] items-center rounded-full bg-accent-sunny px-6 text-[17px] font-extrabold text-text-primary"
            >
              Start free month
            </Link>
            <a
              href="#demo"
              className="inline-flex min-h-[52px] items-center rounded-full border-2 border-white px-6 text-[17px] font-extrabold text-white"
            >
              Book a demo
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
