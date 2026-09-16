import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Note: a "multiple lockfiles" warning appears in dev because a package-lock.json
  // also exists one level up at "E:\First Stack Solutions\". This is harmless;
  // the project has its own lock file and runs independently.

  // Allow SVG images via next/image
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP is set per-request by src/middleware.ts (with a nonce).
          // Do NOT add a static CSP here — it would conflict with the middleware nonce.
        ],
      },
    ]
  },

  // Redirect www to non-www (adjust for production domain)
  async redirects() {
    return []
  },
}

export default nextConfig
