/**
 * Signup API Handler Implementation
 *
 * Handles pre-auth signup flow:
 * 1. /signup/start - Create pending signup + Stripe subscription (no auth)
 * 2. /signup/complete - Finalize party creation (auth required)
 */

import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import Stripe from "stripe"
import {
  Nat20Api,
  SignupStartResponse,
  SignupCompleteResponse,
  NotFound,
  InternalError,
  InvalidInput,
  BillingError,
} from "../api.js"
import { getServiceClient } from "../supabase.js"
import { getStripeClient, getStripePriceId } from "../stripe/client.js"
import { CurrentUser, AuthenticationLive, CurrentUserStub } from "../handlers/index.js"

// ============================================================================
// Supabase Helper
// ============================================================================

const supabase = () => getServiceClient()

// ============================================================================
// Stripe Helper for Unauthenticated Signup
// ============================================================================

interface CreatePendingSubscriptionParams {
  email: string
  partyName: string
  gameType: string
}

interface PendingSubscriptionResult {
  customerId: string
  subscriptionId: string
  clientSecret: string
}

/**
 * Create a Stripe subscription without user_id for pending signups.
 * Similar to createSubscriptionWithPaymentIntent but no user association yet.
 */
const createPendingSubscription = (params: CreatePendingSubscriptionParams) =>
  Effect.tryPromise({
    try: async (): Promise<PendingSubscriptionResult> => {
      const stripe = getStripeClient()
      const priceId = getStripePriceId()

      // Check if customer exists or create new one
      const existingCustomers = await stripe.customers.list({
        email: params.email,
        limit: 1,
      })

      let customer: Stripe.Customer
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0]
      } else {
        customer = await stripe.customers.create({
          email: params.email,
          // No user_id yet - will be linked after OAuth
        })
      }

      // Create subscription with incomplete payment
      // Note: NO user_id in metadata - webhook will detect this as pending signup
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
          // Explicitly no user_id - this signals pending signup flow
        },
        expand: ["latest_invoice", "pending_setup_intent"],
      })

      // Get client_secret from PaymentIntent
      const invoice = subscription.latest_invoice
      if (typeof invoice === "string" || !invoice) {
        throw new Error("Invoice not expanded in subscription response")
      }

      const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id })
      const firstPayment = invoicePayments.data[0]

      if (!firstPayment?.payment?.payment_intent) {
        throw new Error("No payment found for invoice")
      }

      const paymentIntentId = firstPayment.payment.payment_intent
      if (typeof paymentIntentId !== "string") {
        throw new Error("PaymentIntent already expanded but missing ID")
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const clientSecret = paymentIntent.client_secret

      if (!clientSecret) {
        throw new Error("PaymentIntent has no client_secret")
      }

      return {
        customerId: customer.id,
        subscriptionId: subscription.id,
        clientSecret,
      }
    },
    catch: (error) => {
      console.error("Stripe pending subscription creation failed:", error)
      return new BillingError({
        message: error instanceof Error ? error.message : "Failed to create subscription",
      })
    },
  })

// ============================================================================
// Signup Handlers - Public (No Auth Required)
// ============================================================================

export const SignupPublicHandlers = HttpApiBuilder.group(Nat20Api, "signupPublic", (handlers) =>
  handlers
    // POST /signup/start - Create pending signup (no auth required)
    .handle("signupStart", ({ payload }) =>
      Effect.gen(function* () {
        const db = supabase()

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(payload.email)) {
          return yield* Effect.fail(new InvalidInput({ message: "Invalid email format" }))
        }

        // Check for existing pending signup with same email that's not completed
        const { data: existingSignup } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("pending_signups")
              .select("id, payment_completed, stripe_subscription_id")
              .eq("email", payload.email.toLowerCase())
              .is("profile_id", null)
              .gt("expires_at", new Date().toISOString())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        // If there's an existing pending signup with payment completed, return it
        if (existingSignup?.payment_completed) {
          return new SignupStartResponse({
            pending_signup_id: existingSignup.id,
            client_secret: "", // Empty - payment already done, proceed to OAuth
            payment_completed: true,
          })
        }

        // Create Stripe subscription
        const stripeResult = yield* createPendingSubscription({
          email: payload.email.toLowerCase(),
          partyName: payload.party_name,
          gameType: payload.game_type,
        })

        // Insert pending signup record
        const { data: pendingSignup, error: insertError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("pending_signups")
              .insert({
                email: payload.email.toLowerCase(),
                party_name: payload.party_name,
                game_type: payload.game_type,
                stripe_customer_id: stripeResult.customerId,
                stripe_subscription_id: stripeResult.subscriptionId,
              })
              .select("id")
              .single(),
          catch: () => new InternalError({ message: "Failed to create pending signup" }),
        })

        if (insertError || !pendingSignup) {
          return yield* Effect.fail(new InternalError({ message: "Failed to create pending signup" }))
        }

        return new SignupStartResponse({
          pending_signup_id: pendingSignup.id,
          client_secret: stripeResult.clientSecret,
          payment_completed: false,
        })
      })
    )
)

