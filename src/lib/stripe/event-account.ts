// Defence in depth for Stripe Connect webhooks: a refund event must come from the
// crèche's OWN connected account before we change that crèche's records. Payment
// intent ids are globally unique, so a mismatch shouldn't happen — but if it ever does
// (a reconnected account, a misrouted event), we log it and change nothing.

/**
 * @param eventAccount  `event.account` (set for events from connected accounts).
 * @param schoolAccount the crèche's `stripe_connect_account_id`.
 * @param strict        fee payments are ALWAYS direct charges on the connected account, so
 *                      an event from the platform account (no `event.account`) is rejected.
 *                      Order payments are lenient: only an explicit mismatch is rejected.
 */
export function refundEventMatchesSchool(
  eventAccount: string | null | undefined,
  schoolAccount: string | null | undefined,
  strict: boolean,
): boolean {
  if (eventAccount && schoolAccount) return eventAccount === schoolAccount
  if (!strict) return true
  return false
}
