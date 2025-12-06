/**
 * Checkout Webhook Handler
 *
 * Handles checkout.session.completed event.
 */

import { getStripeClient } from "../client.js"
import { createPartyWithSubscription } from "../party.js"
import { getSubscriptionId, type CheckoutSession } from "../schemas.js"

/**
 * Handle checkout.session.completed event.
 * Creates the party and subscription after successful hosted checkout payment.
 */
export async function handleCheckoutCompleted(session: CheckoutSession): Promise<void> {
  const metadata = session.metadata ?? {}

  const partyName = metadata.party_name
  const gameType = metadata.game_type || "dnd"
  const userId = metadata.user_id

  if (!partyName || !userId) {
    console.error("Missing required metadata in checkout session:", metadata)
    throw new Error("Missing party_name or user_id in checkout metadata")
  }

  if (!session.subscription) {
    console.error("No subscription in checkout session")
    throw new Error("No subscription in checkout session")
  }

  console.log(`Creating party "${partyName}" for user ${userId}`)

  // Get subscription details from Stripe (expand items to get current_period_start/end)
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(
    getSubscriptionId(session.subscription),
    { expand: ["items.data"] }
  )

  await createPartyWithSubscription({
    partyName,
    gameType,
    userId,
    subscription,
  })
}
