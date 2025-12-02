import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery, runMutation } from '../lib/supabase'
import { success, handleError } from '../lib/response'
import { ValidationError, AuthError } from '../lib/errors'

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

interface UpdatePartyInput {
  name: string
}

const validateUpdateInput = (body: unknown): Effect.Effect<UpdatePartyInput, ValidationError> => {
  if (!body || typeof body !== 'object') {
    return Effect.fail(new ValidationError({ message: 'Request body is required' }))
  }

  const { name } = body as { name?: unknown }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return Effect.fail(new ValidationError({ message: 'Party name is required' }))
  }

  if (name.length > 100) {
    return Effect.fail(new ValidationError({ message: 'Party name must be 100 characters or less' }))
  }

  return Effect.succeed({ name: name.trim() })
}

const updateParty = (partyId: string, input: UpdatePartyInput) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ id: string; name: string; created_at: string }>(
        client
          .from('parties')
          .update({ name: input.name })
          .eq('id', partyId)
          .select()
          .single()
      )
    )
  )

const deleteParty = (partyId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runMutation(client.from('parties').delete().eq('id', partyId))
    )
  )

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query

  if (req.method === 'PATCH') {
    const program = pipe(
      Effect.all({
        partyId: validatePartyId(id),
        input: validateUpdateInput(req.body),
      }),
      Effect.flatMap(({ partyId, input }) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => updateParty(partyId, input))
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

  if (req.method === 'DELETE') {
    const program = pipe(
      validatePartyId(id),
      Effect.flatMap((partyId) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => deleteParty(partyId))
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
