'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Opens the browser print dialog for the current page. Global `@media print` CSS
 * (globals.css) hides the app chrome so only the page content prints; the teacher
 * can choose any printer in the OS dialog. Tagged `no-print` so the button itself
 * never appears on the printout.
 */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="no-print"
      aria-label={label}
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  )
}
