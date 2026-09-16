/**
 * Length of the free trial a school gets — used in BOTH places so they can never
 * drift apart:
 *  - `provision.ts`: the trial granted at school signup (no card required).
 *  - `subscriptionActions.ts`: the Stripe Checkout trial, granted only to schools
 *    that have not already used their signup trial (see `grantTrial`).
 *
 * Keep the customer-facing copy on /pricing in sync when changing this.
 */
export const TRIAL_PERIOD_DAYS = 30
