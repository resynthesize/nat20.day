import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery, runMutation } from '../../../lib/supabase'
import { success, handleError } from '../../../lib/response'
import { ValidationError, AuthError } from '../../../lib/errors'

const validateIds = (
  partyId: unknown,
  memberId: unknown
): Effect.Effect<{ partyId: string; memberId: string }, ValidationError> => {
  if (typeof partyId !== 'string' || partyId.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Party ID is required' }))
  }
  if (typeof memberId !== 'string' || memberId.length === 0) {
    return Effect.fail(new ValidationError({ message: 'Member ID is required' }))
  }
  return Effect.succeed({ partyId, memberId })
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

const removeMember = (partyId: string, memberId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runMutation(
        client
          .from('party_members')
          .delete()
          .eq('id', memberId)
          .eq('party_id', partyId)
      )
    )
  )

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { id, memberId } = req.query

  if (req.method === 'DELETE') {
    const program = pipe(
      validateIds(id, memberId),
      Effect.flatMap(({ partyId, memberId: mId }) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => removeMember(partyId, mId))
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
