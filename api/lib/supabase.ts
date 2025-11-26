import { Context, Effect, Layer } from 'effect'
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'

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

// Supabase Service
export class SupabaseService extends Context.Tag('SupabaseService')<
  SupabaseService,
  {
    readonly client: SupabaseClient
    readonly getUser: (authHeader: string | null) => Effect.Effect<User, AuthError>
  }
>() {}

// Errors
export class AuthError {
  readonly _tag = 'AuthError'
  constructor(readonly message: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError'
  constructor(readonly message: string, readonly code?: string) {}
}

// Create Supabase client
const createSupabaseClient = () => {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Get user from auth header
const getUser = (client: SupabaseClient) => (authHeader: string | null) =>
  Effect.gen(function* () {
    if (!authHeader?.startsWith('Bearer ')) {
      return yield* Effect.fail(new AuthError('Missing or invalid authorization header'))
    }

    const token = authHeader.replace('Bearer ', '')
    const { data, error } = yield* Effect.promise(() => client.auth.getUser(token))

    if (error || !data.user) {
      return yield* Effect.fail(new AuthError(error?.message ?? 'Invalid token'))
    }

    return data.user
  })

// Live layer for Supabase service
export const SupabaseServiceLive = Layer.sync(SupabaseService, () => {
  const client = createSupabaseClient()
  return {
    client,
    getUser: getUser(client),
  }
})
