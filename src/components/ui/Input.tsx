'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | undefined
  label?: string | undefined
  hint?: string | undefined
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, id, required, type, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const [reveal, setReveal] = useState(false)

    // Password fields get a show/hide toggle across the platform.
    const isPassword = type === 'password'
    const effectiveType = isPassword && reveal ? 'text' : type

    const inputEl = (
      <input
        ref={ref}
        id={inputId}
        type={effectiveType}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          'input-base',
          isPassword && 'pr-10',
          error && 'border-error focus:border-error focus:ring-error',
          className,
        )}
        suppressHydrationWarning
        {...props}
      />
    )

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {required && (
              <span className="ml-1 text-error" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        {isPassword ? (
          <div className="relative">
            {inputEl}
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              aria-pressed={reveal}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-primary focus:outline-none focus-visible:text-primary"
            >
              {reveal ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : (
          inputEl
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'
