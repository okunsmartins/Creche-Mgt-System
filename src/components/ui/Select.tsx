import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { SelectOption } from '@/types'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string | undefined
  error?: string | undefined
  hint?: string | undefined
  options: SelectOption[]
  placeholder?: string | undefined
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, placeholder, required, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="form-label">
            {label}
            {required && (
              <span className="ml-1 text-error" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          suppressHydrationWarning
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cn(
            "input-base bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] appearance-none bg-[right_0.5rem_center] bg-no-repeat pr-8",
            error && 'border-error focus:border-error focus:ring-error',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(({ value, label: optLabel }) => (
            <option key={value} value={value}>
              {optLabel}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${selectId}-error`} role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'
