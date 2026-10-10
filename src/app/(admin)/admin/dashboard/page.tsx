import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  CalendarOff,
  GitMerge,
  Receipt,
  Scale,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { getSchoolSubscription, hasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getVettingOverview } from '@/lib/vetting/queries'
import { getCertifications } from '@/lib/certifications/queries'
import { getUpcomingTimeOffClashes } from '@/lib/timeoff/clash-queries'
import { getRoomRatioAlerts } from '@/lib/ratios/alerts'
import { getPlacesOverview } from '@/lib/places/queries'
import { daysBetween, monthFeeSplit, pickSmartTip, sameDayLastWeek } from '@/lib/dashboard/home'
import {
  ArrivalsCard,
  AttentionCard,
  FeesDonutCard,
  GreetingBanner,
  RoomsNowCard,
  SmartTipCard,
  StatTile,
  type Arrival,
  type AttentionItem,
} from '@/components/dashboard/HomeCards'

export const metadata: Metadata = { title: 'Admin Dashboard' }

interface InvoiceRow {
  net_parent_cents: number
  amount_paid_cents: number
  due_date: string
  status: string
}
interface CheckInRow {
  id: string
  checked_in_at: string | null
  checked_out_at: string | null
  students: { first_name: string; last_name: string; classes: { name: string } | null } | null
}

const timeFmt = new Intl.DateTimeFormat('en-IE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Dublin',
})

