/**
 * Stripe Webhook Event Schemas
 *
 * Effect Schema definitions for Stripe webhook event objects.
 * These provide runtime validation for webhook payloads.
 */

import { Schema, Option } from "effect"

// ============================================================================
// Checkout Session Schema
// ============================================================================

/**
 * Schema for Stripe Checkout Session from webhook event.data.object
 * Only defines fields we actually use for type safety.
 */
export const CheckoutSessionSchema = Schema.Struct({
  object: Schema.Literal("checkout.session"),
  id: Schema.String,
  mode: Schema.String,
  subscription: Schema.NullOr(Schema.Union(
    Schema.String,
    Schema.Struct({ id: Schema.String })
  )),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})

export type CheckoutSession = Schema.Schema.Type<typeof CheckoutSessionSchema>

// ============================================================================
// Subscription Schema
// ============================================================================

const SubscriptionItemSchema = Schema.Struct({
  current_period_start: Schema.optional(Schema.Number),
  current_period_end: Schema.optional(Schema.Number),
})

export const SubscriptionSchema = Schema.Struct({
  object: Schema.Literal("subscription"),
  id: Schema.String,
  status: Schema.String,
  customer: Schema.Union(
    Schema.String,
    Schema.Struct({ id: Schema.String })
  ),
  created: Schema.Number,
  cancel_at_period_end: Schema.Boolean,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  items: Schema.optional(Schema.Struct({
    data: Schema.Array(SubscriptionItemSchema),
  })),
})

export type Subscription = Schema.Schema.Type<typeof SubscriptionSchema>

// ============================================================================
// Invoice Schema
// ============================================================================

export const InvoiceSchema = Schema.Struct({
  object: Schema.Literal("invoice"),
  id: Schema.String,
  billing_reason: Schema.NullOr(Schema.String),
  parent: Schema.optional(Schema.NullOr(Schema.Struct({
    subscription_details: Schema.optional(Schema.NullOr(Schema.Struct({
      subscription: Schema.optional(Schema.NullOr(Schema.Union(
        Schema.String,
        Schema.Struct({ id: Schema.String })
      ))),
    }))),
  }))),
})

export type Invoice = Schema.Schema.Type<typeof InvoiceSchema>

// ============================================================================
// Decoders - parse unknown data with runtime validation
// ============================================================================

export function decodeCheckoutSession(obj: unknown): Option.Option<CheckoutSession> {
  return Schema.decodeUnknownOption(CheckoutSessionSchema)(obj)
}

export function decodeSubscription(obj: unknown): Option.Option<Subscription> {
  return Schema.decodeUnknownOption(SubscriptionSchema)(obj)
}

export function decodeInvoice(obj: unknown): Option.Option<Invoice> {
  return Schema.decodeUnknownOption(InvoiceSchema)(obj)
}

// ============================================================================
// Helper Functions for Stripe Union Fields
// ============================================================================

/**
 * Get customer ID from a Stripe customer field (can be string or expanded object)
 */
export function getCustomerId(customer: string | { id: string }): string {
  return typeof customer === "string" ? customer : customer.id
}

/**
 * Get subscription ID from a Stripe subscription field (can be string or expanded object)
 */
export function getSubscriptionId(subscription: string | { id: string }): string {
  return typeof subscription === "string" ? subscription : subscription.id
}

/**
 * Extract subscription ID from invoice parent structure
 */
export function getInvoiceSubscriptionId(invoice: Invoice): string | undefined {
  const sub = invoice.parent?.subscription_details?.subscription
  if (!sub) return undefined
  return typeof sub === "string" ? sub : sub.id
}
