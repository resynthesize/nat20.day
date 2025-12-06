/**
 * Stripe Webhook Event Registry
 *
 * Declarative handler registry for Stripe webhook events.
 * Maps event types to their schemas and handlers with optional guards.
 */

import { Schema, Option } from "effect"
import type Stripe from "stripe"
import {
  CheckoutSessionSchema,
  SubscriptionSchema,
  InvoiceSchema,
  type CheckoutSession,
  type Subscription,
  type Invoice,
} from "./schemas.js"
import { handleCheckoutCompleted } from "./handlers/checkout.js"
import { handleSubscriptionUpdated, handleSubscriptionDeleted } from "./handlers/subscription.js"
import { handleInvoicePaid, handlePaymentFailed } from "./handlers/invoice.js"

// ============================================================================
// Event Handlers
// ============================================================================

const checkoutHandler = {
  decode: (obj: unknown) => Schema.decodeUnknownOption(CheckoutSessionSchema)(obj),
  handle: handleCheckoutCompleted,
  guard: (s: CheckoutSession) => s.mode === "subscription" && !!s.subscription,
}

const subscriptionUpdatedHandler = {
  decode: (obj: unknown) => Schema.decodeUnknownOption(SubscriptionSchema)(obj),
  handle: handleSubscriptionUpdated,
}

const subscriptionDeletedHandler = {
  decode: (obj: unknown) => Schema.decodeUnknownOption(SubscriptionSchema)(obj),
  handle: handleSubscriptionDeleted,
}

const invoicePaidHandler = {
  decode: (obj: unknown) => Schema.decodeUnknownOption(InvoiceSchema)(obj),
  handle: handleInvoicePaid,
}

const invoicePaymentFailedHandler = {
  decode: (obj: unknown) => Schema.decodeUnknownOption(InvoiceSchema)(obj),
  handle: handlePaymentFailed,
}

// ============================================================================
// Event Dispatcher
// ============================================================================

/**
 * Dispatch a Stripe webhook event to its handler.
 *
 * 1. Match event type
 * 2. Decode event data using schema
 * 3. Check guard condition (if any)
 * 4. Call handler
 */
export async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const decoded = checkoutHandler.decode(event.data.object)
      if (Option.isNone(decoded)) {
        console.error("Invalid checkout.session object - schema validation failed")
        return
      }
      if (!checkoutHandler.guard(decoded.value)) {
        console.log("Skipping checkout.session.completed - guard condition not met")
        return
      }
      await checkoutHandler.handle(decoded.value)
      return
    }

    case "customer.subscription.updated": {
      const decoded = subscriptionUpdatedHandler.decode(event.data.object)
      if (Option.isNone(decoded)) {
        console.error("Invalid subscription object - schema validation failed")
        return
      }
      await subscriptionUpdatedHandler.handle(decoded.value)
      return
    }

    case "customer.subscription.deleted": {
      const decoded = subscriptionDeletedHandler.decode(event.data.object)
      if (Option.isNone(decoded)) {
        console.error("Invalid subscription object - schema validation failed")
        return
      }
      await subscriptionDeletedHandler.handle(decoded.value)
      return
    }

    case "invoice.paid": {
      const decoded = invoicePaidHandler.decode(event.data.object)
      if (Option.isNone(decoded)) {
        console.error("Invalid invoice object - schema validation failed")
        return
      }
      await invoicePaidHandler.handle(decoded.value)
      return
    }

    case "invoice.payment_failed": {
      const decoded = invoicePaymentFailedHandler.decode(event.data.object)
      if (Option.isNone(decoded)) {
        console.error("Invalid invoice object - schema validation failed")
        return
      }
      await invoicePaymentFailedHandler.handle(decoded.value)
      return
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }
}
