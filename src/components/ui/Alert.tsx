import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

const variantConfig: Record<
  AlertVariant,
  { icon: typeof AlertCircle; classes: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-success-light border-success/20 text-success',
    iconClass: 'text-success',
  },
  error: {
    icon: AlertCircle,
    classes: 'bg-error-light border-error/20 text-error',
    iconClass: 'text-error',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-warning-light border-warning/20 text-warning',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    classes: 'bg-info-light border-info/20 text-info',
    iconClass: 'text-info',
  },
}

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
  onDismiss?: () => void
}

export function Alert({ variant = 'info', title, children, className, onDismiss }: AlertProps) {
  const { icon: Icon, classes, iconClass } = variantConfig[variant]

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4', classes, className)}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClass)} aria-hidden="true" />
      <div className="flex-1 text-sm">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          suppressHydrationWarning
          className="shrink-0 rounded hover:opacity-70"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
