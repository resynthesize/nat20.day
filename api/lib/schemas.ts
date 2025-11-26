import { Schema } from 'effect'

// Date string in YYYY-MM-DD format
export const DateString = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/, {
    message: () => 'Date must be in YYYY-MM-DD format',
  })
)

// Availability input for setting availability
export const SetAvailabilityInput = Schema.Struct({
  available: Schema.Boolean,
})

export type SetAvailabilityInput = Schema.Schema.Type<typeof SetAvailabilityInput>

// Query params for fetching availability
export const GetAvailabilityQuery = Schema.Struct({
  from: Schema.optional(DateString),
  to: Schema.optional(DateString),
})

export type GetAvailabilityQuery = Schema.Schema.Type<typeof GetAvailabilityQuery>

// Profile response
export const ProfileResponse = Schema.Struct({
  id: Schema.String,
  display_name: Schema.String,
  avatar_url: Schema.NullOr(Schema.String),
})

// Availability response
export const AvailabilityResponse = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  date: DateString,
  available: Schema.Boolean,
  updated_at: Schema.String,
  profiles: ProfileResponse,
})

export type AvailabilityResponse = Schema.Schema.Type<typeof AvailabilityResponse>

// API response wrappers
export const SuccessResponse = <A, I, R>(dataSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    success: Schema.Literal(true),
    data: dataSchema,
  })

export const ErrorResponse = Schema.Struct({
  success: Schema.Literal(false),
  error: Schema.Struct({
    code: Schema.String,
    message: Schema.String,
  }),
})
