/**
 * Stripe Operations
 *
 * Effect-wrapped Stripe SDK operations for billing endpoints.
 * All Stripe API calls are wrapped in Effect.tryPromise for proper error handling.
 */

import Stripe from "stripe"
import { Effect } from "effect"
import { BillingError } from "../api.js"
import { getStripeClient, getStripePriceId } from "./client.js"

// ============================================================================
// Types
// ============================================================================

export interface CheckoutSessionParams {
  partyName: string
  gameType: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}

export interface CreateSubscriptionParams {
  partyName: string
  gameType: string
  userId: string
  userEmail: string
}

export interface SubscriptionWithClientSecret {
  subscriptionId: string
  clientSecret: string
  customerId: string
}

// ============================================================================
// Checkout & Portal Operations
// ============================================================================

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
 * (Legacy - redirects to hosted portal)
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
 * Create a Stripe Customer Session for embedded portal.
 * Returns a client_secret for rendering the embedded customer portal.
 */
export const createCustomerSession = (customerId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.customerSessions.create({
        customer: customerId,
        components: {
          pricing_table: { enabled: false },
          payment_element: { enabled: true },
          buy_button: { enabled: false },
        },
      })
    },
    catch: (error) => {
      console.error("Stripe customer session creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create customer session",
      })
    },
  })

// ============================================================================
// Subscription Operations
// ============================================================================

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
 * Cancel a subscription at period end.
 */
export const cancelSubscriptionAtPeriodEnd = (subscriptionId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
    },
    catch: (error) => {
      console.error("Stripe subscription cancellation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to cancel subscription",
      })
    },
  })

/**
 * Reactivate a subscription that was set to cancel at period end.
 */
export const reactivateSubscription = (subscriptionId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      })
    },
    catch: (error) => {
      console.error("Stripe subscription reactivation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to reactivate subscription",
      })
    },
  })

/**
 * Create a Stripe Subscription with incomplete payment status.
 * This returns a client_secret for the frontend to use with Payment Element.
 *
 * Flow:
 * 1. Create or find customer by email
 * 2. Create subscription with payment_behavior: 'default_incomplete'
 * 3. Return client_secret from the subscription's first invoice payment intent
 */
export const createSubscriptionWithPaymentIntent = (params: CreateSubscriptionParams) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      const priceId = getStripePriceId()

      // First, check if customer exists or create new one
      const existingCustomers = await stripe.customers.list({
        email: params.userEmail,
        limit: 1,
      })

      let customer: Stripe.Customer
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0]
      } else {
        customer = await stripe.customers.create({
          email: params.userEmail,
          metadata: {
            user_id: params.userId,
          },
        })
      }

      // Create subscription with incomplete payment - this allows us to
      // collect payment details via embedded Payment Element
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        metadata: {
          party_name: params.partyName,
          game_type: params.gameType,
          user_id: params.userId,
        },
        expand: ["latest_invoice", "pending_setup_intent"],
      })

      // With default_incomplete, Stripe creates a PaymentIntent for collecting payment.
      const invoice = subscription.latest_invoice
      if (typeof invoice === "string" || !invoice) {
        throw new Error("Invoice not expanded in subscription response")
      }

      // In 2025 Stripe API, PaymentIntent is accessed via invoicePayments endpoint
      const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id })
      const firstPayment = invoicePayments.data[0]

      if (!firstPayment?.payment?.payment_intent) {
        throw new Error("No payment found for invoice")
      }

      const paymentIntentId = firstPayment.payment.payment_intent
      if (typeof paymentIntentId !== "string") {
        throw new Error("PaymentIntent already expanded but missing ID")
      }

      // Retrieve full PaymentIntent to get client_secret
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const clientSecret = paymentIntent.client_secret

      if (!clientSecret) {
        throw new Error("PaymentIntent has no client_secret")
      }

      return {
        subscriptionId: subscription.id,
        clientSecret,
        customerId: customer.id,
      } satisfies SubscriptionWithClientSecret
    },
    catch: (error) => {
      console.error("Stripe subscription creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create subscription",
      })
    },
  })

// ============================================================================
// Payment Operations
// ============================================================================

/**
 * Create a SetupIntent for updating payment method.
 * Returns a client_secret for the Payment Element.
 */
export const createSetupIntent = (customerId: string) =>
  Effect.tryPromise({
    try: async () => {
      const stripe = getStripeClient()
      return await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      })
    },
    catch: (error) => {
      console.error("Stripe SetupIntent creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create setup intent",
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
