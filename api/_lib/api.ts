/**
 * nat20.day API Definition
 *
 * This file defines the complete API contract using Effect HttpApi.
 * Schemas defined here are the single source of truth for:
 * - Request/response validation
 * - TypeScript types
 * - OpenAPI documentation generation
 */

import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSecurity, OpenApi } from "@effect/platform"
import { Context, Schema } from "effect"

// ============================================================================
// Response Schemas
// ============================================================================

/** User profile returned by /me endpoint */
export class Profile extends Schema.Class<Profile>("Profile")({
  id: Schema.String.annotations({ description: "User's unique identifier (UUID)" }),
  display_name: Schema.String.annotations({ description: "User's display name" }),
  avatar_url: Schema.NullOr(Schema.String).annotations({ description: "URL to user's avatar image" }),
  created_at: Schema.String.annotations({ description: "ISO 8601 timestamp of profile creation" }),
}) {}

/** Party (D&D group) information */
export class Party extends Schema.Class<Party>("Party")({
  id: Schema.String.annotations({ description: "Party's unique identifier (UUID)" }),
  name: Schema.String.annotations({ description: "Name of the D&D party" }),
  created_at: Schema.String.annotations({ description: "ISO 8601 timestamp of party creation" }),
}) {}

/** Party member with profile info */
export class PartyMember extends Schema.Class<PartyMember>("PartyMember")({
  id: Schema.String.annotations({ description: "Party member's unique identifier" }),
  name: Schema.String.annotations({ description: "Character or player name" }),
  profile_id: Schema.NullOr(Schema.String).annotations({ description: "Linked user profile ID, if any" }),
  display_name: Schema.String.annotations({ description: "Display name from profile or member name" }),
}) {}

/** Availability record for a party member on a specific date */
export class Availability extends Schema.Class<Availability>("Availability")({
  id: Schema.String.annotations({ description: "Availability record ID" }),
  party_member_id: Schema.String.annotations({ description: "Party member this availability belongs to" }),
  date: Schema.String.annotations({ description: "Date in YYYY-MM-DD format" }),
  available: Schema.Boolean.annotations({ description: "Whether the member is available on this date" }),
  updated_at: Schema.String.annotations({ description: "ISO 8601 timestamp of last update" }),
}) {}

/** Party availability grid with members and their availability */
export class PartyAvailability extends Schema.Class<PartyAvailability>("PartyAvailability")({
  party_id: Schema.String.annotations({ description: "The party this availability data belongs to" }),
  members: Schema.Array(PartyMember).annotations({ description: "List of party members" }),
  availability: Schema.Array(Availability).annotations({ description: "Availability records for all members" }),
}) {}

/** Response after setting availability */
export class AvailabilitySet extends Schema.Class<AvailabilitySet>("AvailabilitySet")({
  party_member_id: Schema.String,
  date: Schema.String,
  available: Schema.Boolean,
}) {}

/** Response after deleting availability */
export class AvailabilityDeleted extends Schema.Class<AvailabilityDeleted>("AvailabilityDeleted")({
  deleted: Schema.Literal(true),
}) {}

// ============================================================================
// Request Schemas
// ============================================================================

/** Request body for setting availability */
export class SetAvailabilityBody extends Schema.Class<SetAvailabilityBody>("SetAvailabilityBody")({
  available: Schema.Boolean.annotations({
    description: "Whether the member is available on this date",
    examples: [true, false],
  }),
}) {}

/** Query parameters for getting party availability */
export class AvailabilityQueryParams extends Schema.Class<AvailabilityQueryParams>("AvailabilityQueryParams")({
  from: Schema.optionalWith(Schema.String, { default: () => new Date().toISOString().split('T')[0] }).annotations({
    description: "Start date for availability query (YYYY-MM-DD). Defaults to today.",
  }),
  to: Schema.optional(Schema.String).annotations({
    description: "End date for availability query (YYYY-MM-DD). If omitted, returns all future dates.",
  }),
}) {}

