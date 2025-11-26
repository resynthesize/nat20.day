import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Effect, pipe, Schema } from 'effect'
import { isThursday, isFriday, parseISO, isValid } from 'date-fns'
import { SupabaseService, SupabaseServiceLive, runQuery, runMutation } from '../lib/supabase'
import { ValidationError } from '../lib/errors'
import { SetAvailabilityInput, DatePathParam } from '../lib/schemas'
import { success, handleError } from '../lib/response'

const parsePathParams = (query: VercelRequest['query']) =>
  pipe(
    Schema.decodeUnknown(DatePathParam)(query),
    Effect.mapError(() => new ValidationError({ message: 'Missing date parameter' }))
  )

const validateDate = (dateStr: string): Effect.Effect<string, ValidationError> =>
  pipe(
    Effect.succeed(parseISO(dateStr)),
    Effect.filterOrFail(
      isValid,
      () => new ValidationError({ message: 'Invalid date format. Use YYYY-MM-DD' })
    ),
    Effect.filterOrFail(
      (d) => isThursday(d) || isFriday(d),
      () => new ValidationError({ message: 'Can only set availability for Thursday or Friday' })
    ),
    Effect.as(dateStr)
  )

const validateBody = (body: unknown): Effect.Effect<SetAvailabilityInput, ValidationError> =>
  pipe(
    Schema.decodeUnknown(SetAvailabilityInput)(body),
    Effect.mapError(
      () => new ValidationError({ message: 'Invalid request body. Expected { available: boolean }' })
    )
  )

const getAuthenticatedUser = (authHeader: string | null) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ getUser }) => getUser(authHeader))
  )

const upsertAvailability = (userId: string, date: string, available: boolean) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runQuery(
        client
          .from('availability')
          .upsert({ user_id: userId, date, available }, { onConflict: 'user_id,date' })
          .select()
          .single()
      )
    )
  )

const deleteAvailability = (userId: string, date: string) =>
  pipe(
    SupabaseService,
    Effect.flatMap(({ client }) =>
      runMutation(
        client.from('availability').delete().eq('user_id', userId).eq('date', date)
      )
    )
  )

const handlePut = (req: VercelRequest, dateParam: string) =>
  pipe(
    Effect.all({
      date: validateDate(dateParam),
      body: validateBody(req.body),
      user: getAuthenticatedUser(req.headers.authorization ?? null),
    }),
    Effect.flatMap(({ date, body, user }) => upsertAvailability(user.id, date, body.available))
  )

const handleDelete = (req: VercelRequest, dateParam: string) =>
  pipe(
    Effect.all({
      date: validateDate(dateParam),
      user: getAuthenticatedUser(req.headers.authorization ?? null),
    }),
    Effect.flatMap(({ date, user }) => deleteAvailability(user.id, date)),
    Effect.as({ deleted: true })
  )

const handler = (req: VercelRequest, res: VercelResponse) => {
  const program = pipe(
    parsePathParams(req.query),
    Effect.flatMap(({ date }) =>
      req.method === 'PUT'
        ? handlePut(req, date)
        : req.method === 'DELETE'
          ? handleDelete(req, date)
          : Effect.fail(new ValidationError({ message: 'Method not allowed' }))
    ),
    Effect.provide(SupabaseServiceLive)
  )

  return Effect.runPromise(program)
    .then((data) => success(res, data))
    .catch((err) => handleError(res, err))
}

export default handler
