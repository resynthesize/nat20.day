/**
 * Availability Handlers
 *
 * Handles party availability CRUD operations.
 */

import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"

// Schema for joined profile data from Supabase
const ProfileJoin = Schema.Struct({
  display_name: Schema.optional(Schema.String),
  avatar_url: Schema.optional(Schema.NullOr(Schema.String)),
})

// Helper to safely extract display_name from profiles join
function getDisplayName(profiles: unknown, fallback: string): string {
  // Supabase joins can return an array or single object
  const normalized = Array.isArray(profiles) ? profiles[0] : profiles
  const decoded = Schema.decodeUnknownOption(ProfileJoin)(normalized)
  return decoded._tag === 'Some' ? (decoded.value.display_name ?? fallback) : fallback
}
import {
  Nat20Api,
  PartyMember,
  Availability,
  PartyAvailability,
  AvailabilitySet,
  AvailabilityDeleted,
  Forbidden,
  NotFound,
  InternalError,
  CurrentUser,
} from "../api.js"
import { getServiceClient } from "../supabase.js"
import { AuthenticationLive, CurrentUserStub } from "./auth.js"

const supabase = () => getServiceClient()

/**
 * Availability Handlers Group
 *
 * Endpoints:
 *   GET    /parties/:partyId/availability  - Get party availability
 *   PUT    /availability/:memberId/:date   - Set availability
 *   DELETE /availability/:memberId/:date   - Clear availability
 */
export const AvailabilityHandlers = HttpApiBuilder.group(Nat20Api, "availability", (handlers) =>
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
                display_name: getDisplayName(m.profiles, m.name),
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