// ============================================================================
// Billing Schemas
// ============================================================================

/** Game type enum for party categorization */
export const GameType = Schema.Literal("dnd", "mtg", "warhammer", "boardgames", "other")
export type GameType = typeof GameType.Type

/** Subscription status enum */
export const SubscriptionStatus = Schema.Literal("active", "past_due", "canceled", "expired")
export type SubscriptionStatus = typeof SubscriptionStatus.Type

/** Subscription information */
export class Subscription extends Schema.Class<Subscription>("Subscription")({
  id: Schema.String.annotations({ description: "Subscription ID" }),
  party_id: Schema.String.annotations({ description: "Party this subscription belongs to" }),
  status: SubscriptionStatus.annotations({ description: "Current subscription status" }),
  current_period_end: Schema.String.annotations({ description: "ISO 8601 timestamp when current period ends" }),
  cancel_at_period_end: Schema.Boolean.annotations({ description: "Whether subscription cancels at period end" }),
}) {}

/** Request body for creating a checkout session */
export class CreateCheckoutBody extends Schema.Class<CreateCheckoutBody>("CreateCheckoutBody")({
  party_name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)).annotations({
    description: "Name for the new party",
    examples: ["The Dungeon Delvers"],
  }),
  game_type: Schema.optionalWith(GameType, { default: () => "dnd" as const }).annotations({
    description: "Type of tabletop game",
  }),
}) {}

/** Response from checkout session creation */
export class CheckoutSession extends Schema.Class<CheckoutSession>("CheckoutSession")({
  checkout_url: Schema.String.annotations({ description: "URL to redirect user to Stripe Checkout" }),
  session_id: Schema.String.annotations({ description: "Stripe Checkout Session ID" }),
}) {}

/** Response from subscription creation for embedded payment */
export class SubscriptionPaymentIntent extends Schema.Class<SubscriptionPaymentIntent>("SubscriptionPaymentIntent")({
  client_secret: Schema.String.annotations({ description: "Client secret for Payment Element confirmation" }),
  subscription_id: Schema.String.annotations({ description: "Stripe Subscription ID" }),
}) {}

/** Request body for creating a billing portal session */
export class CreatePortalBody extends Schema.Class<CreatePortalBody>("CreatePortalBody")({
  party_id: Schema.String.annotations({ description: "Party ID to manage billing for" }),
}) {}

/** Response from billing portal session creation */
export class PortalSession extends Schema.Class<PortalSession>("PortalSession")({
  portal_url: Schema.String.annotations({ description: "URL to redirect user to Stripe Billing Portal" }),
}) {}

/** Response from customer session creation for embedded portal */
export class CustomerSession extends Schema.Class<CustomerSession>("CustomerSession")({
  client_secret: Schema.String.annotations({ description: "Client secret for embedded portal" }),
}) {}

/** Response from setup intent creation for updating payment method */
export class SetupIntent extends Schema.Class<SetupIntent>("SetupIntent")({
  client_secret: Schema.String.annotations({ description: "Client secret for Payment Element" }),
}) {}

/** Response from subscription cancellation */
export class SubscriptionCanceled extends Schema.Class<SubscriptionCanceled>("SubscriptionCanceled")({
  cancel_at_period_end: Schema.Boolean.annotations({ description: "Whether cancellation is scheduled" }),
  current_period_end: Schema.String.annotations({ description: "When access expires" }),
}) {}

/** Query params for getting subscription */
export class SubscriptionQueryParams extends Schema.Class<SubscriptionQueryParams>("SubscriptionQueryParams")({
  party_id: Schema.String.annotations({ description: "Party ID to get subscription for" }),
}) {}

// ============================================================================
// Signup Schemas (Pre-auth flow)
// ============================================================================

