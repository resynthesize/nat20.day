/**
 * Shared API Helpers
 *
 * Common utilities used across API handlers to reduce duplication:
 * - Admin authorization checks
 * - Database query wrappers with consistent error handling
 */

import { Effect, pipe } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Forbidden, NotFound, InternalError } from "./api.js"

/**
 * Verify a user is an admin of a party
 *
 * Checks the party_admins table for a matching (party_id, profile_id) row.
 * Fails with Forbidden if not an admin, InternalError if DB fails.
 *
 * @example
 * ```ts
 * yield* requirePartyAdmin(db, partyId, user.profileId)
 * // If we reach here, user is confirmed admin
 * ```
 */
export function requirePartyAdmin(
  db: SupabaseClient,
  partyId: string,
  profileId: string
): Effect.Effect<void, Forbidden | InternalError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        db
          .from("party_admins")
          .select("profile_id")
          .eq("party_id", partyId)
          .eq("profile_id", profileId)
          .single(),
      catch: () => new InternalError({ message: "Database error" }),
    }),
    Effect.flatMap(({ data, error }) => {
      if (error || !data) {
        return Effect.fail(
          new Forbidden({ message: "Must be party admin to perform this action" })
        )
      }
      return Effect.void
    })
  )
}

/**
 * Verify a user is a member of a party
 *
 * Checks the party_members table for membership.
 * Returns the member ID if found, fails with Forbidden if not a member.
 *
 * @example
 * ```ts
 * const memberId = yield* requirePartyMember(db, partyId, user.profileId)
 * ```
 */
export function requirePartyMember(
  db: SupabaseClient,
  partyId: string,
  profileId: string
): Effect.Effect<string, Forbidden | InternalError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        db
          .from("party_members")
          .select("id")
          .eq("party_id", partyId)
          .eq("profile_id", profileId)
          .single(),
      catch: () => new InternalError({ message: "Database error" }),
    }),
    Effect.flatMap(({ data, error }) => {
      if (error || !data) {
        return Effect.fail(
          new Forbidden({ message: "Not a member of this party" })
        )
      }
      return Effect.succeed(data.id as string)
    })
  )
}

/**
 * Get a subscription for a party
 *
 * Common pattern: look up subscription by party_id, fail with NotFound if missing.
 *
 * @example
 * ```ts
 * const subscription = yield* getPartySubscription(db, partyId)
 * // subscription.stripe_customer_id, etc.
 * ```
 */
export function getPartySubscription<T extends string>(
  db: SupabaseClient,
  partyId: string,
  select: T = "stripe_customer_id, stripe_subscription_id" as T
): Effect.Effect<Record<string, unknown>, NotFound | InternalError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        db
          .from("subscriptions")
          .select(select)
          .eq("party_id", partyId)
          .single(),
      catch: () => new InternalError({ message: "Database error" }),
    }),
    Effect.flatMap(({ data, error }) => {
      if (error || !data) {
        return Effect.fail(
          new NotFound({ message: "No subscription found for this party" })
        )
      }
      return Effect.succeed(data as Record<string, unknown>)
    })
  )
}

/**
 * Get user email from auth system
 *
 * Uses admin API to fetch email for a profile ID.
 * Common pattern in billing handlers.
 *
 * @example
 * ```ts
 * const email = yield* getUserEmail(db, user.profileId)
 * ```
 */
export function getUserEmail(
  db: SupabaseClient,
  profileId: string
): Effect.Effect<string, InternalError> {
  return pipe(
    Effect.tryPromise({
      try: () => db.auth.admin.getUserById(profileId),
      catch: () => new InternalError({ message: "Failed to get user details" }),
    }),
    Effect.flatMap(({ data: authUser, error }) => {
      if (error || !authUser.user?.email) {
        return Effect.fail(new InternalError({ message: "User email not found" }))
      }
      return Effect.succeed(authUser.user.email)
    })
  )
}
