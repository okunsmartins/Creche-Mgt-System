import Link from 'next/link'

const currentYear = new Date().getFullYear()

const footerLinks = [
  { href: '/privacy', label: 'Privacy Notice' },
  { href: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-text-muted">
            &copy; {currentYear} First Stack Solutions. All rights reserved.
          </p>
          <nav aria-label="Footer navigation">
            <ul className="flex gap-4">
              {footerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-xs text-text-muted transition-colors hover:text-primary"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-xs text-text-muted">
            Payments secured by <span className="font-medium text-text-secondary">Stripe</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