/** Request body for starting a signup (no auth required) */
export class SignupStartBody extends Schema.Class<SignupStartBody>("SignupStartBody")({
  email: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: "Email address for the new user",
    examples: ["adventurer@example.com"],
  }),
  party_name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)).annotations({
    description: "Name for the new party",
    examples: ["The Dungeon Delvers"],
  }),
  game_type: Schema.optionalWith(GameType, { default: () => "dnd" as const }).annotations({
    description: "Type of tabletop game",
  }),
}) {}

/** Response from starting a signup */
export class SignupStartResponse extends Schema.Class<SignupStartResponse>("SignupStartResponse")({
  pending_signup_id: Schema.String.annotations({ description: "ID to use for completing signup after OAuth" }),
  client_secret: Schema.String.annotations({ description: "Stripe client_secret for Payment Element (empty if payment already completed)" }),
  payment_completed: Schema.Boolean.annotations({ description: "Whether payment has already been completed" }),
}) {}

/** Request body for completing a signup (auth required) */
export class SignupCompleteBody extends Schema.Class<SignupCompleteBody>("SignupCompleteBody")({
  pending_signup_id: Schema.String.annotations({
    description: "ID from signupStart response",
  }),
}) {}

/** Response from completing a signup */
export class SignupCompleteResponse extends Schema.Class<SignupCompleteResponse>("SignupCompleteResponse")({
  party_id: Schema.String.annotations({ description: "ID of the created party" }),
  party_name: Schema.String.annotations({ description: "Name of the created party" }),
}) {}

// ============================================================================
// Error Schemas
// ============================================================================

/** Error when authentication fails or token is invalid */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 401
}

/** Error when user lacks permission to access a resource */
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 403
}

/** Error when requested resource doesn't exist */
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 404
}

/** Error when request body is invalid */
export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 400
}

/** Internal server error */
export class InternalError extends Schema.TaggedError<InternalError>()("InternalError", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 500
}

/** Billing-related error */
export class BillingError extends Schema.TaggedError<BillingError>()("BillingError", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 402
}

/** Configuration error */
export class ConfigError extends Schema.TaggedError<ConfigError>()("ConfigError", {
  message: Schema.String.annotations({ description: "Error description" }),
}) {
  static readonly status = 500
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/** Current authenticated user context */
export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  { profileId: string }
>() {}

/** Bearer token security scheme */
const bearerSecurity = HttpApiSecurity.bearer

/** Authentication middleware that validates tokens and provides CurrentUser */
export class Authentication extends HttpApiMiddleware.Tag<Authentication>()(
  "Authentication",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: { bearer: bearerSecurity },
  }
) {}

/** Session-only authentication - rejects API tokens, only allows Supabase JWTs */
export class SessionAuthentication extends HttpApiMiddleware.Tag<SessionAuthentication>()(
  "SessionAuthentication",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: { bearer: bearerSecurity },
  }
) {}

// ============================================================================
// Endpoint Definitions
// ============================================================================

// ── User Endpoints ──────────────────────────────────────────────────────────

const getMe = HttpApiEndpoint.get("getMe", "/me")
  .addSuccess(Profile)
  .addError(Unauthorized, { status: 401 })
  .annotate(OpenApi.Summary, "Get current user profile")
  .annotate(OpenApi.Description, "Returns the profile of the authenticated user.")

const getParties = HttpApiEndpoint.get("getParties", "/parties")
  .addSuccess(Schema.Array(Party))
  .addError(Unauthorized, { status: 401 })
  .annotate(OpenApi.Summary, "List user's parties")
  .annotate(OpenApi.Description, "Returns all D&D parties where the authenticated user is a member.")

// ── Availability Endpoints ──────────────────────────────────────────────────

