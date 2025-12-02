/**
 * Stripe Client with Effect Wrappers
 *
 * Provides Effect-wrapped Stripe SDK operations for billing endpoints.
 * All Stripe API calls are wrapped in Effect.tryPromise for proper error handling.
 */

import Stripe from "stripe"
import { Effect } from "effect"
import { BillingError, ConfigError } from "./api.js"

// ============================================================================
// Stripe Client Initialization
// ============================================================================

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
      apiVersion: "2025-04-30.basil",
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
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set")
  }
  return secret
}

// ============================================================================
// Effect-Wrapped Stripe Operations
// ============================================================================

export interface CheckoutSessionParams {
  partyName: string
  gameType: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}

/**
 * Create a Stripe Checkout Session for a new party subscription.
 */
export const createCheckoutSession = (params: CheckoutSessionParams) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      const priceId = getStripePriceId()

      return await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.userEmail,
        metadata: {
          party_name: params.partyName,
          game_type: params.gameType,
          user_id: params.userId,
        },
        subscription_data: {
          metadata: {
            party_name: params.partyName,
            game_type: params.gameType,
            user_id: params.userId,
          },
        },
      })
    },
    catch: (error) => {
      console.error("Stripe checkout session creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create checkout session",
      })
    },
  })

/**
 * Create a Stripe Customer Portal session for subscription management.
 */
export const createPortalSession = (customerId: string, returnUrl: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      })
    },
    catch: (error) => {
      console.error("Stripe portal session creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create billing portal session",
      })
    },
  })

/**
 * Retrieve a Stripe Subscription by ID.
 */
export const getSubscription = (subscriptionId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.subscriptions.retrieve(subscriptionId)
    },
    catch: (error) => {
      console.error("Stripe subscription retrieval failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to retrieve subscription",
      })
    },
  })

/**
 * Retrieve a Stripe Customer by ID.
 */
export const getCustomer = (customerId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.customers.retrieve(customerId)
    },
    catch: (error) => {
      console.error("Stripe customer retrieval failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to retrieve customer",
      })
    },
  })

/**
 * Construct and verify a Stripe webhook event from the request.
 */
export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
) =>
  Effect.try({
    try: () => {
      const stripe = getStripeClient()
      const webhookSecret = getStripeWebhookSecret()
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    },
    catch: (error) => {
      console.error("Stripe webhook verification failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Webhook signature verification failed",
      })
    },
  })