export default async function AdminDashboardPage() {
  const admin = await requireAdmin()
  // The platform owner doesn't manage a single school — send them to the
  // platform console instead of the crèche-principal dashboard.
  if (isPlatformOwner(admin)) redirect('/platform')
  const schoolId = admin.schoolId!
  const db = createSupabaseAdminClient()

  const firstName = admin.profile?.firstName || admin.email.split('@')[0] || 'there'
  const todayISO = new Date().toISOString().slice(0, 10)
  const monthStartISO = `${todayISO.slice(0, 7)}-01`

  // Every query below is scoped to this school explicitly (service role bypasses RLS).
  const [
    sub,
    ratio,
    places,
    vetting,
    certs,
    clashDays,
    { count: activeChildren },
    { data: checkInData },
    { count: lastWeekCheckIns },
    { data: invoiceData },
    { count: newEnquiries },
    { data: schoolRow },
    { data: lateData },
    { count: pendingReconciliation },
  ] = await Promise.all([
    getSchoolSubscription(schoolId),
    getRoomRatioAlerts(schoolId, todayISO),
    getPlacesOverview(schoolId, todayISO),
    getVettingOverview(schoolId, todayISO),
    getCertifications(schoolId, todayISO),
    getUpcomingTimeOffClashes(schoolId, todayISO),
    db
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db
      .from('daily_check_ins')
      .select('id, checked_in_at, checked_out_at, students(first_name, last_name, classes(name))')
      .eq('school_id', schoolId)
      .eq('date', todayISO)
      .not('checked_in_at', 'is', null)
      .order('checked_in_at', { ascending: false }),
    db
      .from('daily_check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('date', sameDayLastWeek(todayISO))
      .not('checked_in_at', 'is', null),
    db
      .from('invoices')
      .select('net_parent_cents, amount_paid_cents, due_date, status')
      .eq('school_id', schoolId)
      .in('status', ['issued', 'part_paid', 'paid'])
      .or(`due_date.gte.${monthStartISO},status.neq.paid`),
    db
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'new'),
    db
      .from('schools')
      .select('stripe_connect_charges_enabled, revolut_api_key_enc')
      .eq('id', schoolId)
      .maybeSingle(),
    db
      .from('late_collections')
      .select('fee_cents')
      .eq('school_id', schoolId)
      .gte('collected_at', `${todayISO}T00:00:00.000Z`)
      .lte('collected_at', `${todayISO}T23:59:59.999Z`),
    // order_items has no school_id — scope via the parent order.
    db
      .from('order_items')
      .select('id, orders!inner(school_id)', { count: 'exact', head: true })
      .eq('orders.school_id', schoolId)
      .eq('verification_status', 'manual_review'),
  ])

  const isTrialing = sub?.status === 'trialing'
  const isPro = hasProAccess(sub)

  // ── Children & rooms ────────────────────────────────────────────────────────
  const checkIns = (checkInData ?? []) as unknown as CheckInRow[]
  const checkedInToday = checkIns.length
  const delta = checkedInToday - (lastWeekCheckIns ?? 0)
  const roomsInRatio = ratio.rooms.filter((r) => r.inRatio).length
  const capacityByRoom = new Map(places.rooms.map((r) => [r.id, r.capacity]))
  const arrivals: Arrival[] = checkIns.slice(0, 6).map((c) => ({
    id: c.id,
    name: c.students ? `${c.students.first_name} ${c.students.last_name}` : 'Child',
    room: c.students?.classes?.name ?? null,
    time: c.checked_in_at ? timeFmt.format(new Date(c.checked_in_at)) : '',
    out: !!c.checked_out_at,
  }))

  // ── Money ───────────────────────────────────────────────────────────────────
  const invoices = ((invoiceData ?? []) as InvoiceRow[]).map((r) => ({
    netParentCents: r.net_parent_cents,
    amountPaidCents: r.amount_paid_cents,
    dueDate: r.due_date,
    status: r.status,
  }))
  const split = monthFeeSplit(invoices, todayISO)
  const overdue = invoices
    .filter((i) => (i.status === 'issued' || i.status === 'part_paid') && i.dueDate < todayISO)
    .map((i) => ({ ...i, owed: Math.max(0, i.netParentCents - i.amountPaidCents) }))
    .filter((i) => i.owed > 0)
  const overdueCents = overdue.reduce((n, i) => n + i.owed, 0)
  const longOverdue = overdue.filter((i) => daysBetween(i.dueDate, todayISO) > 14)
  const school = schoolRow as {
    stripe_connect_charges_enabled: boolean
    revolut_api_key_enc: string | null
  } | null
  const paymentsConnected =
    !!school?.stripe_connect_charges_enabled || !!school?.revolut_api_key_enc

  // ── Needs attention (one list instead of stacked banners) ───────────────────
  const attention: AttentionItem[] = []
  if (ratio.alerts.length > 0) {
    attention.push({
      icon: Scale,
      tone: 'red',
      title: `${ratio.alerts.length} room${ratio.alerts.length === 1 ? '' : 's'} under ratio`,
      detail: ratio.alerts
        .slice(0, 3)
        .map((a) => `${a.roomName} (${a.available} of ${a.required} staff)`)
        .join(', '),
      href: '/admin/ratios',
      cta: 'Review',
    })
  }
  if (overdue.length > 0) {
    attention.push({
      icon: Receipt,
      tone: 'amber',
      title: `${overdue.length} invoice${overdue.length === 1 ? '' : 's'} overdue`,
      detail: `${formatCurrency(overdueCents)} outstanding`,
      href: '/admin/arrears',
      cta: 'Remind',
    })
  }
  const vettingDue = vetting.rows.filter((r) => r.status === 'expired' || r.status === 'expiring')
  if (vettingDue.length > 0) {
    const expired = vettingDue.filter((r) => r.status === 'expired').length
    attention.push({
      icon: ShieldAlert,
      tone: expired > 0 ? 'red' : 'amber',
      title: `Garda vetting: ${vettingDue.length} due`,
      detail:
        (expired > 0 ? `${expired} expired · ` : '') +
        vettingDue
          .slice(0, 3)
          .map((r) => r.name)
          .join(', '),
      href: '/admin/vetting',
      cta: 'Review',
    })
  }
  const certsDue = certs.rows.filter((r) => r.status === 'expired' || r.status === 'expiring')
  if (certsDue.length > 0) {
    attention.push({
      icon: Award,
      tone: 'amber',
      title: `${certsDue.length} qualification${certsDue.length === 1 ? '' : 's'} due for renewal`,
      detail: certsDue
        .slice(0, 2)
        .map((r) => `${r.teacherName} (${r.name})`)
        .join(', '),
      href: '/admin/certifications',
      cta: 'Review',
    })
  }
  if (clashDays.length > 0) {
    const first = clashDays[0]!
    attention.push({
      icon: CalendarOff,
      tone: 'amber',
      title: `Staff clash on ${formatDate(first.date)}`,
      detail: `${first.names.join(', ')} off${clashDays.length > 1 ? ` · +${clashDays.length - 1} more day${clashDays.length > 2 ? 's' : ''}` : ''}`,
      href: '/admin/time-off',
      cta: 'Review',
    })
  }
  const late = (lateData ?? []) as { fee_cents: number | null }[]
  if (late.length > 0) {
    attention.push({
      icon: Timer,
      tone: 'amber',
      title: `${late.length} late collection${late.length === 1 ? '' : 's'} today`,
      detail: `${formatCurrency(late.reduce((n, r) => n + (r.fee_cents ?? 0), 0))} in late fees`,
      href: '/admin/late-collection',
      cta: 'Review',
    })
  }
  if ((pendingReconciliation ?? 0) > 0) {
    attention.push({
      icon: GitMerge,
      tone: 'amber',
      title: `${pendingReconciliation} payment${pendingReconciliation === 1 ? '' : 's'} to review`,
      detail: 'Guest payments waiting to be matched to a child',
      href: '/admin/reconciliation',
      cta: 'Resolve',
    })
  }

  const tip = pickSmartTip({
    roomsUnderRatio: ratio.alerts.length,
    longOverdueCount: longOverdue.length,
    longOverdueCents: longOverdue.reduce((n, i) => n + i.owed, 0),
    newEnquiries: newEnquiries ?? 0,
    placesFree: places.totalAvailable,
    paymentsConnected,
  })

  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Dublin',
  }).format(now)
  const monthLabel = new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    timeZone: 'Europe/Dublin',
  }).format(now)
  const summary =
    ratio.roomsChecked === 0
      ? `Welcome to ${admin.schoolName ?? 'your crèche'}. Add rooms and children to get started.`
      : `${ratio.childrenPresent} of ${activeChildren ?? 0} children in · ${
          ratio.alerts.length === 0
            ? 'all rooms in ratio'
            : `${ratio.alerts.length} room${ratio.alerts.length === 1 ? '' : 's'} need${ratio.alerts.length === 1 ? 's' : ''} staff`
        }`

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <GreetingBanner firstName={firstName} dateLabel={dateLabel} summary={summary} />

      {/* Subscription status: trialing → trial notice; free → upgrade; active Pro → none. */}
      {(isTrialing || !isPro) && (
        <Link
          href={isTrialing ? '/admin/subscription' : '/pricing'}
          className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-surface px-5 py-3 text-sm transition-colors hover:border-primary/60"
        >
          <span>
            <span className="font-extrabold text-text-primary">
              {isTrialing ? 'You’re on your free month' : 'Upgrade to keep everything'}
            </span>
            <span className="text-text-secondary">
              {' '}
              ·{' '}
              {isTrialing
                ? sub?.trial_ends_at
                  ? `Trial ends ${formatDate(sub.trial_ends_at)} — no charge until then.`
                  : 'Full access during your trial.'
                : 'Payment links, instalments, import and reports.'}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-extrabold text-primary">
            {isTrialing ? 'Manage' : 'View plans'}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      )}

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Children in"
          value={`${ratio.childrenPresent} / ${activeChildren ?? 0}`}
          sub={
            delta === 0
              ? 'Same as last week'
              : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} vs last ${new Intl.DateTimeFormat('en-IE', { weekday: 'long', timeZone: 'Europe/Dublin' }).format(now)}`
          }
          subTone={delta > 0 ? 'good' : 'muted'}
          tone="green"
          icon3d="child"
          href="/admin/check-in"
        />
        <StatTile
          label="Rooms in ratio"
          value={`${roomsInRatio} of ${ratio.roomsChecked}`}
          sub={ratio.alerts.length === 0 ? 'All good ✓' : 'Needs staff now'}
          subTone={ratio.alerts.length === 0 ? 'good' : 'warn'}
          tone={ratio.alerts.length === 0 ? 'purple' : 'red'}
          icon3d="scale"
          href="/admin/ratios"
        />
        <StatTile
          label="Fees overdue"
          value={formatCurrency(overdueCents)}
          sub={
            overdue.length === 0
              ? 'Nothing overdue ✓'
              : `${overdue.length} invoice${overdue.length === 1 ? '' : 's'}`
          }
          subTone={overdue.length === 0 ? 'good' : 'warn'}
          tone="yellow"
          icon3d="euro"
          href="/admin/fees/due"
        />
        <StatTile
          label="Places free"
          value={String(places.totalAvailable)}
          sub={`${newEnquiries ?? 0} new enquir${newEnquiries === 1 ? 'y' : 'ies'}`}
          tone="pink"
          icon3d="house"
          href="/admin/places"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AttentionCard items={attention} />
        <RoomsNowCard rooms={ratio.rooms} capacityByRoom={capacityByRoom} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FeesDonutCard split={split} monthLabel={monthLabel} />
        <ArrivalsCard arrivals={arrivals} />
      </div>

      <SmartTipCard tip={tip} />
    </div>
  )
}
