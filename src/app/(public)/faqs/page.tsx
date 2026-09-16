import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = { title: 'FAQs' }

// NOTE: edit the copy to match your offering. A few claims below (support
// channels/hours, exact hosting region) should be confirmed before publishing.
const faqs = [
  {
    q: 'How do schools get started with Skool Bido?',
    a: 'Getting started is quick. Create your school’s own portal, add your classes, activities and programmes, and share your portal link with parents. Setup takes minutes rather than weeks, and our step-by-step guides walk you through each stage — most schools are up and running in a matter of hours.',
  },
  {
    q: 'Is Skool Bido compliant with Irish data protection law (GDPR)?',
    a: 'Protecting your school’s data is a priority. Skool Bido is built with GDPR in mind: data is hosted with reputable cloud infrastructure providers, all connections are encrypted in transit (HTTPS/TLS), and every payment is handled by regulated payment providers — we never see or store card details. Access is strictly role-based, so staff only see information relevant to their role. See our Privacy Policy for the full detail.',
  },
  {
    q: 'How does Skool Bido work — is it difficult to use?',
    a: 'Skool Bido is a secure, cloud-based system, so there’s nothing to install and updates happen automatically. Sign in from any device with an internet connection — laptop, phone or tablet — and your data is always there; if a device fails, just sign in from another one and nothing is lost. It’s designed to be intuitive: if you can use everyday web apps, you’ll find your way around it easily.',
  },
  {
    q: 'Is it suitable for all sizes and types of primary school?',
    a: 'Yes. Skool Bido works for primary schools of every size and type — urban and rural, DEIS schools, special schools, Gaelscoileanna, national schools and community national schools. Each school gets its own private, branded portal.',
  },
  {
    q: 'How does my school set up payments and get paid?',
    a: 'Setting up payments is fast and self-serve — there’s no lengthy onboarding. In your school admin portal, go to Payments → Payment setup and click “Connect Stripe”, then follow Stripe’s short, guided steps: enter your school’s details, add the bank account where you want money to land, and verify your identity. It takes about five minutes, and the moment Stripe marks you “Connected” you can start taking payments. Money from parents goes directly into your school’s own Stripe account — we don’t take a cut, and your school is the merchant of record. You manage payouts, refunds and receipts from your own Stripe dashboard.',
  },
  {
    q: 'How do parents pay?',
    a: 'Parents pay online by card or wallet. They can pay as a guest with no account, or sign in to their school’s portal to see their children, orders and receipts in one place. Larger amounts can be spread across instalments where the school enables it.',
  },
  {
    q: 'How do I (a parent) get access to my child’s school portal?',
    a: 'Your school gives you a secure link to its own portal — it looks like skoolbido.com/s/your-school. Always start from that link: it’s what connects your account to the correct school, so your child’s school name and logo appear automatically. On that page choose “Register” to create your parent account (you’ll confirm your email address first), then sign in and go to “My Children” to link your child by name — the school reviews and approves the request before access is granted. Once your account exists you can sign in any time with your email and password.',
  },
  {
    q: 'I already have a parent account — where do I sign in?',
    a: 'Open your school’s link (skoolbido.com/s/your-school) and choose “Sign in”, or go to skoolbido.com and sign in there — either way you’ll land in your own school’s portal, showing only your children. If you’ve forgotten your password, use “Forgot your password?” on the sign-in page to reset it by email. For your first account, though, always register through the link your school sent, so you’re attached to the right school.',
  },
  {
    q: 'Do I need an account to pay? (Guest checkout)',
    a: 'No — you can pay as a guest with no account. Open the payment link your school sent, or your school’s portal link (skoolbido.com/s/your-school), and pay securely by card; your receipt is emailed to you. Creating an account is optional but recommended, as it lets you see all your children, orders, receipts and any instalments in one place. Whether you pay as a guest or sign in, always start from the link your school gives you so you reach the correct school.',
  },
  {
    q: 'Who can see what on Skool Bido?',
    a: 'Access is controlled by role. Principals and school administrators can see school-wide information and manage settings and payments; class teachers see only the pupils in their own classes; and parents only ever see their own children. Your school controls each staff member’s level of access, so everyone sees exactly what they need — and nothing they don’t.',
  },
  {
    q: 'What support is available for schools?',
    a: 'We’re here to help. Schools get guided setup, help articles, and responsive email support to get the most out of Skool Bido, so there’s always someone to turn to when you have a question.',
  },
]

export default function FaqsPage() {
  return (
    <>
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #ece6fc 0%, #f3f0fb 62%)' }}
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
            Answers to the things schools and parents ask us most.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-text-primary">Still curious?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
            Choosing the right system for your school is a big decision. We&apos;ve gathered the
            questions schools ask us most — from setup and support to key features.
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
