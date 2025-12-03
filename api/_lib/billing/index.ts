/**
 * Billing Module Index
 *
 * Re-exports billing handlers and Stripe utilities.
 */

export { BillingHandlers } from "./handlers.js"
export {
  // Stripe client
  getStripeClient,
  getStripePriceId,
  getStripeWebhookSecret,
  // Effect-wrapped operations
  createCheckoutSession,
  createPortalSession,
  createCustomerSession,
  getSubscription,
  createSetupIntent,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  getCustomer,
  constructWebhookEvent,
  createSubscriptionWithPaymentIntent,
  // Types
  type CheckoutSessionParams,
  type CreateSubscriptionParams,
  type SubscriptionWithClientSecret,
} from "./stripe.js"
