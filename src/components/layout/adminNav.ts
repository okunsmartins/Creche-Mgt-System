// Admin navigation model — shared by the sidebar and the page-title icons so they
// always agree. Pure data (no hooks), importable from client and server components.

import {
  LayoutDashboard,
  Users,
  Calendar,
  Repeat,
  ShoppingCart,
  CreditCard,
  RotateCcw,
  BarChart2,
  Shield,
  ShieldCheck,
  Award,
  ChevronRight,
  GitMerge,
  ScrollText,
  GraduationCap,
  BookOpen,
  Link2,
  Settings,
  ClipboardCheck,
  Sparkles,
  Mail,
  MessageSquare,
  CalendarOff,
  CalendarClock,
  Clock,
  ClipboardList,
  Building2,
  FileText,
  Banknote,
  Bus,
  Receipt,
  Scale,
  AlertCircle,
  Bell,
  LogIn,
  Landmark,
  NotebookPen,
  TrendingUp,
  UserPlus,
  UserCheck,
  Upload,
  Timer,
} from 'lucide-react'
import type { Icon3DName } from '@/components/ui/Icon3D'

export interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

export interface NavSection {
  title?: string
  /** Group colour for the icon tiles (rainbow brand palette, white icon ≥ 4.5:1). */
  color?: string
  /** 3D icon shown beside the group heading. */
  icon3d?: Icon3DName
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Today',
    icon3d: 'calendar',
    color: '#2b8a3e',
    items: [
      { href: '/admin/check-in', label: 'Daily Check-in', icon: LogIn },
      { href: '/admin/daily-records', label: 'Daily Records', icon: NotebookPen },
      { href: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
      { href: '/admin/attendance?view=month', label: 'Monthly Summary', icon: BarChart2 },
    ],
  },
  {
    title: 'Children',
    icon3d: 'child',
    color: '#d6336c',
    items: [
      { href: '/admin/students', label: 'Children', icon: Users },
      { href: '/admin/places', label: 'Places & Vacancies', icon: Building2 },
      { href: '/admin/enquiries', label: 'Enquiries', icon: UserPlus },
      { href: '/admin/import', label: 'Import', icon: Upload },
      { href: '/admin/assignments', label: 'Assignments', icon: FileText },
      { href: '/admin/observations', label: 'Learning Journals', icon: BookOpen },
      { href: '/admin/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
      { href: '/admin/collectors', label: 'Collectors', icon: UserCheck },
      { href: '/admin/link-requests', label: 'Link Requests', icon: ChevronRight },
    ],
  },
  {
    title: 'Staff',
    icon3d: 'teacher',
    color: '#7048e8',
    items: [
      { href: '/admin/teachers', label: 'Staff', icon: GraduationCap },
      { href: '/admin/classes', label: 'Rooms', icon: BookOpen },
      { href: '/admin/rota', label: 'Rota', icon: CalendarClock },
      { href: '/admin/staff-attendance', label: 'Staff Clock-in', icon: Clock },
      { href: '/admin/timesheets', label: 'Timesheets', icon: ClipboardList },
      { href: '/admin/payroll', label: 'Payroll', icon: Banknote },
      { href: '/admin/ratios', label: 'Ratios', icon: Scale },
      { href: '/admin/time-off', label: 'Time Off', icon: CalendarOff },
      { href: '/admin/vetting', label: 'Garda Vetting', icon: ShieldCheck },
      { href: '/admin/certifications', label: 'Quals & Training', icon: Award },
    ],
  },
  {
    title: 'Money',
    icon3d: 'euro',
    color: '#b07200',
    items: [
      { href: '/admin/fees', label: 'Fees & Invoices', icon: Receipt },
      { href: '/admin/fees/due', label: 'Fees Due', icon: CalendarClock },
      { href: '/admin/arrears', label: 'Arrears', icon: AlertCircle },
      { href: '/admin/reminders', label: 'Reminders', icon: Bell },
      { href: '/admin/late-collection', label: 'Late Collection', icon: Timer },
      { href: '/admin/activities', label: 'Activities', icon: Calendar },
      { href: '/admin/programmes', label: 'Programmes', icon: Repeat },
      { href: '/admin/collection', label: 'School Collection', icon: Bus },
      { href: '/admin/payment-links', label: 'Payment Links', icon: Link2 },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/payments/connect', label: 'Payment Setup', icon: Banknote },
      { href: '/admin/refunds', label: 'Refunds', icon: RotateCcw },
    ],
  },
  {
    title: 'Parents',
    icon3d: 'speech',
    color: '#1c7ed6',
    items: [
      { href: '/admin/messages', label: 'Messages', icon: Mail },
      { href: '/admin/sms', label: 'Text Parents', icon: MessageSquare },
    ],
  },
  {
    title: 'Reports',
    icon3d: 'chart',
    color: '#4a5578',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
      { href: '/admin/commercial', label: 'Commercial', icon: TrendingUp },
      { href: '/admin/subvention-report', label: 'Subvention', icon: Landmark },
    ],
  },
  {
    title: 'Administration',
    icon3d: 'gear',
    color: '#4a5578',
    items: [
      { href: '/admin/settings', label: 'Crèche Settings', icon: Settings },
      { href: '/admin/subscription', label: 'Subscription', icon: Sparkles },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: GitMerge },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/admin/users', label: 'Users & Roles', icon: Shield },
    ],
  },
]

