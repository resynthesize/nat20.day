import { Context, Effect, Layer, pipe, Option } from 'effect'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AuthError, ConfigError, DatabaseError } from './errors'

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

export interface SupabaseServiceImpl {
  readonly client: SupabaseClient
  readonly getUser: (authHeader: string | null) => Effect.Effect<User, AuthError>
}

export class SupabaseService extends Context.Tag('SupabaseService')<
  SupabaseService,
  SupabaseServiceImpl
>() {}

const parseAuthHeader = (header: string | null): Option.Option<string> =>
  pipe(
    Option.fromNullable(header),
    Option.filter((h) => h.startsWith('Bearer ')),
    Option.map((h) => h.slice(7))
  )

const makeGetUser =
  (client: SupabaseClient) =>
  (authHeader: string | null): Effect.Effect<User, AuthError> =>
    pipe(
      parseAuthHeader(authHeader),
      Option.match({
        onNone: () => Effect.fail(new AuthError({ message: 'Missing or invalid authorization header' })),
        onSome: (token) =>
          pipe(
            Effect.tryPromise({
              try: () => client.auth.getUser(token),
              catch: () => new AuthError({ message: 'Failed to verify token' }),
            }),
            Effect.flatMap(({ data, error }) =>
              error || !data.user
                ? Effect.fail(new AuthError({ message: error?.message ?? 'Invalid token' }))
                : Effect.succeed(data.user)
            )
          ),
      })
    )

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

// Supabase returns errors in the response body, not as exceptions
export const runQuery = <T>(
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>
): Effect.Effect<T, DatabaseError> =>
  Effect.gen(function* () {
    const { data, error } = yield* Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    })

    if (error) {
      return yield* Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
    }

    if (data === null) {
      return yield* Effect.fail(new DatabaseError({ message: 'No data returned' }))
    }

    return data
  })

export const runQueryOptional = <T>(
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>
): Effect.Effect<Option.Option<T>, DatabaseError> =>
  Effect.gen(function* () {
    const { data, error } = yield* Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    })

    if (error) {
      return yield* Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
    }

    return Option.fromNullable(data)
  })

export const runMutation = (
  query: PromiseLike<{ error: { message: string; code?: string } | null }>
): Effect.Effect<void, DatabaseError> =>
  Effect.gen(function* () {
    const { error } = yield* Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ message: String(e) }),
    })

    if (error) {
      return yield* Effect.fail(new DatabaseError({ message: error.message, code: error.code }))
    }
  })
