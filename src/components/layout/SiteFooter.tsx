import Link from 'next/link'

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

export function SiteFooter() {
  return (
    <footer className="bg-[#1e2a3a] text-[#d7dce3]">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-8 px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <p className="font-display text-xl font-bold text-white">Creche Wise</p>
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
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t border-[#34425a] px-4 py-4 text-xs text-[#aeb6c2] sm:px-6 lg:px-8">
        <p>&copy; {currentYear} First Stack Solutions. All rights reserved.</p>
        <p>Payments secured by Stripe &amp; Revolut</p>
      </div>
    </footer>
  )
}
