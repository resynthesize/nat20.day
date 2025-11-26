import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe, Schema } from 'effect'
import { isThursday, isFriday, parseISO, isValid } from 'date-fns'
import {
  SupabaseService,
  SupabaseServiceLive,
  DatabaseError,
  AuthError,
} from '../lib/supabase'
import { SetAvailabilityInput } from '../lib/schemas'
import { success, error, handleError } from '../lib/response'

// Validation errors
class ValidationError {
  readonly _tag = 'ValidationError'
  constructor(readonly message: string) {}
}

// Validate date parameter
const validateDate = (dateStr: string) =>
  Effect.gen(function* () {
    const date = parseISO(dateStr)

    if (!isValid(date)) {
      return yield* Effect.fail(new ValidationError('Invalid date format. Use YYYY-MM-DD'))
    }

    if (!isThursday(date) && !isFriday(date)) {
      return yield* Effect.fail(
        new ValidationError('Can only set availability for Thursday or Friday')
      )
    }

    return dateStr
  })

// Validate request body
const validateBody = (body: unknown) =>
  pipe(
    Schema.decodeUnknown(SetAvailabilityInput)(body),
    Effect.mapError(
      () => new ValidationError('Invalid request body. Expected { available: boolean }')
    )
  )

// Upsert availability
const upsertAvailability = (userId: string, date: string, available: boolean) =>
  Effect.gen(function* () {
    const { client } = yield* SupabaseService

    const result = yield* Effect.promise(() =>
      client
        .from('availability')
        .upsert(
          { user_id: userId, date, available },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single()
    )

    if (result.error) {
      return yield* Effect.fail(new DatabaseError(result.error.message, result.error.code))
    }

    return result.data
  })

// Delete availability (when setting to null/undefined)
const deleteAvailability = (userId: string, date: string) =>
  Effect.gen(function* () {
    const { client } = yield* SupabaseService

    const result = yield* Effect.promise(() =>
      client.from('availability').delete().eq('user_id', userId).eq('date', date)
    )

    if (result.error) {
      return yield* Effect.fail(new DatabaseError(result.error.message, result.error.code))
    }

    return null
  })

// Main handler
const handler = async (req: VercelRequest, res: VercelResponse) => {
  // Only allow PUT/DELETE
  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dateParam = req.query.date as string

  // Handle DELETE - remove availability
  if (req.method === 'DELETE') {
    const program = pipe(
      Effect.all({
        date: validateDate(dateParam),
        user: Effect.gen(function* () {
          const { getUser } = yield* SupabaseService
          return yield* getUser(req.headers.authorization ?? null)
        }),
      }),
      Effect.flatMap(({ date, user }) => deleteAvailability(user.id, date)),
      Effect.provide(SupabaseServiceLive)
    )

    return Effect.runPromise(program)
      .then(() => success(res, { deleted: true }))
      .catch((err) => {
        if (err instanceof ValidationError) {
          return error(res, 'VALIDATION_ERROR', err.message, 400)
        }
        if (err instanceof AuthError) {
          return error(res, 'AUTH_ERROR', err.message, 401)
        }
        return handleError(res, err)
      })
  }

  // Handle PUT - set availability
  const program = pipe(
    Effect.all({
      date: validateDate(dateParam),
      body: validateBody(req.body),
      user: Effect.gen(function* () {
        const { getUser } = yield* SupabaseService
        return yield* getUser(req.headers.authorization ?? null)
      }),
    }),
    Effect.flatMap(({ date, body, user }) =>
      upsertAvailability(user.id, date, body.available)
    ),
    Effect.provide(SupabaseServiceLive)
  )

  return Effect.runPromise(program)
    .then((data) => success(res, data))
    .catch((err) => {
      if (err instanceof ValidationError) {
        return error(res, 'VALIDATION_ERROR', err.message, 400)
      }
      if (err instanceof AuthError) {
        return error(res, 'AUTH_ERROR', err.message, 401)
      }
      return handleError(res, err)
    })
}

export default handler
