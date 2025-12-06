/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * This endpoint uses Stripe signature verification (not standard API auth).
 *
 * Events handled:
 *   - checkout.session.completed: Create party + subscription after hosted checkout
 *   - invoice.paid: Create party + subscription after embedded payment
 *   - customer.subscription.updated: Update subscription status
 *   - customer.subscription.deleted: Mark subscription as canceled
 *   - invoice.payment_failed: Mark subscription as past_due
 */

import type { VercelRequest, VercelResponse } from "@vercel/node"
import { buffer } from "micro"
import { getStripeClient, getWebhookSecret } from "./_lib/stripe/client.js"
import { dispatchEvent } from "./_lib/stripe/registry.js"

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const stripe = getStripeClient()
  const signature = req.headers["stripe-signature"]

  if (!signature) {
    console.error("Missing stripe-signature header")
    res.status(400).json({ error: "Missing signature" })
    return
  }

  try {
    // Use micro's buffer() to read raw body - required for signature verification
    const rawBody = await buffer(req)
    const event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret())

    console.log(`Received Stripe webhook: ${event.type}`)
    await dispatchEvent(event)

    res.status(200).json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    const isSignatureError = error instanceof Error && error.message.includes("signature")
    res.status(isSignatureError ? 400 : 500).json({
      error: error instanceof Error ? error.message : "Webhook handler failed",
    })
  }
}

// Disable body parsing - we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}