export const FUNDING_SECTION: NavSection = {
  title: 'Funding',
  icon3d: 'bank',
  color: '#2b8a3e',
  items: [{ href: '/admin/funding', label: 'Funding & Hive', icon: Landmark }],
}

// 3D icon shown beside each admin page's title. Pages not listed use their sidebar
// group's icon; anything outside the nav falls back to the house.
const PAGE_ICONS: Record<string, Icon3DName> = {
  '/admin/dashboard': 'house',
  '/admin/check-in': 'wave',
  '/admin/daily-records': 'memo',
  '/admin/attendance': 'check',
  '/admin/students': 'child',
  '/admin/places': 'house',
  '/admin/enquiries': 'envelope',
  '/admin/import': 'memo',
  '/admin/assignments': 'memo',
  '/admin/observations': 'teddy',
  '/admin/permission-slips': 'memo',
  '/admin/collectors': 'shield',
  '/admin/link-requests': 'phone',
  '/admin/teachers': 'teacher',
  '/admin/classes': 'school',
  '/admin/rota': 'calendar',
  '/admin/staff-attendance': 'alarm',
  '/admin/timesheets': 'alarm',
  '/admin/payroll': 'moneybag',
  '/admin/ratios': 'scale',
  '/admin/time-off': 'calendar',
  '/admin/vetting': 'shield',
  '/admin/certifications': 'check',
  '/admin/fees': 'euro',
  '/admin/fees/due': 'calendar',
  '/admin/arrears': 'bell',
  '/admin/reminders': 'bell',
  '/admin/late-collection': 'alarm',
  '/admin/activities': 'party',
  '/admin/programmes': 'calendar',
  '/admin/collection': 'school',
  '/admin/payment-links': 'card',
  '/admin/orders': 'card',
  '/admin/payments': 'card',
  '/admin/payments/connect': 'bank',
  '/admin/refunds': 'moneybag',
  '/admin/messages': 'envelope',
  '/admin/sms': 'mobile',
  '/admin/reports': 'chart',
  '/admin/commercial': 'chart',
  '/admin/subvention-report': 'bank',
  '/admin/funding': 'bank',
  '/admin/settings': 'gear',
  '/admin/subscription': 'party',
  '/admin/reconciliation': 'check',
  '/admin/audit': 'memo',
  '/admin/users': 'shield',
}

/** The 3D icon for an admin path: most specific listed page, else its group's icon. */
export function pageIconFor(pathname: string): Icon3DName {
  const matches = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const best = Object.keys(PAGE_ICONS)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0]
  if (best) return PAGE_ICONS[best]!
  for (const section of [...NAV_SECTIONS, FUNDING_SECTION]) {
    if (section.icon3d && section.items.some((i) => matches(i.href.split('?')[0]!)))
      return section.icon3d
  }
  return 'house'
}
