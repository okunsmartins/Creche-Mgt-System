/**
 * Origins for a school's PUBLIC, branded URLs (pay-by-link, public portal).
 *
 * **Single-domain (Aladdin-style):** everything lives on the apex `appUrl`
 * (e.g. `skoolbido.com/pay/<token>`). The school is carried by the path/token,
 * not by a per-school subdomain host — so there is no per-school DNS/SSL to
 * provision and the bare apex is always the platform.
 *
 * Pure (no env, no I/O) so it is unit-testable; callers pass `serverEnv.appUrl`.
 */

/** Base origin (scheme + host, no trailing slash) for a school's public URLs. */
export function schoolPublicOrigin(appUrl: string): string {
  return appUrl.replace(/\/+$/, '')
}

/** Full shareable pay-by-link URL for a token (e.g. `skoolbido.com/pay/<token>`). */
export function schoolPayLinkUrl(appUrl: string, token: string): string {
  return `${schoolPublicOrigin(appUrl)}/pay/${token}`
}