// ============================================================================
// Signup Handlers - Authenticated (Requires Auth)
// ============================================================================

export const SignupHandlers = HttpApiBuilder.group(Nat20Api, "signup", (handlers) =>
  handlers
    // POST /signup/complete - Finalize signup after OAuth (auth required)
    .handle("signupComplete", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Get pending signup
        const { data: pendingSignup, error: fetchError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("pending_signups")
              .select("*")
              .eq("id", payload.pending_signup_id)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (fetchError || !pendingSignup) {
          return yield* Effect.fail(new NotFound({ message: "Pending signup not found" }))
        }

        // Check if already completed
        if (pendingSignup.profile_id) {
          return yield* Effect.fail(new InvalidInput({ message: "Signup already completed" }))
        }

        // Check if payment completed
        if (!pendingSignup.payment_completed) {
          return yield* Effect.fail(new InvalidInput({ message: "Payment not completed" }))
        }

        // Check if expired
        if (new Date(pendingSignup.expires_at) < new Date()) {
          return yield* Effect.fail(new InvalidInput({ message: "Signup expired" }))
        }

        // Get user info from auth
        const { data: authData, error: authError } = yield* Effect.tryPromise({
          try: () => db.auth.admin.getUserById(user.profileId),
          catch: () => new InternalError({ message: "Failed to get user info" }),
        })

        if (authError || !authData.user) {
          return yield* Effect.fail(new InternalError({ message: "Failed to get user info" }))
        }

        const userName = authData.user.user_metadata?.full_name ||
                         authData.user.user_metadata?.name ||
                         authData.user.email?.split("@")[0] ||
                         "Adventurer"
        const userEmail = authData.user.email || pendingSignup.email

        // Get Stripe subscription to extract period dates
        const stripe = getStripeClient()
        const subscription: Stripe.Subscription = yield* Effect.tryPromise({
          try: () => stripe.subscriptions.retrieve(pendingSignup.stripe_subscription_id, {
            expand: ['items.data'],
          }),
          catch: () => new BillingError({ message: "Failed to retrieve subscription" }),
        })

        // Get current period from first subscription item (new Stripe API structure)
        const firstItem = subscription.items.data[0]
        const currentPeriodStart = firstItem?.current_period_start ?? subscription.created
        const currentPeriodEnd = firstItem?.current_period_end ?? (subscription.created + 365 * 24 * 60 * 60)

        // Create the party
        const { data: party, error: partyError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("parties")
              .insert({
                name: pendingSignup.party_name,
                game_type: pendingSignup.game_type,
              })
              .select("id, name")
              .single(),
          catch: () => new InternalError({ message: "Failed to create party" }),
        })

        if (partyError || !party) {
          return yield* Effect.fail(new InternalError({ message: "Failed to create party" }))
        }

        // Add user as party admin
        const { error: adminError } = yield* Effect.tryPromise({
          try: () =>
            db.from("party_admins").insert({
              party_id: party.id,
              profile_id: user.profileId,
            }),
          catch: () => new InternalError({ message: "Failed to add party admin" }),
        })

        if (adminError) {
          console.error("Failed to add party admin:", adminError)
        }

        // Add user as party member
        const { error: memberError } = yield* Effect.tryPromise({
          try: () =>
            db.from("party_members").insert({
              party_id: party.id,
              name: userName,
              email: userEmail,
              profile_id: user.profileId,
            }),
          catch: () => new InternalError({ message: "Failed to add party member" }),
        })

        if (memberError) {
          console.error("Failed to add party member:", memberError)
        }

        // Create subscription record
        const { error: subError } = yield* Effect.tryPromise({
          try: () =>
            db.from("subscriptions").insert({
              party_id: party.id,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: pendingSignup.stripe_customer_id,
              status: subscription.status === "active" ? "active" : "past_due",
              current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
              current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            }),
          catch: () => new InternalError({ message: "Failed to create subscription record" }),
        })

        if (subError) {
          console.error("Failed to create subscription:", subError)
        }

        // Update Stripe subscription metadata with user_id now that we know it
        yield* Effect.tryPromise({
          try: () =>
            stripe.subscriptions.update(subscription.id, {
              metadata: {
                party_name: pendingSignup.party_name,
                game_type: pendingSignup.game_type,
                user_id: user.profileId,
                party_id: party.id,
              },
            }),
          catch: () => new BillingError({ message: "Failed to update subscription metadata" }),
        })

        // Mark pending signup as completed
        yield* Effect.tryPromise({
          try: () =>
            db
              .from("pending_signups")
              .update({ profile_id: user.profileId })
              .eq("id", payload.pending_signup_id),
          catch: () => new InternalError({ message: "Failed to update pending signup" }),
        })

        return new SignupCompleteResponse({
          party_id: party.id,
          party_name: party.name,
        })
      })
    )
).pipe(Layer.provide([AuthenticationLive, CurrentUserStub]))
