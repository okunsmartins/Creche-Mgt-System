import type { Metadata, Viewport } from 'next'
import { Nunito } from 'next/font/google'
import { NavigationProgress } from '@/components/ui/NavigationProgress'
import './globals.css'

// Rounded, friendly typeface — warm and approachable for a school audience.
const sans = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Crèche Management System',
    default: 'Crèche Management System — online school payments',
  },
  description: 'Securely pay for school activities, trips, books and uniforms.',
  robots: {
    index: false, // Payment portal should not be indexed
    follow: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14b3ad',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-IE" className={sans.variable}>
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