const getPartyAvailability = HttpApiEndpoint.get("getPartyAvailability", "/parties/:partyId/availability")
  .setPath(Schema.Struct({
    partyId: Schema.String.annotations({ description: "Party ID (UUID)" }),
  }))
  .setUrlParams(AvailabilityQueryParams)
  .addSuccess(PartyAvailability)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .annotate(OpenApi.Summary, "Get party availability")
  .annotate(OpenApi.Description, "Returns the availability grid for all members of a party. Use the `from` and `to` query parameters to filter by date range.")

const setAvailability = HttpApiEndpoint.put("setAvailability", "/availability/:memberId/:date")
  .setPath(Schema.Struct({
    memberId: Schema.String.annotations({ description: "Party member ID (UUID)" }),
    date: Schema.String.annotations({ description: "Date in YYYY-MM-DD format" }),
  }))
  .setPayload(SetAvailabilityBody)
  .addSuccess(AvailabilitySet)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(InvalidInput, { status: 400 })
  .annotate(OpenApi.Summary, "Set availability")
  .annotate(OpenApi.Description, "Sets the availability for a party member on a specific date. You must be the member or a party admin.")

const deleteAvailability = HttpApiEndpoint.del("deleteAvailability", "/availability/:memberId/:date")
  .setPath(Schema.Struct({
    memberId: Schema.String.annotations({ description: "Party member ID (UUID)" }),
    date: Schema.String.annotations({ description: "Date in YYYY-MM-DD format" }),
  }))
  .addSuccess(AvailabilityDeleted)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .annotate(OpenApi.Summary, "Clear availability")
  .annotate(OpenApi.Description, "Removes the availability record for a party member on a specific date. You must be the member or a party admin.")

// ── Billing Endpoints ──────────────────────────────────────────────────────

