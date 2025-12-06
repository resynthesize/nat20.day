/**
 * Stripe Client Initialization
 *
 * Provides lazy-initialized Stripe client and environment variable accessors.
 * Singleton pattern ensures we only create one client per process.
 */

import Stripe from "stripe"

let stripeInstance: Stripe | null = null

/**
 * Get or create the Stripe client instance.
 * Lazily initialized to avoid issues during module loading.
 */
export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set")
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    })
  }
  return stripeInstance
}

/**
 * Get the Stripe Price ID from environment.
 */
export function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID environment variable is not set")
  }
  return priceId
}

/**
 * Get the Stripe Webhook Secret from environment.
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set")
  }
  return secret
}
