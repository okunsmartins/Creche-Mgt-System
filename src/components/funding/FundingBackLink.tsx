import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/** Back navigation from a funding sub-page to the Funding & Hive Centre. */
export function FundingBackLink() {
  return (
    <Link
      href="/admin/funding"
      className="no-print inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Funding &amp; Hive Centre
    </Link>
  )
}
