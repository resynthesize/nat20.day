import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe } from 'effect'
import { SupabaseService, SupabaseServiceLive, runQuery } from '../../lib/supabase'
import { success, handleError } from '../../lib/response'
import { ValidationError, AuthError } from '../../lib/errors'

interface PartyMemberRow {
  id: string
  party_id: string
  name: string
  email: string | null
  profile_id: string | null
  created_at: string
  profiles: { display_name: string; avatar_url: string | null } | null
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

const listMembers = (partyId: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<PartyMemberRow[]>(
        client
          .from('party_members')
          .select(`
            id,
            party_id,
            name,
            email,
            profile_id,
            created_at,
            profiles (
              display_name,
              avatar_url
            )
          `)
          .eq('party_id', partyId)
          .order('name')
      )
    )
  )

interface AddMemberInput {
  name: string
  email: string | null
}

const validateAddMemberInput = (body: unknown): Effect.Effect<AddMemberInput, ValidationError> => {
  if (!body || typeof body !== 'object') {
    return Effect.fail(new ValidationError({ message: 'Request body is required' }))
  }

  const { name, email } = body as { name?: unknown; email?: unknown }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return Effect.fail(new ValidationError({ message: 'Member name is required' }))
  }

  if (name.length > 100) {
    return Effect.fail(new ValidationError({ message: 'Member name must be 100 characters or less' }))
  }

  // Email is optional but must be valid if provided
  let validatedEmail: string | null = null
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      return Effect.fail(new ValidationError({ message: 'Email must be a string' }))
    }
    // Basic email validation
    if (!email.includes('@')) {
      return Effect.fail(new ValidationError({ message: 'Invalid email format' }))
    }
    validatedEmail = email.trim().toLowerCase()
  }

  return Effect.succeed({ name: name.trim(), email: validatedEmail })
}

const checkEmailUnique = (partyId: string, email: string | null) => {
  if (!email) return Effect.succeed(true)

  return pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<{ id: string }[]>(
        client
          .from('party_members')
          .select('id')
          .eq('party_id', partyId)
          .eq('email', email)
      )
    ),
    Effect.flatMap((existing) =>
      existing.length > 0
        ? Effect.fail(new ValidationError({ message: 'A member with this email already exists in this party' }))
        : Effect.succeed(true)
    )
  )
}

const addMember = (partyId: string, input: AddMemberInput) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery<PartyMemberRow>(
        client
          .from('party_members')
          .insert({
            party_id: partyId,
            name: input.name,
            email: input.email,
          })
          .select(`
            id,
            party_id,
            name,
            email,
            profile_id,
            created_at,
            profiles (
              display_name,
              avatar_url
            )
          `)
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
              Effect.flatMap(() => listMembers(partyId))
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
        input: validateAddMemberInput(req.body),
      }),
      Effect.flatMap(({ partyId, input }) =>
        pipe(
          SupabaseService,
          Effect.flatMap(({ getUser }) => getUser(req.headers.authorization ?? null)),
          Effect.flatMap((user) =>
            pipe(
              checkIsAdmin(partyId, user.id),
              Effect.flatMap(() => checkEmailUnique(partyId, input.email)),
              Effect.flatMap(() => addMember(partyId, input))
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
