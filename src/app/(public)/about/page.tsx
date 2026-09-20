import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Wallet, BarChart3 } from 'lucide-react'

export const metadata: Metadata = { title: 'About' }

// NOTE: starter content — edit the copy below to match your brand voice.
const highlights = [
  {
    icon: Wallet,
    title: 'Payments made simple',
    body: 'Parents pay for activities, trips and programmes online — card or wallet — with clear receipts. Guest payments need no account.',
  },
  {
    icon: BarChart3,
    title: 'Attendance & insight',
    body: 'Take attendance, track programmes, and see how your school is doing with built-in reporting — all in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & compliant',
    body: 'Each school gets its own private portal. Payment details are handled by regulated providers — we never store card numbers.',
  },
]

export default function AboutPage() {
  return (
    <>
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            About Crèche Management System
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Payments and admin, <span className="text-primary">built for schools</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Crèche Management System gives every school its own portal to collect payments, manage activities and
            programmes, take attendance, and message parents — without the paperwork.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
              <p className="mt-1.5 text-sm text-text-secondary">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
          <h2 className="text-lg font-semibold text-text-primary">Run a school?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            Set up your school&apos;s own portal in minutes.
          </p>
          <Link
            href="/get-started"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
          >
            Create your portal
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  )
}
