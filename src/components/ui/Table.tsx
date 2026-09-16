import { cn } from '@/lib/utils'

// Composable accessible table primitives

interface TableProps {
  children: React.ReactNode
  className?: string
  caption?: string
}

export function Table({ children, className, caption }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full text-sm', className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export function TableHead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <thead className={cn('bg-surface text-xs uppercase text-text-muted', className)}>
      {children}
    </thead>
  )
}

export function TableBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <tbody className={cn('divide-y divide-border bg-surface', className)}>{children}</tbody>
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-surface/50',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableHeader({
  children,
  className,
  scope = 'col',
}: {
  children: React.ReactNode
  className?: string
  scope?: 'col' | 'row'
}) {
  return (
    <th scope={scope} className={cn('px-4 py-3 text-left font-semibold tracking-wide', className)}>
      {children}
    </th>
  )
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3 text-text-secondary', className)}>{children}</td>
}

export function TableFoot({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <tfoot className={cn('border-t border-border bg-surface font-medium', className)}>
      {children}
    </tfoot>
  )
}
