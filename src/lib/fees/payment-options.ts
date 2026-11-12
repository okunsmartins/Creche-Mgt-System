import 'server-only'
import { getSchoolConnect, connectStatus } from '@/lib/stripe/connect'
import { schoolHasOwnRevolut } from '@/lib/revolut/perSchool'

/** How a parent can pay this crèche online. Both go straight to the crèche's own account. */
export interface FeePaymentOptions {
  /** Card via the crèche's connected Stripe account. */
  card: boolean
  /** Revolut via the crèche's own Revolut Business account. */
  revolut: boolean
}

export type FeePaymentMethod = 'card' | 'revolut'

export async function getFeePaymentOptions(schoolId: string): Promise<FeePaymentOptions> {
  const [connect, revolut] = await Promise.all([
    getSchoolConnect(schoolId),
    schoolHasOwnRevolut(schoolId),
  ])
  return {
    card: connectStatus(connect) === 'active' && Boolean(connect?.stripe_connect_account_id),
    revolut,
  }
}
