import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Users,
  Calendar,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Plus,
  Repeat,
  ShoppingBag,
  ShieldAlert,
  Award,
  CalendarOff,
  Scale,
  Timer,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { getSchoolSubscription, hasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { collectedByDay, ordersByStatus } from '@/lib/charts/aggregate'
import { getVettingOverview } from '@/lib/vetting/queries'
import { getCertifications } from '@/lib/certifications/queries'
import { getUpcomingTimeOffClashes } from '@/lib/timeoff/clash-queries'
import { getRoomRatioAlerts } from '@/lib/ratios/alerts'

export const metadata: Metadata = { title: 'Admin Dashboard' }

export default async function AdminDashboardPage() {
  const admin = await requireAdmin()
  // The platform owner doesn't manage a single school — send them to the
  // platform console instead of the crèche-principal dashboard. Other /admin
  // pages stay reachable by URL (this only redirects the dashboard).
  if (isPlatformOwner(admin)) redirect('/platform')
  const adminClient = createSupabaseAdminClient()

  const firstName = admin.profile?.firstName || admin.email.split('@')[0] || 'there'

  // Subscription banner state (trialing → trial banner, free → upgrade, active → none).
  const sub = await getSchoolSubscription(admin.schoolId!)
  const isTrialing = sub?.status === 'trialing'
  const isPro = hasProAccess(sub)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - 6)

  const [
    studentsResult,
    activitiesResult,
    programmesResult,
    paymentsResult,
    ordersResult,
    reconciliationResult,
    weekOrdersResult,
    statusOrdersResult,
  ] = await Promise.all([
    adminClient
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', admin.schoolId!),
    adminClient
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', admin.schoolId!)
      .eq('publication_status', 'published'),
    adminClient
      .from('programmes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', admin.schoolId!)
      .eq('publication_status', 'published')
      .eq('is_active', true),
    adminClient
      .from('orders')
      .select('total_cents')
      .eq('school_id', admin.schoolId!)
      .in('status', ['paid', 'partially_refunded', 'fully_refunded'])
      .gte('created_at', monthStart.toISOString()),
    adminClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', admin.schoolId!)
      .in('status', ['paid', 'partially_refunded', 'fully_refunded'])
      .gte('created_at', monthStart.toISOString()),
    // Scope via the parent order — order_items has no school_id of its own.
    // Without this the count leaks other schools' pending items onto this
    // dashboard (the /admin/reconciliation list already scopes correctly).
    adminClient
      .from('order_items')
      .select('id, orders!inner(school_id)', { count: 'exact', head: true })
      .eq('orders.school_id', admin.schoolId!)
      .eq('verification_status', 'manual_review'),
    adminClient
      .from('orders')
      .select('total_cents, created_at')
      .eq('school_id', admin.schoolId!)
      .in('status', ['paid', 'partially_refunded', 'fully_refunded'])
      .gte('created_at', weekStart.toISOString()),
    adminClient.from('orders').select('status').eq('school_id', admin.schoolId!).limit(1000),
  ])

  const studentCount = studentsResult.count ?? 0
  const activityCount = activitiesResult.count ?? 0
  const programmeCount = programmesResult.count ?? 0
  const paymentsThisMonth = (
    (paymentsResult.data as { total_cents: number }[] | null) ?? []
  ).reduce((s, o) => s + o.total_cents, 0)
  const ordersThisMonth = ordersResult.count ?? 0
  const pendingReconciliation = reconciliationResult.count ?? 0

  const collectedChart = collectedByDay(
    (weekOrdersResult.data as { total_cents: number; created_at: string }[] | null) ?? [],
  )
  const statusChart = ordersByStatus((statusOrdersResult.data as { status: string }[] | null) ?? [])

  // Row 1: what's available — Students, Activities, Programmes
  // Row 2: financial health — Collected, Orders, Pending Review
  const stats = [
    {
      label: 'Total Children',
      value: studentCount.toString(),
      href: '/admin/students',
      icon: Users,
      glow: 'card-glow-green',
      cta: 'View children',
    },
    {
      label: 'Live Activities',
      value: activityCount.toString(),
      href: '/admin/activities',
      icon: Calendar,
      glow: 'card-glow-teal',
      cta: 'View activities',
    },
    {
      label: 'Live Programmes',
      value: programmeCount.toString(),
      href: '/admin/programmes',
      icon: Repeat,
      glow: 'card-glow-blue',
      cta: 'View programmes',
    },
    {
      label: 'Collected This Month',
      value: formatCurrency(paymentsThisMonth),
      href: '/admin/reports',
      icon: CreditCard,
      glow: 'card-glow-amber',
      cta: 'View reports',
    },
    {
      label: 'Orders This Month',
      value: ordersThisMonth.toString(),
      href: '/admin/orders',
      icon: ShoppingBag,
      glow: 'card-glow-green',
      cta: 'View orders',
    },
    {
      label: 'Pending Review',
      value: pendingReconciliation.toString(),
      href: '/admin/reconciliation',
      icon: AlertCircle,
      glow: pendingReconciliation > 0 ? 'card-glow-amber' : 'card-glow-teal',
      cta: pendingReconciliation > 0 ? 'Resolve now' : 'All clear',
    },
  ]

  const quickLinks = [
    { href: '/admin/students/new', label: 'Add Child' },
    { href: '/admin/payment-links/new', label: 'Create Payment Link' },
    { href: '/admin/teachers/new', label: 'Add Staff' },
  ]

  // Garda vetting renewal reminder: staff whose vetting has expired or is due within 60 days.
  // (Tolerant of the garda_vetting table being absent — then no rows qualify and no banner shows.)
  const vettingToday = new Date().toISOString().slice(0, 10)
  const vettingOverview = await getVettingOverview(admin.schoolId!, vettingToday)
  const vettingRenewals = vettingOverview.rows
    .filter((r) => r.status === 'expired' || r.status === 'expiring')
    .sort((a, b) => (a.status === 'expired' ? 0 : 1) - (b.status === 'expired' ? 0 : 1))
  const vettingExpired = vettingRenewals.filter((r) => r.status === 'expired').length
  const vettingExpiring = vettingRenewals.length - vettingExpired
  const vettingParts: string[] = []
  if (vettingExpired > 0) vettingParts.push(`${vettingExpired} expired`)
  if (vettingExpiring > 0) vettingParts.push(`${vettingExpiring} due for renewal within 60 days`)
  const vettingNames = vettingRenewals.slice(0, 3).map((r) => r.name)
  const vettingMore = vettingRenewals.length - vettingNames.length
  const vettingAlertText =
    `${vettingParts.join(', ')} — ${vettingNames.join(', ')}` +
    (vettingMore > 0 ? ` +${vettingMore} more` : '') +
    '.'

  // Qualification/training renewal reminder: certifications expired or due within 60 days.
  // (Tolerant of staff_certifications being absent — then no rows qualify and no banner shows.)
  const certs = await getCertifications(admin.schoolId!, vettingToday)
  const certRenewals = certs.rows
    .filter((r) => r.status === 'expired' || r.status === 'expiring')
    .sort((a, b) => (a.status === 'expired' ? 0 : 1) - (b.status === 'expired' ? 0 : 1))
  const certExpired = certRenewals.filter((r) => r.status === 'expired').length
  const certExpiring = certRenewals.length - certExpired
  const certParts: string[] = []
  if (certExpired > 0) certParts.push(`${certExpired} expired`)
  if (certExpiring > 0) certParts.push(`${certExpiring} expiring within 60 days`)
  const certLabels = certRenewals.slice(0, 3).map((r) => `${r.teacherName} (${r.name})`)
  const certMore = certRenewals.length - certLabels.length
  const certAlertText =
    `${certParts.join(', ')} — ${certLabels.join(', ')}` +
    (certMore > 0 ? ` +${certMore} more` : '') +
    '.'

  // Time-off clash: upcoming days where 2+ staff are on approved leave (shortage risk).
  const clashDays = await getUpcomingTimeOffClashes(admin.schoolId!, vettingToday)
  const clashLabels = clashDays
    .slice(0, 3)
    .map((d) => `${formatDate(d.date)} (${d.names.join(', ')})`)
  const clashMore = clashDays.length - clashLabels.length
  const clashAlertText = `${clashLabels.join(', ')}${clashMore > 0 ? ` +${clashMore} more` : ''}.`

  // Room ratio alert: rooms under their required ratio right now (present children at the
  // configured ratios vs staff on duty — saved for today, else rostered from the rota).
  const ratio = await getRoomRatioAlerts(admin.schoolId!, vettingToday)
  const ratioLabels = ratio.alerts
    .slice(0, 3)
    .map(
      (a) =>
        `${a.roomName} (${a.available} of ${a.required}${a.source === 'rostered' ? ', rostered' : ''})`,
    )
  const ratioMore = ratio.alerts.length - ratioLabels.length
  const ratioAlertText = `${ratioLabels.join(', ')}${ratioMore > 0 ? ` +${ratioMore} more` : ''}.`

  // Late collections recorded today (tolerant of the table being absent pre-migration).
  let lateToday = 0
  let lateFeesTodayCents = 0
  {
    const { data: lcData } = await adminClient
      .from('late_collections')
      .select('fee_cents, collected_at')
      .eq('school_id', admin.schoolId!)
      .gte('collected_at', `${vettingToday}T00:00:00.000Z`)
      .lte('collected_at', `${vettingToday}T23:59:59.999Z`)
    const lc = (lcData ?? []) as { fee_cents: number }[]
    lateToday = lc.length
    lateFeesTodayCents = lc.reduce((n, r) => n + (r.fee_cents ?? 0), 0)
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Good {getTimeOfDay()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Here&apos;s what&apos;s happening at {admin.schoolName ?? 'your crèche'} today.
        </p>
      </div>

      {/* Subscription banner: trialing → trial notice; free → upgrade CTA; active Pro → none. */}
      {isTrialing ? (
        <Link
          href="/admin/subscription"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-blue-300/40 bg-blue-50/60 px-5 py-4 transition-all hover:border-blue-400/60"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">
              You&apos;re on a Pro free trial
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {sub?.trial_ends_at
                ? `Your trial ends on ${formatDate(sub.trial_ends_at)}. You won't be charged until then.`
                : 'Enjoy full Pro access during your trial.'}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Manage
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      ) : !isPro ? (
        <Link
          href="/pricing"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 transition-all hover:border-primary/50 hover:bg-primary/10"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">Upgrade to Pro</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Unlock payment links, instalments, CSV import and advanced reports — start a free
              trial.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            View plans
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      ) : null}

      {/* Garda vetting renewal reminder — staff whose vetting is expired or due within 60 days. */}
      {vettingRenewals.length > 0 && (
        <Link
          href="/admin/vetting"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-warning/40 bg-warning-light px-5 py-4 transition-all hover:border-warning/60"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Garda vetting due for renewal
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{vettingAlertText}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Review
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Qualification/training renewal reminder — certs expired or due within 60 days. */}
      {certRenewals.length > 0 && (
        <Link
          href="/admin/certifications"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-warning/40 bg-warning-light px-5 py-4 transition-all hover:border-warning/60"
        >
          <div className="flex items-start gap-3">
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Qualifications &amp; training due for renewal
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{certAlertText}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Review
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Room ratio alert — rooms under the required adult:child ratio right now. */}
      {ratio.alerts.length > 0 && (
        <Link
          href="/admin/ratios"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-error/40 bg-error-light px-5 py-4 transition-all hover:border-error/60"
        >
          <div className="flex items-start gap-3">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {ratio.alerts.length} room{ratio.alerts.length === 1 ? '' : 's'} under the required
                ratio
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{ratioAlertText}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Review
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Time-off clash — upcoming days where 2+ staff are on approved leave. */}
      {clashDays.length > 0 && (
        <Link
          href="/admin/time-off"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-warning/40 bg-warning-light px-5 py-4 transition-all hover:border-warning/60"
        >
          <div className="flex items-start gap-3">
            <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {clashDays.length} day{clashDays.length === 1 ? '' : 's'} with a staff time-off
                clash (next 30 days)
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                2+ staff off at once — possible shortage. {clashAlertText}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Review
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Late collections today — children collected after the cutoff. */}
      {lateToday > 0 && (
        <Link
          href="/admin/late-collection"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-warning/40 bg-warning-light px-5 py-4 transition-all hover:border-warning/60"
        >
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {lateToday} late collection{lateToday === 1 ? '' : 's'} today
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {formatCurrency(lateFeesTodayCents)} in late fees recorded today.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            Review
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Stat cards — 2 rows of 3: row 1 = availability, row 2 = financials */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, href, icon: Icon, glow, cta }) => (
          <Link
            key={label}
            href={href}
            className={`${glow} group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
          >
            {/* Shimmer sweep */}
            <div
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
              aria-hidden="true"
            />

            {/* Icon */}
            <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10 transition-all group-hover:bg-white group-hover:ring-primary/25">
              <Icon
                className="h-[18px] w-[18px] text-primary transition-colors"
                aria-hidden="true"
              />
            </div>

            {/* Value + label */}
            <p className="text-2xl font-bold tracking-tight text-text-primary transition-transform group-hover:-translate-y-0.5">
              {value}
            </p>
            <p className="mt-0.5 text-sm font-medium text-text-secondary transition-transform group-hover:-translate-y-0.5">
              {label}
            </p>

            {/* Hover-reveal button */}
            <div className="mt-4 overflow-hidden">
              <div className="flex translate-y-8 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20 backdrop-blur-sm">
                  {cta}
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics — collected-this-week bar + orders-by-status donut */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Collected this week"
          data={collectedChart}
          formatValue={formatCurrency}
          action={
            <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary">
              Last 7 days
            </span>
          }
        />
        <DonutChart title="Orders by status" data={statusChart} />
      </div>

      {/* Create Activity / Programme — primary CTAs */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Activities &amp; Programmes
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/activities/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Activity
          </Link>
          <Link
            href="/admin/activities"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:bg-surface-raised hover:text-primary"
          >
            View all activities
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/admin/programmes/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Programme
          </Link>
          <Link
            href="/admin/programmes"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:bg-surface-raised hover:text-primary"
          >
            View all programmes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:bg-surface-raised hover:text-primary"
            >
              {label}
              <ArrowRight
                className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </div>

      {/* Manage shortcuts */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Manage
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              href: '/admin/orders',
              label: 'Orders',
              desc: 'View all payment orders',
              cta: 'View orders',
            },
            {
              href: '/admin/reports',
              label: 'Reports',
              desc: 'Export financial reports',
              cta: 'View reports',
            },
            {
              href: '/admin/audit',
              label: 'Audit Log',
              desc: 'Review system activity',
              cta: 'View log',
            },
          ].map(({ href, label, desc, cta }) => (
            <Link
              key={href}
              href={href}
              className="card group relative overflow-hidden p-4 transition-all hover:border-primary/20 hover:bg-surface-raised"
            >
              {/* Shimmer sweep */}
              <div
                className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
                aria-hidden="true"
              />

              <p className="font-semibold text-text-primary transition-transform group-hover:-translate-y-0.5 group-hover:text-primary">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-text-muted transition-transform group-hover:-translate-y-0.5">
                {desc}
              </p>

              {/* Hover-reveal button */}
              <div className="mt-3 overflow-hidden">
                <div className="flex translate-y-6 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20">
                    {cta}
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
