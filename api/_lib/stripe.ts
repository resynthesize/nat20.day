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
      // Use SDK's default API version to ensure type compatibility
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

export interface CreateSubscriptionParams {
  partyName: string
  gameType: string
  userId: string
  userEmail: string
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

export interface SubscriptionWithClientSecret {
  subscriptionId: string
  clientSecret: string
  customerId: string
}

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
        expand: ["latest_invoice.payment_intent", "latest_invoice.payments.data.payment.payment_intent"],
      })

      // With default_incomplete, Stripe creates a PaymentIntent for collecting payment.
      // We need the client_secret to render the Payment Element on the frontend.
      // Note: Stripe's SDK doesn't infer types for expanded fields, so we use type guards.
      const invoice = subscription.latest_invoice
      if (typeof invoice === "string" || !invoice) {
        throw new Error("Invoice not expanded in subscription response")
      }

      // Debug: log invoice structure to understand 2025 API response
      const invoiceAny = invoice as unknown as Record<string, unknown>
      console.log("Invoice structure:", JSON.stringify({
        id: invoice.id,
        status: invoice.status,
        hasPaymentIntent: "payment_intent" in invoice,
        paymentIntentValue: invoiceAny.payment_intent,
        hasPayments: "payments" in invoice,
        paymentsData: invoiceAny.payments,
        confirmationSecret: invoice.confirmation_secret,
      }, null, 2))

      // Try multiple access patterns for the client_secret
      // Pattern 1: Direct payment_intent on invoice (older API)
      let clientSecret: string | undefined = (invoice as unknown as { payment_intent?: Stripe.PaymentIntent }).payment_intent?.client_secret ?? undefined

      // Pattern 2: Through payments array (newer 2025 API)
      if (!clientSecret && invoice.payments?.data?.[0]) {
        const payment = invoice.payments.data[0].payment
        const pi = payment?.payment_intent
        if (typeof pi !== "string" && pi?.client_secret) {
          clientSecret = pi.client_secret
        }
      }

      // Pattern 3: confirmation_secret (finalized invoices)
      if (!clientSecret && invoice.confirmation_secret?.client_secret) {
        clientSecret = invoice.confirmation_secret.client_secret
      }

      if (!clientSecret) {
        throw new Error("No payment intent created for subscription")
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
