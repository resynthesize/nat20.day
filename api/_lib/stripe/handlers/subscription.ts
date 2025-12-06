/**
 * Subscription Webhook Handlers
 *
 * Handles customer.subscription.updated and customer.subscription.deleted events.
 */

import { getServiceClient } from "../../supabase.js"
import type { Subscription } from "../schemas.js"

type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired"

/**
 * Map Stripe subscription status to our database status.
 */
const statusMap: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "canceled",
}

/**
 * Handle customer.subscription.updated event.
 * Updates subscription status in our database.
 */
export async function handleSubscriptionUpdated(subscription: Subscription): Promise<void> {
  const supabase = getServiceClient()

  const status: SubscriptionStatus = statusMap[subscription.status] ?? "expired"

  // Get current period from first subscription item (new API structure)
  const firstItem = subscription.items?.data?.[0]
  const currentPeriodStart = firstItem?.current_period_start ?? subscription.created
  const currentPeriodEnd = firstItem?.current_period_end ?? (subscription.created + 365 * 24 * 60 * 60)

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)

  if (error) {
    console.error("Failed to update subscription:", error)
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  console.log(`Updated subscription ${subscription.id} to status ${status}`)
}

/**
 * Handle customer.subscription.deleted event.
 * Marks subscription as canceled.
 */
export async function handleSubscriptionDeleted(subscription: Subscription): Promise<void> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)

  if (error) {
    console.error("Failed to mark subscription as canceled:", error)
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  console.log(`Marked subscription ${subscription.id} as canceled`)
}
