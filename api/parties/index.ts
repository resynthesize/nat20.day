import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery } from '../lib/supabase'
import { success, handleError } from '../lib/response'
import { ValidationError } from '../lib/errors'

interface PartyRow {
  id: string
  name: string
  created_at: string
  party_admins: { profile_id: string }[]
}

const listParties = (userId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<PartyRow[]>(
        client
          .from('parties')
          .select(`
            id,
            name,
            created_at,
            party_admins (
              profile_id
            )
          `)
          .order('name')
      )
    ),
    // Filter to parties where user is a member (via RLS, this is already filtered)
    // but we include admin info for each party
    Effect.map((parties) =>
      parties.map((p) => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at,
        is_admin: p.party_admins.some((a) => a.profile_id === userId),
        admin_count: p.party_admins.length,
      }))
    )
  )

interface CreatePartyInput {
  name: string
}

const validateCreateInput = (body: unknown): Effect.Effect<CreatePartyInput, ValidationError> => {
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

const createParty = (userId: string, userEmail: string | undefined, userName: string, input: CreatePartyInput) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      Effect.gen(function* () {
        // 1. Create the party
        const party = yield* runQuery<{ id: string; name: string; created_at: string }>(
          client.from('parties').insert({ name: input.name }).select().single()
        )

        // 2. Add creator as admin
        yield* runQuery(
          client.from('party_admins').insert({ party_id: party.id, profile_id: userId }).select().single()
        )

        // 3. Add creator as member
        yield* runQuery(
          client
            .from('party_members')
            .insert({
              party_id: party.id,
              name: userName,
              email: userEmail ?? null,
              profile_id: userId,
            })
            .select()
            .single()
        )

        return {
          id: party.id,
          name: party.name,
          created_at: party.created_at,
          is_admin: true,
          admin_count: 1,
        }
      })
    )
  )

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const program = pipe(
      SupabaseService,
      Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
      Effect.flatMap((user) => listParties(user.id)),
      Effect.provide(SupabaseServiceLive)
    )

    return Effect.runPromise(program)
      .then((data) => success(res, data))
      .catch((err) => handleError(res, err))
  }

  if (req.method === 'POST') {
    const program = pipe(
      SupabaseService,
      Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
      Effect.flatMap((user) =>
        pipe(
          validateCreateInput(req.body),
          Effect.flatMap((input) =>
            createParty(
              user.id,
              user.email,
              user.user_metadata?.full_name ?? user.email ?? 'Unknown',
              input
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
