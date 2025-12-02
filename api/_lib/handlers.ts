/**
 * nat20.day API Handler Implementation
 *
 * This file implements all API endpoints using Effect HttpApiBuilder.
 * Authentication is handled via middleware that validates nat20_ tokens.
 */

import { HttpApiBuilder, HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Context, Effect, Layer, Redacted } from "effect"
import {
  Nat20Api,
  Profile,
  Party,
  PartyMember,
  Availability,
  PartyAvailability,
  AvailabilitySet,
  AvailabilityDeleted,
  Unauthorized,
  Forbidden,
  NotFound,
  InternalError,
} from "./api.js"
import { getServiceClient } from "./supabase.js"
import { hashToken } from "./crypto.js"

// ============================================================================
// Authentication Context
// ============================================================================

/** Current authenticated user context */
export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  { profileId: string }
>() {}

/**
 * Stub layer for CurrentUser - satisfies type checker at composition time.
 * At runtime, the Authentication middleware provides the actual user.
 */
export const CurrentUserStub = Layer.succeed(CurrentUser, { profileId: "" })

// ============================================================================
// Authentication Middleware
// ============================================================================

/** Bearer token security scheme for nat20_ tokens */
const bearerSecurity = HttpApiSecurity.bearer

/**
 * Authentication middleware that validates nat20_ tokens
 * and provides CurrentUser context to handlers
 */
export class Authentication extends HttpApiMiddleware.Tag<Authentication>()(
  "Authentication",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: { bearer: bearerSecurity },
  }
) {}

/** Authentication implementation layer */
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.succeed(
    Authentication.of({
      bearer: (redactedToken) =>
        Effect.gen(function* () {
          console.log("[Auth] Middleware invoked!")
          // Unwrap the redacted token
          const token = Redacted.value(redactedToken)
          console.log("[Auth] Token prefix:", token.substring(0, 10) + "...")
          const supabase = getServiceClient()

          // Check if it's a nat20_ API token
          if (token.startsWith("nat20_")) {
            console.log("[Auth] Token is nat20_ API token")
            const tokenHash = hashToken(token)

            // Lookup token - map any DB error to Unauthorized (middleware can only fail with Unauthorized)
            const { data, error } = yield* Effect.tryPromise({
              try: () =>
                supabase
                  .from("api_tokens")
                  .select("id, profile_id")
                  .eq("token_hash", tokenHash)
                  .single(),
              catch: () => new Unauthorized({ message: "Authentication failed" }),
            })

            if (error || !data) {
              return yield* Effect.fail(
                new Unauthorized({ message: "Invalid or revoked token" })
              )
            }

            // Update last_used_at (fire and forget - ignore any errors)
            Effect.runFork(
              Effect.tryPromise({
                try: () =>
                  supabase
                    .from("api_tokens")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("id", data.id),
                catch: () => new Error("Ignored"),
              }).pipe(Effect.ignore)
            )

            console.log("[Auth] API token validated, profile_id:", data.profile_id)
            return { profileId: data.profile_id }
          }

          // Otherwise, try to validate as Supabase JWT (for billing endpoints)
          // This allows users to create parties before they have an API token
          console.log("[Auth] Validating Supabase JWT...")
          const { data: userData, error: userError } = yield* Effect.tryPromise({
            try: () => supabase.auth.getUser(token),
            catch: (e) => {
              console.error("[Auth] getUser threw:", e)
              return new Unauthorized({ message: "Invalid session token" })
            },
          })

          console.log("[Auth] getUser result:", { userData, userError })

          if (userError || !userData.user) {
            console.error("[Auth] JWT validation failed:", userError)
            return yield* Effect.fail(
              new Unauthorized({ message: "Invalid or expired session" })
            )
          }

          console.log("[Auth] JWT validated, user ID:", userData.user.id)
          return { profileId: userData.user.id }
        }),
    })
  )
)

// ============================================================================
// Supabase Helper
// ============================================================================

const supabase = () => getServiceClient()

// ============================================================================
// User Handlers
// ============================================================================

const UserHandlers = HttpApiBuilder.group(Nat20Api, "user", (handlers) =>
  handlers
    // GET /me - Get current user profile
    .handle("getMe", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        const { data, error } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("profiles")
              .select("id, display_name, avatar_url, created_at")
              .eq("id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (error || !data) {
          // Profile missing for authenticated user is an internal data inconsistency
          return yield* Effect.fail(new InternalError({ message: "Profile not found" }))
        }

        return new Profile({
          id: data.id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          created_at: data.created_at,
        })
      })
    )

    // GET /parties - List user's parties
    .handle("getParties", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()

        // Get parties where user is a member
        const { data: memberData, error: memberError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_members")
              .select("party_id")
              .eq("profile_id", user.profileId),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (memberError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to fetch parties" }))
        }

        const partyIds = memberData.map((m) => m.party_id)

        if (partyIds.length === 0) {
          return []
        }

        const { data: parties, error: partiesError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("parties")
              .select("id, name, created_at")
              .in("id", partyIds)
              .order("name"),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (partiesError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to fetch parties" }))
        }

        return parties.map(
          (p) =>
            new Party({
              id: p.id,
              name: p.name,
              created_at: p.created_at,
            })
        )
      })
    )
).pipe(Layer.provide([AuthenticationLive, CurrentUserStub]))

