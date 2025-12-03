/**
 * API Handlers Index
 *
 * Re-exports all handler groups and authentication middleware.
 * This is the main entry point for importing handlers.
 */

import { Layer } from "effect"
import { UserHandlers } from "./user.js"
import { AvailabilityHandlers } from "./availability.js"

// Re-export auth components for external use
export { AuthenticationLive, CurrentUserStub, CurrentUser, Authentication } from "./auth.js"

// Re-export individual handler groups
export { UserHandlers } from "./user.js"
export { AvailabilityHandlers } from "./availability.js"

/**
 * Combined API Layer for User and Availability handlers
 *
 * Note: BillingHandlers is imported separately in v1.ts to avoid circular deps
 */
export const Nat20ApiLive = Layer.mergeAll(UserHandlers, AvailabilityHandlers)
