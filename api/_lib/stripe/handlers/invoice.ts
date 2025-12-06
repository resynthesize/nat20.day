/**
 * Invoice Webhook Handlers
 *
 * Handles invoice.paid and invoice.payment_failed events.
 */

import { getServiceClient } from "../../supabase.js"
import { getStripeClient } from "../client.js"
import { createPartyWithSubscription } from "../party.js"
import { getInvoiceSubscriptionId, type Invoice } from "../schemas.js"

/**
 * Handle invoice.paid event for embedded payment flow.
 * Creates party and subscription when first invoice is paid (authenticated flow)
 * OR marks pending signup as paid (pre-auth flow).
 */
export async function handleInvoicePaid(invoice: Invoice): Promise<void> {
  // Check if this is a subscription creation invoice (first payment)
  if (invoice.billing_reason !== "subscription_create") {
    console.log(`Skipping invoice.paid for billing_reason: ${invoice.billing_reason}`)
    return
  }

  // Get subscription ID from the invoice
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    console.log("Invoice paid but no subscription attached")
    return
  }

  const supabase = getServiceClient()
  const stripe = getStripeClient()

  // Check if we already created a party for this subscription (idempotency)
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single()

  if (existingSub) {
    console.log(`Subscription ${subscriptionId} already exists, skipping party creation`)
    return
  }

  // Fetch the full subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data"],
  })

  const metadata = subscription.metadata || {}
  const partyName = metadata.party_name
  const gameType = metadata.game_type || "dnd"
  const userId = metadata.user_id

  // Check if this is a pending signup (no user_id means pre-auth flow)
  if (!userId) {
    console.log(`No user_id in subscription ${subscriptionId} - this is a pending signup`)

    // Mark the pending signup as payment completed
    const { error: updateError, data: updatedSignup } = await supabase
      .from("pending_signups")
      .update({ payment_completed: true })
      .eq("stripe_subscription_id", subscriptionId)
      .select("id")
      .single()

    if (updateError) {
      console.error("Failed to mark pending signup as paid:", updateError)
      throw new Error(`Failed to update pending signup: ${updateError.message}`)
    }

    console.log(`Marked pending signup ${updatedSignup?.id} as payment completed`)
    return
  }

  if (!partyName) {
    console.error("Missing required metadata in subscription:", metadata)
    throw new Error("Missing party_name in subscription metadata")
  }

  console.log(`Creating party "${partyName}" for user ${userId} via embedded payment`)

  await createPartyWithSubscription({
    partyName,
    gameType,
    userId,
    subscription,
  })

  console.log(`Successfully created party with subscription via embedded payment`)
}

/**
 * Handle invoice.payment_failed event.
 * Marks subscription as past_due.
 */
export async function handlePaymentFailed(invoice: Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice)

  if (!subscriptionId) {
    console.log("Invoice payment failed but no subscription attached")
    return
  }

  const supabase = getServiceClient()

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId)

  if (error) {
    console.error("Failed to mark subscription as past_due:", error)
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  console.log(`Marked subscription ${subscriptionId} as past_due due to payment failure`)
}
