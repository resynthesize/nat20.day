import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery, runMutation } from '../../../lib/supabase'
import { success, handleError } from '../../../lib/response'
import { ValidationError, AuthError } from '../../../lib/errors'

const validateIds = (
  partyId: unknown,
  profileId: unknown
): Effect.Effect<{ partyId: string; profileId: string }, ValidationError> => {
  if (typeof partyId !== 'string' || partyId.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Party ID is required' }))
  }
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Profile ID is required' }))
  }
  return Effect.succeed({ partyId, profileId })
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

const checkNotLastAdmin = (partyId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ profile_id: string }[]>(
        client.from('party_admins').select('profile_id').eq('party_id', partyId)
      )
    ),
    Effect.flatMap((admins) =>
      admins.length > 1
        ? Effect.succeed(true)
        : Effect.fail(
            new ValidationError({ message: 'Cannot remove the last admin. Promote another member first.' })
          )
    )
  )

const removeAdmin = (partyId: string, profileId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runMutation(
        client
          .from('party_admins')
          .delete()
          .eq('party_id', partyId)
          .eq('profile_id', profileId)
      )
    )
  )

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { id, profileId } = req.query

  if (req.method === 'DELETE') {
    const program = pipe(
      validateIds(id, profileId),
      Effect.flatMap(({ partyId, profileId: pId }) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => checkNotLastAdmin(partyId)),
              Effect.flatMap(() => removeAdmin(partyId, pId))
            )
          )
        )
      ),
      Effect.provide(SupabaseServiceLive)
    )

    return Effect.runPromise(program)
      .then(() => success(res, { deleted: true }))
      .catch((err) => handleError(res, err))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default handler
