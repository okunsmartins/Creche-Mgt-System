import { cn } from '@/lib/utils'
import type { OrderStatus, PaymentStatus, RefundStatus, VerificationStatus } from '@/types'

const statusConfig = {
  // Order statuses
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700' },
  pending_payment: { label: 'Pending', classes: 'bg-warning-light text-warning' },
  partially_paid: { label: 'Part Paid', classes: 'bg-info-light text-info' },
  paid: { label: 'Paid', classes: 'bg-success-light text-success' },
  partially_refunded: { label: 'Part Refunded', classes: 'bg-info-light text-info' },
  fully_refunded: { label: 'Refunded', classes: 'bg-gray-100 text-gray-600' },
  payment_failed: { label: 'Failed', classes: 'bg-error-light text-error' },
  expired: { label: 'Expired', classes: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-500' },
  // Payment statuses
  pending: { label: 'Pending', classes: 'bg-warning-light text-warning' },
  processing: { label: 'Processing', classes: 'bg-info-light text-info' },
  failed: { label: 'Failed', classes: 'bg-error-light text-error' },
  refunded: { label: 'Refunded', classes: 'bg-gray-100 text-gray-600' },
  // Refund statuses
  succeeded: { label: 'Succeeded', classes: 'bg-success-light text-success' },
  // Verification statuses (SRS §9.2 spec values — migration 011)
  verified_link: { label: 'Verified (Link)', classes: 'bg-success-light text-success' },
  verified_code: { label: 'Verified (Code)', classes: 'bg-success-light text-success' },
  manual_review: { label: 'Manual Review', classes: 'bg-warning-light text-warning' },
  manually_matched: { label: 'Matched', classes: 'bg-info-light text-info' },
  // Legacy verification statuses (pre-migration 011)
  verified: { label: 'Verified', classes: 'bg-success-light text-success' },
  manual: { label: 'Manual Reconciliation', classes: 'bg-warning-light text-warning' },
  unverified: { label: 'Unverified', classes: 'bg-gray-100 text-gray-600' },
  // Email statuses
  sent: { label: 'Sent', classes: 'bg-success-light text-success' },
  skipped: { label: 'Skipped', classes: 'bg-gray-100 text-gray-500' },
  // Generic
  published: { label: 'Published', classes: 'bg-success-light text-success' },
  closed: { label: 'Closed', classes: 'bg-warning-light text-warning' },
  archived: { label: 'Archived', classes: 'bg-gray-100 text-gray-500' },
  active: { label: 'Active', classes: 'bg-success-light text-success' },
  inactive: { label: 'Inactive', classes: 'bg-gray-100 text-gray-500' },
} as const

type BadgeStatus = OrderStatus | PaymentStatus | RefundStatus | VerificationStatus | string

interface BadgeProps {
  status: BadgeStatus
  className?: string
  label?: string
}

export function StatusBadge({ status, className, label }: BadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? {
    label: status,
    classes: 'bg-gray-100 text-gray-700',
  }

  return <span className={cn('badge', config.classes, className)}>{label ?? config.label}</span>
}

interface GenericBadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<NonNullable<GenericBadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  error: 'bg-error-light text-error',
  info: 'bg-info-light text-info',
}

export function Badge({ variant = 'default', children, className }: GenericBadgeProps) {
  return <span className={cn('badge', variantClasses[variant], className)}>{children}</span>
}
