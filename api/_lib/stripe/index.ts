/**
 * Stripe Module
 *
 * Re-exports all Stripe-related functionality for easy imports.
 */

// Client
export { getStripeClient, getStripePriceId, getWebhookSecret } from "./client.js"

// Operations (Effect-wrapped API calls)
export {
  createCheckoutSession,
  createPortalSession,
  createCustomerSession,
  createSetupIntent,
  getSubscription,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  createSubscriptionWithPaymentIntent,
  getCustomer,
  type CheckoutSessionParams,
  type CreateSubscriptionParams,
  type SubscriptionWithClientSecret,
} from "./operations.js"

// Schemas
export {
  CheckoutSessionSchema,
  SubscriptionSchema,
  InvoiceSchema,
  decodeCheckoutSession,
  decodeSubscription,
  decodeInvoice,
  getCustomerId,
  getSubscriptionId,
  getInvoiceSubscriptionId,
  type CheckoutSession,
  type Subscription,
  type Invoice,
} from "./schemas.js"

// Party creation
export { createPartyWithSubscription, type CreatePartyParams, type CreatePartyResult } from "./party.js"

// Webhook registry
export { dispatchEvent } from "./registry.js"

// Handlers (for direct use if needed)
export { handleCheckoutCompleted } from "./handlers/checkout.js"
export { handleSubscriptionUpdated, handleSubscriptionDeleted } from "./handlers/subscription.js"
export { handleInvoicePaid, handlePaymentFailed } from "./handlers/invoice.js"
