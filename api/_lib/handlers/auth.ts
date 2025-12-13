/**
 * Authentication Middleware
 *
 * Provides authentication for API handlers via Effect middleware.
 * Supports both nat20_ API tokens and Supabase JWTs.
 */

import { Effect, Layer, Redacted } from "effect"
import {
  Unauthorized,
  CurrentUser,
  Authentication,
  SessionAuthentication,
} from "../api.js"
import { getServiceClient } from "../supabase.js"
import { hashToken, TOKEN_PREFIX } from "../crypto.js"

// Re-export for use by other modules
export { CurrentUser, Authentication, SessionAuthentication }

/**
 * Stub layer for CurrentUser - satisfies type checker at composition time.
 * At runtime, the Authentication middleware provides the actual user.
 */
export const CurrentUserStub = Layer.succeed(CurrentUser, { profileId: "" })

/**
 * Authentication implementation layer
 *
 * Validates either:
 * - nat20_ API tokens (looked up in api_tokens table)
 * - Supabase JWTs (validated via supabase.auth.getUser)
 */
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
          if (token.startsWith(TOKEN_PREFIX)) {
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

/**
 * Session-only authentication implementation layer
 *
 * Only validates Supabase JWTs - rejects nat20_ API tokens.
 * Used for billing endpoints that should not be accessible via API tokens.
 */
export const SessionAuthenticationLive = Layer.effect(
  SessionAuthentication,
  Effect.succeed(
    SessionAuthentication.of({
      bearer: (redactedToken) =>
        Effect.gen(function* () {
          const token = Redacted.value(redactedToken)
          const supabase = getServiceClient()

          // Reject API tokens - billing requires session auth
          if (token.startsWith(TOKEN_PREFIX)) {
            return yield* Effect.fail(
              new Unauthorized({ message: "Session authentication required" })
            )
          }

          // Validate Supabase JWT
          const { data: userData, error: userError } = yield* Effect.tryPromise({
            try: () => supabase.auth.getUser(token),
            catch: () => new Unauthorized({ message: "Invalid session token" }),
          })

          if (userError || !userData.user) {
            return yield* Effect.fail(
              new Unauthorized({ message: "Invalid or expired session" })
            )
          }

          return { profileId: userData.user.id }
        }),
    })
  )
)
