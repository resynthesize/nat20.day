import { Context, Effect, Layer, pipe, Option } from 'effect'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AuthError, ConfigError, DatabaseError } from './errors'

// Database types
export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Availability {
  id: string
  user_id: string
  date: string
  available: boolean
  updated_at: string
}

export interface AvailabilityWithProfile extends Availability {
  profiles: Pick<Profile, 'display_name' | 'avatar_url'>
}

// Supabase Service interface
export interface SupabaseServiceImpl {
  readonly client: SupabaseClient
  readonly getUser: (authHeader: string | null) => Effect.Effect<User, AuthError>
}

export class SupabaseService extends Context.Tag('SupabaseService')<
  SupabaseService,
  SupabaseServiceImpl
>() {}

// Parse bearer token from header
const parseAuthHeader = (header: string | null): Option.Option<string> =>
  pipe(
    Option.fromNullable(header),
    Option.filter((h) => h.startsWith('Bearer ')),
    Option.map((h) => h.slice(7))
  )

// Get user from auth token
const makeGetUser =
  (client: SupabaseClient) =>
  (authHeader: string | null): Effect.Effect<User, AuthError> =>
    pipe(
      parseAuthHeader(authHeader),
      Effect.fromOption(() => new AuthError({ message: 'Missing or invalid authorization header' })),
      Effect.flatMap((token) =>
        Effect.tryPromise({
          try: () => client.auth.getUser(token),
          catch: () => new AuthError({ message: 'Failed to verify token' }),
        })
      ),
      Effect.flatMap(({ data, error }) =>
        error || !data.user
          ? Effect.fail(new AuthError({ message: error?.message ?? 'Invalid token' }))
          : Effect.succeed(data.user)
      )
    )

// Create Supabase client effect
const makeClient: Effect.Effect<SupabaseClient, ConfigError> = pipe(
  Effect.all({
    url: pipe(
      Effect.fromNullable(process.env.VITE_SUPABASE_URL),
      Effect.mapError(() => new ConfigError({ message: 'Missing VITE_SUPABASE_URL' }))
    ),
    serviceKey: pipe(
      Effect.fromNullable(process.env.SUPABASE_SERVICE_ROLE_KEY),
      Effect.mapError(() => new ConfigError({ message: 'Missing SUPABASE_SERVICE_ROLE_KEY' }))
    ),
  }),
  Effect.map(({ url, serviceKey }) =>
    createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  )
)

// Live layer for Supabase service
export const SupabaseServiceLive = Layer.effect(
  SupabaseService,
  pipe(
    makeClient,
    Effect.map((client) => ({
      client,
      getUser: makeGetUser(client),
    })),
    Effect.catchTag('ConfigError', (e) => Effect.die(e))
  )
)

// Helper to run a query and handle Supabase's error-in-response pattern
export const runQuery = <T>(
  query: Promise<{ data: T | null; error: { message: string; code?: string } | null }>
): Effect.Effect<T, DatabaseError> =>
  pipe(
    Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
        : data !== null
          ? Effect.succeed(data)
          : Effect.fail(new DatabaseError({ message: 'No data returned' }))
    )
  )

// Helper for queries that may return null (single row)
export const runQueryOptional = <T>(
  query: Promise<{ data: T | null; error: { message: string; code?: string } | null }>
): Effect.Effect<Option.Option<T>, DatabaseError> =>
  pipe(
    Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    }),
    Effect.flatMap(({ data, error }) =>
      error
        ? Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
        : Effect.succeed(Option.fromNullable(data))
    )
  )

// Helper for mutations that don't return data
export const runMutation = (
  query: Promise<{ error: { message: string; code?: string } | null }>
): Effect.Effect<void, DatabaseError> =>
  pipe(
    Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    }),
    Effect.flatMap(({ error }) =>
      error
        ? Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
        : Effect.void
    )
  )
