import Link from 'next/link'
import { SocialLinks } from '@/components/social/SocialLinks'
import type { SocialLink } from '@/lib/social/links'
import { Mascot } from '@/components/marketing/Mascot'

const currentYear = new Date().getFullYear()

const productLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/get-started', label: 'Start free month' },
]

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Notice' },
]

const linkClass = 'text-sm text-[#d7dce3] transition-colors hover:text-white'

export function SiteFooter({
  schoolName,
  tenantSlug,
  socialLinks = [],
}: {
  schoolName?: string | null
  tenantSlug?: string | null
  /** The crèche's (or, on platform pages, Creche Wise's) social links. */
  socialLinks?: SocialLink[]
} = {}) {
  // Keep a `/s/<school>` path prefix on crèche links so they stay in the crèche.
  const withTenant = (href: string) => (tenantSlug ? `/s/${tenantSlug}${href}` : href)
  // Inside a crèche's own portal the footer belongs to the crèche, with a small
  // "Powered by Creche Wise" credit instead of the platform's marketing links.
  if (schoolName) {
    return (
      <footer className="bg-[#1f2b57] text-[#d7dce3]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <p className="font-display text-xl font-bold text-white">{schoolName}</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link href={withTenant('/privacy')} className={linkClass}>
              Privacy Notice
            </Link>
            <Link href={withTenant('/contact')} className={linkClass}>
              Contact
            </Link>
          </nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[#34407a] px-4 py-4 text-xs text-[#aeb6c2] sm:px-6 lg:px-8">
          <p>
            &copy; {currentYear} {schoolName}
          </p>
          <SocialLinks links={socialLinks} schoolName={schoolName} size={34} />
          <p>
            Powered by{' '}
            <a href="https://crechewise.com" className="font-extrabold text-white">
              Creche Wise
            </a>
          </p>
        </div>
      </footer>
    )
  }

  return (
    <footer className="bg-[#1f2b57] text-[#d7dce3]">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-8 px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <p className="flex items-center gap-2.5 font-display text-xl font-bold text-white">
            <Mascot size={40} />
            Creche Wise
          </p>
          <p className="mt-2 text-sm">
            Crèche management for Ireland: fees, funding, ratios, staff and parents in one place.
          </p>
        </div>
        <nav aria-label="Footer: product" className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-white">Product</span>
          {productLinks.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Footer: company" className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-white">Company</span>
          {companyLinks.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-white">Get in touch</span>
          <a href="mailto:info@crechewise.com" className={linkClass}>
            info@crechewise.com
          </a>
          <a href="mailto:support@crechewise.com" className={linkClass}>
            support@crechewise.com
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[#34407a] px-4 py-4 text-xs text-[#aeb6c2] sm:px-6 lg:px-8">
        <p>&copy; {currentYear} First Stack Solutions. All rights reserved.</p>
        <SocialLinks links={socialLinks} schoolName="Creche Wise" size={34} />
        <p>Payments secured by Stripe &amp; Revolut</p>
      </div>
    </footer>
  )
}
