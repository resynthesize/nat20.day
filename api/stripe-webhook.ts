/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * This endpoint does NOT use the standard Effect API authentication -
 * it uses Stripe signature verification instead.
 *
 * Events handled:
 *   - checkout.session.completed: Create party + subscription after successful payment
 *   - customer.subscription.updated: Update subscription status
 *   - customer.subscription.deleted: Mark subscription as canceled
 *   - invoice.payment_failed: Mark subscription as past_due
 */

import type { VercelRequest, VercelResponse } from "@vercel/node"
import Stripe from "stripe"
import { getServiceClient } from "./lib/supabase.js"

// Initialize Stripe client
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured")
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-04-30.basil",
  })
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured")
  }
  return secret
}

/**
 * Handle checkout.session.completed event
 * Creates the party and subscription after successful payment
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const supabase = getServiceClient()
  const metadata = session.metadata || {}

  const partyName = metadata.party_name
  const gameType = metadata.game_type || "dnd"
  const userId = metadata.user_id

  if (!partyName || !userId) {
    console.error("Missing required metadata in checkout session:", metadata)
    throw new Error("Missing party_name or user_id in checkout metadata")
  }

  console.log(`Creating party "${partyName}" for user ${userId}`)

  // Get subscription details from Stripe
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // 1. Create the party
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      name: partyName,
      game_type: gameType,
    })
    .select()
    .single()

  if (partyError || !party) {
    console.error("Failed to create party:", partyError)
    throw new Error(`Failed to create party: ${partyError?.message}`)
  }

  console.log(`Created party ${party.id}`)

  // 2. Add creator as admin
  const { error: adminError } = await supabase
    .from("party_admins")
    .insert({
      party_id: party.id,
      profile_id: userId,
    })

  if (adminError) {
    console.error("Failed to add admin:", adminError)
    // Clean up party
    await supabase.from("parties").delete().eq("id", party.id)
    throw new Error(`Failed to add admin: ${adminError.message}`)
  }

  // 3. Get user details for party member record
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const userName = authUser.user?.user_metadata?.full_name || authUser.user?.email || "Unknown"
  const userEmail = authUser.user?.email

  // 4. Add creator as party member
  const { error: memberError } = await supabase
    .from("party_members")
    .insert({
      party_id: party.id,
      name: userName,
      email: userEmail,
      profile_id: userId,
    })

  if (memberError) {
    console.error("Failed to add member:", memberError)
    // Clean up
    await supabase.from("party_admins").delete().eq("party_id", party.id)
    await supabase.from("parties").delete().eq("id", party.id)
    throw new Error(`Failed to add member: ${memberError.message}`)
  }

  // 5. Create subscription record
  const { error: subError } = await supabase
    .from("subscriptions")
    .insert({
      party_id: party.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status === "active" ? "active" : "past_due",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })

  if (subError) {
    console.error("Failed to create subscription:", subError)
    // Note: Don't clean up party here - they paid, so keep the party even if sub record fails
    // We can reconcile manually
    throw new Error(`Failed to create subscription record: ${subError.message}`)
  }

  console.log(`Successfully created party ${party.id} with subscription`)
}

/**
 * Handle customer.subscription.updated event
 * Updates subscription status in our database
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getServiceClient()

  // Map Stripe status to our status
  let status: "active" | "past_due" | "canceled" | "expired"
  switch (subscription.status) {
    case "active":
    case "trialing":
      status = "active"
      break
    case "past_due":
      status = "past_due"
      break
    case "canceled":
    case "unpaid":
      status = "canceled"
      break
    default:
      status = "expired"
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
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

/**
 * Handle invoice.payment_failed event
 * Marks subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription) {
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
    .eq("stripe_subscription_id", invoice.subscription as string)

  if (error) {
    console.error("Failed to mark subscription as past_due:", error)
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  console.log(`Marked subscription ${invoice.subscription} as past_due due to payment failure`)
}

/**
 * Vercel serverless function handler for Stripe webhooks
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const stripe = getStripe()
  const webhookSecret = getWebhookSecret()

  // Get the signature from headers
  const signature = req.headers["stripe-signature"]
  if (!signature) {
    console.error("Missing stripe-signature header")
    res.status(400).json({ error: "Missing signature" })
    return
  }

  // Verify and construct the event
  let event: Stripe.Event
  try {
    // For Vercel serverless functions, we need to read the raw body
    // The body comes as a Buffer when bodyParser is disabled via vercel.json
    let rawBody: string
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8")
    } else if (typeof req.body === "string") {
      rawBody = req.body
    } else {
      // If body is already parsed, re-stringify it (less secure, but functional)
      rawBody = JSON.stringify(req.body)
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    res.status(400).json({ error: "Invalid signature" })
    return
  }

  console.log(`Received Stripe webhook: ${event.type}`)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === "subscription" && session.subscription) {
          await handleCheckoutCompleted(session)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error("Error handling webhook:", error)
    // Return 500 so Stripe will retry
    res.status(500).json({ error: "Webhook handler failed" })
  }
}

// Disable body parsing - we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}
