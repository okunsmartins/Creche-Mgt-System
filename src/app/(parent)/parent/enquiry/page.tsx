import type { Metadata } from 'next'
import { requireParent } from '@/lib/auth/guards'
import { ParentEnquiryForm } from '@/components/enquiries/ParentEnquiryForm'

export const metadata: Metadata = { title: 'Make an enquiry' }
export const dynamic = 'force-dynamic'

export default async function ParentEnquiryPage() {
  await requireParent()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Make an enquiry</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ask the crèche about a place for another child, availability or sessions. Your enquiry
          goes straight to the crèche office and they&apos;ll be in touch.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <ParentEnquiryForm />
      </div>
    </div>
  )
}
