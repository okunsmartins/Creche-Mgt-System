import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = { title: 'FAQs' }

// NOTE: edit the copy to match your offering. A few claims below (support
// channels/hours, exact hosting region) should be confirmed before publishing.
const faqs = [
  {
    q: 'How do crèches get started with Creche Wise?',
    a: 'Getting started is quick. Create your crèche’s own portal, add your rooms, children and staff (you can import your existing spreadsheet in minutes), set up your fees, and share your portal link with parents. Setup takes hours rather than weeks, and our step-by-step guides walk you through each stage.',
  },
  {
    q: 'How does Creche Wise handle ECCE and NCS subvention?',
    a: 'This is what Creche Wise does best. ECCE capitation and NCS hourly subsidy are built in: when you create a child’s invoice, the subvention they’re entitled to is netted off automatically, so parents are only billed the balance they actually owe. Your provider receivables from Pobal are tracked separately, and you get a subvention report to reconcile against the Pobal Early Years Hive. Rates are configurable with effective dates, so they stay correct when the Budget changes. (Creche Wise prepares and reconciles your returns — it does not submit to the Hive on your behalf, as the Hive has no public integration.)',
  },
  {
    q: 'Is Creche Wise compliant with Irish data protection law (GDPR)?',
    a: 'Protecting children’s and families’ data is a priority. Creche Wise is built with GDPR in mind: data is hosted with reputable cloud infrastructure providers, all connections are encrypted in transit (HTTPS/TLS), and sensitive details such as PPSN are encrypted at rest. Every payment is handled by regulated payment providers — we never see or store card details. Access is strictly role-based, so staff only see information relevant to their role. See our Privacy Policy for the full detail.',
  },
  {
    q: 'How does Creche Wise work — is it difficult to use?',
    a: 'Creche Wise is a secure, cloud-based system, so there’s nothing to install and updates happen automatically. Sign in from any device with an internet connection — laptop, phone or tablet — and your data is always there; if a device fails, just sign in from another one and nothing is lost. It’s designed to be intuitive: if you can use everyday web apps, you’ll find your way around it easily.',
  },
  {
    q: 'Is it suitable for all sizes and types of crèche?',
    a: 'Yes. Creche Wise works for early-years settings of every size and type — full-day care, sessional preschool, Montessori, naíonraí, after-school and community childcare services. Whether you run one room or several across multiple age bands, each crèche gets its own private, branded portal.',
  },
  {
    q: 'Can I manage attendance, ratios and daily records?',
    a: 'Yes. Staff check children in and out each day, and Creche Wise shows live room occupancy against the required adult-to-child ratios so you always know you’re compliant. You can also log daily records — sleep, meals, nappies, incidents and medication — and share the right information with parents, keeping a clear, auditable history for inspections.',
  },
  {
    q: 'How does my crèche set up payments and get paid?',
    a: 'Setting up payments is fast and self-serve — there’s no lengthy onboarding. In your crèche admin portal, go to Payments → Payment setup and connect your own Stripe or Revolut account, then follow the short guided steps: enter your crèche’s details, add the bank account where you want money to land, and verify your identity. It takes about five minutes, and the moment you’re marked “Connected” you can start taking payments. Money from parents goes directly into your crèche’s own account — we don’t take a cut, and your crèche is the merchant of record. You manage payouts, refunds and receipts from your own dashboard.',
  },
  {
    q: 'How do parents pay?',
    a: 'Parents pay online by card or wallet. They can pay as a guest with no account, or sign in to their crèche’s portal to see their children, invoices and receipts in one place. Larger amounts — such as a term’s fees — can be spread across instalments where the crèche enables it.',
  },
  {
    q: 'How do I (a parent) get access to my child’s crèche portal?',
    a: 'Your crèche gives you a secure link to its own portal — it looks like crechewise.com/s/your-creche. Always start from that link: it’s what connects your account to the correct crèche, so your crèche’s name and logo appear automatically. On that page choose “Register” to create your parent account (you’ll confirm your email address first), then sign in and link your child by name — the crèche reviews and approves the request before access is granted. Once your account exists you can sign in any time with your email and password.',
  },
  {
    q: 'I already have a parent account — where do I sign in?',
    a: 'Open your crèche’s link (crechewise.com/s/your-creche) and choose “Sign in”, or go to crechewise.com and sign in there — either way you’ll land in your own crèche’s portal, showing only your children. If you’ve forgotten your password, use “Forgot your password?” on the sign-in page to reset it by email. For your first account, though, always register through the link your crèche sent, so you’re attached to the right crèche.',
  },
  {
    q: 'Do I need an account to pay? (Guest checkout)',
    a: 'No — you can pay as a guest with no account. Open the payment link your crèche sent, or your crèche’s portal link (crechewise.com/s/your-creche), and pay securely by card; your receipt is emailed to you. Creating an account is optional but recommended, as it lets you see all your children, invoices, receipts and any instalments in one place. Whether you pay as a guest or sign in, always start from the link your crèche gives you so you reach the correct crèche.',
  },
  {
    q: 'Who can see what on Creche Wise?',
    a: 'Access is controlled by role. Managers and administrators can see crèche-wide information and manage settings, fees and payments; room staff see only the children in the rooms they’re assigned to; and parents only ever see their own children. Your crèche controls each staff member’s level of access, so everyone sees exactly what they need — and nothing they don’t.',
  },
  {
    q: 'What support is available for crèches?',
    a: 'We’re here to help. Crèches get guided setup, help articles, and responsive email support to get the most out of Creche Wise, so there’s always someone to turn to when you have a question.',
  },
]

export default function FaqsPage() {
  return (
    <>
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Help &amp; FAQs
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Frequently asked <span className="text-primary">questions</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Answers to the things crèches and parents ask us most.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-text-primary">Still curious?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
            Choosing the right system for your crèche is a big decision. We&apos;ve gathered the
            questions crèches and parents ask us most — from setup and subvention to payments and
            daily records.
          </p>
        </div>

        <dl className="space-y-3">
          {faqs.map(({ q, a }) => (
            <div key={q} className="card p-5">
              <dt className="text-sm font-semibold text-text-primary">{q}</dt>
              <dd className="mt-1.5 text-sm text-text-secondary">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-text-secondary">
          Still have a question?{' '}
          <Link
            href="/contact"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Get in touch
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  )
}