const createCheckout = HttpApiEndpoint.post("createCheckout", "/billing/checkout")
  .setPayload(CreateCheckoutBody)
  .addSuccess(CheckoutSession)
  .addError(Unauthorized, { status: 401 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Create checkout session")
  .annotate(OpenApi.Description, "Creates a Stripe Checkout session for a new party subscription. Redirect the user to the returned URL to complete payment.")

const createSubscription = HttpApiEndpoint.post("createSubscription", "/billing/subscribe")
  .setPayload(CreateCheckoutBody)
  .addSuccess(SubscriptionPaymentIntent)
  .addError(Unauthorized, { status: 401 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Create subscription for embedded payment")
  .annotate(OpenApi.Description, "Creates a Stripe Subscription with incomplete payment status. Returns a client_secret for use with the embedded Payment Element.")

const createPortal = HttpApiEndpoint.post("createPortal", "/billing/portal")
  .setPayload(CreatePortalBody)
  .addSuccess(PortalSession)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Create billing portal session")
  .annotate(OpenApi.Description, "Creates a Stripe Billing Portal session for managing an existing subscription. You must be an admin of the party.")

const createCustomerSession = HttpApiEndpoint.post("createCustomerSession", "/billing/customer-session")
  .setPayload(CreatePortalBody)
  .addSuccess(CustomerSession)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Create customer session for embedded portal")
  .annotate(OpenApi.Description, "Creates a Stripe Customer Session for rendering the embedded billing portal. You must be an admin of the party.")

const getSubscription = HttpApiEndpoint.get("getSubscription", "/billing/subscription")
  .setUrlParams(SubscriptionQueryParams)
  .addSuccess(Subscription)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .annotate(OpenApi.Summary, "Get subscription status")
  .annotate(OpenApi.Description, "Returns the subscription status for a party. You must be a member of the party.")

const createSetupIntent = HttpApiEndpoint.post("createSetupIntent", "/billing/setup-intent")
  .setPayload(CreatePortalBody)
  .addSuccess(SetupIntent)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Create setup intent for payment method update")
  .annotate(OpenApi.Description, "Creates a Stripe SetupIntent for updating the payment method. Returns a client_secret for the Payment Element.")

const cancelSubscription = HttpApiEndpoint.post("cancelSubscription", "/billing/cancel")
  .setPayload(CreatePortalBody)
  .addSuccess(SubscriptionCanceled)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Cancel subscription")
  .annotate(OpenApi.Description, "Schedules the subscription to cancel at the end of the current billing period.")

const reactivateSubscription = HttpApiEndpoint.post("reactivateSubscription", "/billing/reactivate")
  .setPayload(CreatePortalBody)
  .addSuccess(SubscriptionCanceled)
  .addError(Unauthorized, { status: 401 })
  .addError(Forbidden, { status: 403 })
  .addError(NotFound, { status: 404 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Reactivate subscription")
  .annotate(OpenApi.Description, "Removes the scheduled cancellation so the subscription will renew.")

// ── Signup Endpoints (Pre-auth flow) ────────────────────────────────────────

const signupStart = HttpApiEndpoint.post("signupStart", "/signup/start")
  .setPayload(SignupStartBody)
  .addSuccess(SignupStartResponse)
  .addError(InvalidInput, { status: 400 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Start signup flow")
  .annotate(OpenApi.Description, "Creates a pending signup with Stripe subscription. Returns client_secret for payment. No authentication required.")

const signupComplete = HttpApiEndpoint.post("signupComplete", "/signup/complete")
  .setPayload(SignupCompleteBody)
  .addSuccess(SignupCompleteResponse)
  .addError(Unauthorized, { status: 401 })
  .addError(NotFound, { status: 404 })
  .addError(InvalidInput, { status: 400 })
  .addError(BillingError, { status: 402 })
  .annotate(OpenApi.Summary, "Complete signup flow")
  .annotate(OpenApi.Description, "Finalizes party creation after OAuth. Requires authentication.")

// ============================================================================
// API Groups
// ============================================================================

const userGroup = HttpApiGroup.make("user")
  .add(getMe)
  .add(getParties)
  .middleware(Authentication)
  .annotate(OpenApi.Title, "User")

const availabilityGroup = HttpApiGroup.make("availability")
  .add(getPartyAvailability)
  .add(setAvailability)
  .add(deleteAvailability)
  .middleware(Authentication)
  .annotate(OpenApi.Title, "Availability")

const billingGroup = HttpApiGroup.make("billing")
  .add(createCheckout)
  .add(createSubscription)
  .add(createPortal)
  .add(createCustomerSession)
  .add(createSetupIntent)
  .add(cancelSubscription)
  .add(reactivateSubscription)
  .add(getSubscription)
  .middleware(SessionAuthentication)
  .annotate(OpenApi.Title, "Billing")

// Signup group: signupStart is unauthenticated
const signupPublicGroup = HttpApiGroup.make("signupPublic")
  .add(signupStart)
  .annotate(OpenApi.Title, "Signup")

// Signup completion requires session authentication (no API tokens)
const signupGroup = HttpApiGroup.make("signup")
  .add(signupComplete)
  .middleware(SessionAuthentication)
  .annotate(OpenApi.Title, "Signup (Authenticated)")

// ============================================================================
// Full API Definition
// ============================================================================

export class Nat20Api extends HttpApi.make("nat20")
  .add(userGroup)
  .add(availabilityGroup)
  .add(billingGroup)
  .add(signupPublicGroup)
  .add(signupGroup)
  .addError(Unauthorized, { status: 401 })
  .addError(InternalError, { status: 500 })
  .annotate(OpenApi.Title, "nat20.day API")
  .annotate(OpenApi.Description, `
# nat20.day API

Programmatic access to D&D session scheduling.

## Authentication

All endpoints require a Bearer token in the Authorization header:

\`\`\`
Authorization: Bearer nat20_your_token_here
\`\`\`

API tokens can be generated in your [profile settings](https://nat20.day/profile).

## Rate Limits

Currently there are no rate limits, but please be respectful.

## Response Format

All responses follow this structure:

**Success:**
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

**Error:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
\`\`\`
`)
  .annotate(OpenApi.Version, "1.0.0")
{}
