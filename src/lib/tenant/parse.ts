/**
 * Pure host → tenant-subdomain parser (no request context; unit-testable).
 * Returns the tenant subdomain, or null for hosts that aren't per-tenant:
 * localhost, *.vercel.app previews, apex domains, and www.
 */
export function parseTenantSubdomain(host: string | null | undefined): string | null {
  const hostname = (host ?? '').toLowerCase().split(':')[0] ?? '' // strip port
  if (!hostname || hostname === 'localhost') return null
  // Preview/project URLs on *.vercel.app are not per-tenant subdomains.
  if (hostname.endsWith('.vercel.app')) return null
  const parts = hostname.split('.')
  // Need at least sub.domain.tld for a real subdomain on an apex domain.
  if (parts.length < 3) return null
  const sub = parts[0]
  if (!sub || sub === 'www') return null
  return sub
}
