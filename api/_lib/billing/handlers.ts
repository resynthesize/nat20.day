/**
 * Billing API Handler Implementation
 *
 * This file implements billing endpoints using Effect HttpApiBuilder.
 * Follows the same patterns as handlers.ts for consistency.
 */

import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import {
  Nat20Api,
  CheckoutSession,
  SubscriptionPaymentIntent,
  PortalSession,
  CustomerSession,
  SetupIntent,
  SubscriptionCanceled,
  Subscription,
  NotFound,
  InternalError,
} from "../api.js"
import { getServiceClient } from "../supabase.js"
import {
  createCheckoutSession,
  createPortalSession,
  createCustomerSession,
  createSetupIntent,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  createSubscriptionWithPaymentIntent,
} from "../stripe/operations.js"
import { CurrentUser, AuthenticationLive, CurrentUserStub } from "../handlers/index.js"
import {
  requirePartyAdmin,
  requirePartyMember,
  getPartySubscription,
  getUserEmail,
} from "../helpers.js"

// ============================================================================
// Supabase Helper
// ============================================================================

const supabase = () => getServiceClient()

// ============================================================================
// Billing Handlers
// ============================================================================

export const BillingHandlers = HttpApiBuilder.group(Nat20Api, "billing", (handlers) =>
  handlers
    // POST /billing/checkout - Create Stripe Checkout session for new party
    .handle("createCheckout", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Get user's email from profile
        const { data: profile, error: profileError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("profiles")
              .select("id")
              .eq("id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (profileError || !profile) {
          return yield* Effect.fail(new InternalError({ message: "Profile not found" }))
        }

        // Get user email from auth
        const email = yield* getUserEmail(db, user.profileId)

        // Create Stripe Checkout session
        const session = yield* createCheckoutSession({
          partyName: payload.party_name,
          gameType: payload.game_type,
          userId: user.profileId,
          userEmail: email,
          successUrl: `${process.env.VITE_SUPABASE_URL ? "https://nat20.day" : "http://localhost:5173"}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${process.env.VITE_SUPABASE_URL ? "https://nat20.day" : "http://localhost:5173"}/app?checkout=canceled`,
        })

        return new CheckoutSession({
          checkout_url: session.url!,
          session_id: session.id,
        })
      })
    )

    // POST /billing/subscribe - Create Stripe Subscription for embedded payment
    .handle("createSubscription", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Get user's email from profile
        const { data: profile, error: profileError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("profiles")
              .select("id")
              .eq("id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (profileError || !profile) {
          return yield* Effect.fail(new InternalError({ message: "Profile not found" }))
        }

        // Get user email from auth
        const email = yield* getUserEmail(db, user.profileId)

        // Create Stripe Subscription with incomplete payment
        const result = yield* createSubscriptionWithPaymentIntent({
          partyName: payload.party_name,
          gameType: payload.game_type,
          userId: user.profileId,
          userEmail: email,
        })

        return new SubscriptionPaymentIntent({
          client_secret: result.clientSecret,
          subscription_id: result.subscriptionId,
        })
      })
    )

    // POST /billing/portal - Create Stripe Billing Portal session
    .handle("createPortal", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is an admin of this party
        yield* requirePartyAdmin(db, payload.party_id, user.profileId)

        // Get the subscription for this party
        const subscription = yield* getPartySubscription(db, payload.party_id)

        // Create Stripe Billing Portal session
        const returnUrl = `${process.env.VITE_SUPABASE_URL ? "https://nat20.day" : "http://localhost:5173"}/app/admin`
        const session = yield* createPortalSession(subscription.stripe_customer_id, returnUrl)

        return new PortalSession({
          portal_url: session.url,
        })
      })
    )

    // POST /billing/customer-session - Create Stripe Customer Session for embedded portal
    .handle("createCustomerSession", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is an admin of this party
        yield* requirePartyAdmin(db, payload.party_id, user.profileId)

        // Get the subscription for this party
        const subscription = yield* getPartySubscription(db, payload.party_id)

        // Create Stripe Customer Session for embedded portal
        const session = yield* createCustomerSession(subscription.stripe_customer_id)

        return new CustomerSession({
          client_secret: session.client_secret,
        })
      })
    )

    // GET /billing/subscription - Get subscription status for a party
    .handle("getSubscription", ({ urlParams }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is a member of this party
        yield* requirePartyMember(db, urlParams.party_id, user.profileId)

        // Check if this is a demo party (always "active")
        const { data: party, error: partyError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("parties")
              .select("is_demo")
              .eq("id", urlParams.party_id)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (partyError || !party) {
          return yield* Effect.fail(new NotFound({ message: "Party not found" }))
        }

        // Demo parties have a virtual "active" subscription
        if (party.is_demo) {
          return new Subscription({
            id: "demo",
            party_id: urlParams.party_id,
            status: "active",
            current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            cancel_at_period_end: false,
          })
        }

        // Get the subscription for this party
        const { data: subscription, error: subError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("subscriptions")
              .select("id, party_id, status, current_period_end, cancel_at_period_end")
              .eq("party_id", urlParams.party_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (subError || !subscription) {
          return yield* Effect.fail(new NotFound({ message: "No subscription found for this party" }))
        }

        return new Subscription({
          id: subscription.id,
          party_id: subscription.party_id,
          status: subscription.status as "active" | "past_due" | "canceled" | "expired",
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
      })
    )

    // POST /billing/setup-intent - Create SetupIntent for updating payment method
    .handle("createSetupIntent", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is an admin of this party
        yield* requirePartyAdmin(db, payload.party_id, user.profileId)

        // Get the subscription for this party
        const subscription = yield* getPartySubscription(db, payload.party_id)

        // Create Stripe SetupIntent
        const setupIntent = yield* createSetupIntent(subscription.stripe_customer_id)

        return new SetupIntent({
          client_secret: setupIntent.client_secret!,
        })
      })
    )

    // POST /billing/cancel - Cancel subscription at period end
    .handle("cancelSubscription", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is an admin of this party
        yield* requirePartyAdmin(db, payload.party_id, user.profileId)

        // Get the subscription for this party
        const subscription = yield* getPartySubscription(db, payload.party_id)

        // Cancel subscription at period end
        const updated = yield* cancelSubscriptionAtPeriodEnd(subscription.stripe_subscription_id)

        // Get current period end from subscription items
        const firstItem = updated.items?.data?.[0]
        const currentPeriodEnd = firstItem?.current_period_end ?? updated.created

        return new SubscriptionCanceled({
          cancel_at_period_end: updated.cancel_at_period_end,
          current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        })
      })
    )

    // POST /billing/reactivate - Reactivate a subscription scheduled for cancellation
    .handle("reactivateSubscription", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Verify user is an admin of this party
        yield* requirePartyAdmin(db, payload.party_id, user.profileId)

        // Get the subscription for this party
        const subscription = yield* getPartySubscription(db, payload.party_id)

        // Reactivate subscription
        const updated = yield* reactivateSubscription(subscription.stripe_subscription_id)

        // Get current period end from subscription items
        const firstItem = updated.items?.data?.[0]
        const currentPeriodEnd = firstItem?.current_period_end ?? updated.created

        return new SubscriptionCanceled({
          cancel_at_period_end: updated.cancel_at_period_end,
          current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        })
      })
    )
).pipe(Layer.provide([AuthenticationLive, CurrentUserStub]))
