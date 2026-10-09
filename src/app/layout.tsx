import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { NavigationProgress } from '@/components/ui/NavigationProgress'
import './globals.css'

// Rounded, friendly typeface — warm and approachable for a crèche audience.
// Self-hosted (variable woff2) rather than next/font/google: the build no longer
// fetches from Google Fonts, which was intermittently failing Vercel builds
// ("An error occurred in 'next/font'" from the google loader). The variable file
// covers the 400–800 weights we use.
const sans = localFont({
  src: './fonts/nunito-latin-variable.woff2',
  weight: '400 800',
  variable: '--font-sans',
  display: 'swap',
})

// Rounded display face for headings (Fredoka, OFL). Self-hosted for the same
// reason as Nunito above.
const display = localFont({
  src: './fonts/fredoka-latin-variable.woff2',
  weight: '300 700',
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Creche Wise',
    default: 'Creche Wise — crèche management, made simple',
  },
  description:
    'Creche Wise gives every crèche its own portal for enrolments, fees, subvention (ECCE/NCS), attendance and parent payments.',
  robots: {
    index: false, // Payment portal should not be indexed
    follow: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2463d6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-IE" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <NavigationProgress />
        {children}
      </body>
    </html>
  )
}
