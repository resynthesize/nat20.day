/**
 * User Handlers
 *
 * Handles user profile and party listing endpoints.
 */

import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer } from "effect"
import {
  Nat20Api,
  Profile,
  Party,
  InternalError,
  CurrentUser,
} from "../api.js"
import { getServiceClient } from "../supabase.js"
import { AuthenticationLive, CurrentUserStub } from "./auth.js"

const supabase = () => getServiceClient()

/**
 * User Handlers Group
 *
 * Endpoints:
 *   GET /me      - Get current user profile
 *   GET /parties - List user's parties
 */
export const UserHandlers = HttpApiBuilder.group(Nat20Api, "user", (handlers) =>
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
