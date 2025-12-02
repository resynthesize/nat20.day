import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery } from '../../lib/supabase'
import { success, handleError } from '../../lib/response'
import { ValidationError, AuthError } from '../../lib/errors'

interface AdminRow {
  profile_id: string
  created_at: string
  profiles: { id: string; display_name: string; avatar_url: string | null }
}

const validatePartyId = (id: unknown): Effect.Effect<string, ValidationError> => {
  if (typeof id !== 'string' || id.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Party ID is required' }))
  }
  return Effect.succeed(id)
}

const checkIsAdmin = (partyId: string, userId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ party_id: string }[]>(
        client
          .from('party_admins')
          .select('party_id')
          .eq('party_id', partyId)
          .eq('profile_id', userId)
      )
    ),
    Effect.flatMap((admins) =>
      admins.length > 0
        ? Effect.succeed(true)
        : Effect.fail(new AuthError({ message: 'You are not an admin of this party' }))
    )
  )

const checkIsMember = (partyId: string, userId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ id: string }[]>(
        client
          .from('party_members')
          .select('id')
          .eq('party_id', partyId)
          .eq('profile_id', userId)
      )
    ),
    Effect.flatMap((members) =>
      members.length > 0
        ? Effect.succeed(true)
        : Effect.fail(new AuthError({ message: 'You are not a member of this party' }))
    )
  )

const listAdmins = (partyId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<AdminRow[]>(
        client
          .from('party_admins')
          .select(`
            profile_id,
            created_at,
            profiles (
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('party_id', partyId)
      )
    )
  )

interface AddAdminInput {
  profile_id: string
}

const validateAddAdminInput = (body: unknown): Effect.Effect<AddAdminInput, ValidationError> => {
  if (!body || typeof body !== 'object') {
    return Effect.fail(new ValidationError({ message: 'Request body is required' }))
  }

  const { profile_id } = body as { profile_id?: unknown }

  if (typeof profile_id !== 'string' || profile_id.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Profile ID is required' }))
  }

  return Effect.succeed({ profile_id })
}

const checkProfileIsMember = (partyId: string, profileId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ id: string }[]>(
        client
          .from('party_members')
          .select('id')
          .eq('party_id', partyId)
          .eq('profile_id', profileId)
      )
    ),
    Effect.flatMap((members) =>
      members.length > 0
        ? Effect.succeed(true)
        : Effect.fail(new ValidationError({ message: 'This user is not a member of the party' }))
    )
  )

const addAdmin = (partyId: string, profileId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ party_id: string; profile_id: string; created_at: string }>(
        client
          .from('party_admins')
          .insert({ party_id: partyId, profile_id: profileId })
          .select()
          .single()
      )
    )
  )

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query

  if (req.method === 'GET') {
    const program = pipe(
      validatePartyId(id),
      Effect.flatMap((partyId) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsMember(partyId, user.id),
              Effect.flatMap(() => listAdmins(partyId))
            )
          )
        )
      ),
      Effect.provide(SupabaseServiceLive)
    )

    return Effect.runPromise(program)
      .then((data) => success(res, data))
      .catch((err) => handleError(res, err))
  }

  if (req.method === 'POST') {
    const program = pipe(
      Effect.all({
        partyId: validatePartyId(id),
        input: validateAddAdminInput(req.body),
      }),
      Effect.flatMap(({ partyId, input }) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => checkProfileIsMember(partyId, input.profile_id)),
              Effect.flatMap(() => addAdmin(partyId, input.profile_id))
            )
          )
        )
      ),
      Effect.provide(SupabaseServiceLive)
    )

    return Effect.runPromise(program)
      .then((data) => success(res, data, 201))
      .catch((err) => handleError(res, err))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default handler