// ============================================================================
// Availability Handlers
// ============================================================================

const AvailabilityHandlers = HttpApiBuilder.group(Nat20Api, "availability", (handlers) =>
  handlers
    // GET /parties/:partyId/availability
    .handle("getPartyAvailability", ({ path, urlParams }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()
        const { partyId } = path
        const { from, to } = urlParams

        // Verify user is a member of this party
        const { data: membership, error: memberError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_members")
              .select("id")
              .eq("party_id", partyId)
              .eq("profile_id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (memberError || !membership) {
          return yield* Effect.fail(new Forbidden({ message: "Not a member of this party" }))
        }

        // Get all party members
        const { data: members, error: membersError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_members")
              .select("id, name, profile_id, profiles(display_name, avatar_url)")
              .eq("party_id", partyId)
              .order("name"),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (membersError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to fetch members" }))
        }

        // Build availability query
        let availabilityQuery = db
          .from("availability")
          .select("id, party_member_id, date, available, updated_at")
          .in(
            "party_member_id",
            members.map((m) => m.id)
          )
          .gte("date", from || new Date().toISOString().split("T")[0])
          .order("date")

        if (to) {
          availabilityQuery = availabilityQuery.lte("date", to)
        }

        const { data: availability, error: availError } = yield* Effect.tryPromise({
          try: () => availabilityQuery,
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (availError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to fetch availability" }))
        }

        return new PartyAvailability({
          party_id: partyId,
          members: members.map(
            (m) =>
              new PartyMember({
                id: m.id,
                name: m.name,
                profile_id: m.profile_id,
                display_name:
                  (m.profiles as { display_name?: string })?.display_name || m.name,
              })
          ),
          availability: availability.map(
            (a) =>
              new Availability({
                id: a.id,
                party_member_id: a.party_member_id,
                date: a.date,
                available: a.available,
                updated_at: a.updated_at,
              })
          ),
        })
      })
    )

    // PUT /availability/:memberId/:date
    .handle("setAvailability", ({ path, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()
        const { memberId, date } = path
        const { available } = payload

        // Verify user owns this party member or is an admin
        const { data: member, error: memberError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_members")
              .select("id, party_id, profile_id")
              .eq("id", memberId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (memberError || !member) {
          return yield* Effect.fail(new NotFound({ message: "Party member not found" }))
        }

        // Check if user owns this member
        const isOwner = member.profile_id === user.profileId

        // Check if user is admin of the party
        const adminCheck = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_admins")
              .select("profile_id")
              .eq("party_id", member.party_id)
              .eq("profile_id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Admin check failed" }),
        }).pipe(Effect.catchAll(() => Effect.succeed({ data: null })))

        const isAdmin = !!adminCheck.data

        if (!isOwner && !isAdmin) {
          return yield* Effect.fail(
            new Forbidden({ message: "Cannot edit this member's availability" })
          )
        }

        // Upsert availability
        const { error: upsertError } = yield* Effect.tryPromise({
          try: () =>
            db.from("availability").upsert(
              {
                party_member_id: memberId,
                date,
                available,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "party_member_id,date" }
            ),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (upsertError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to set availability" }))
        }

        return new AvailabilitySet({
          party_member_id: memberId,
          date,
          available,
        })
      })
    )

    // DELETE /availability/:memberId/:date
    .handle("deleteAvailability", ({ path }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser
        const db = supabase()
        const { memberId, date } = path

        // Verify user owns this party member or is an admin
        const { data: member, error: memberError } = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_members")
              .select("id, party_id, profile_id")
              .eq("id", memberId)
              .single(),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (memberError || !member) {
          return yield* Effect.fail(new NotFound({ message: "Party member not found" }))
        }

        const isOwner = member.profile_id === user.profileId

        // Check if user is admin - treat query failure as "not admin"
        const adminCheck = yield* Effect.tryPromise({
          try: () =>
            db
              .from("party_admins")
              .select("profile_id")
              .eq("party_id", member.party_id)
              .eq("profile_id", user.profileId)
              .single(),
          catch: () => new InternalError({ message: "Admin check failed" }),
        }).pipe(Effect.catchAll(() => Effect.succeed({ data: null })))

        const isAdmin = !!adminCheck.data

        if (!isOwner && !isAdmin) {
          return yield* Effect.fail(
            new Forbidden({ message: "Cannot edit this member's availability" })
          )
        }

        // Delete availability
        const { error: deleteError } = yield* Effect.tryPromise({
          try: () =>
            db.from("availability").delete().eq("party_member_id", memberId).eq("date", date),
          catch: () => new InternalError({ message: "Database error" }),
        })

        if (deleteError) {
          return yield* Effect.fail(new InternalError({ message: "Failed to clear availability" }))
        }

        return new AvailabilityDeleted({ deleted: true })
      })
    )
).pipe(Layer.provide([AuthenticationLive, CurrentUserStub]))

// ============================================================================
// Combined API Layer
// ============================================================================

// Note: BillingHandlers is imported and merged in api/v1.ts to avoid circular deps
export const Nat20ApiLive = Layer.mergeAll(UserHandlers, AvailabilityHandlers)
