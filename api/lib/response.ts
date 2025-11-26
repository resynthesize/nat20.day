import type { VercelResponse } from '@vercel/node'
import { Match } from 'effect'
import { AuthError, DatabaseError, ValidationError } from './errors'

export const success = <T>(res: VercelResponse, data: T, status = 200) =>
  res.status(status).json({ success: true, data })

export const error = (
  res: VercelResponse,
  code: string,
  message: string,
  status = 400
) =>
  res.status(status).json({
    success: false,
    error: { code, message },
  })

// Pattern match on tagged errors for clean error handling
export const handleError = (res: VercelResponse, err: unknown) =>
  Match.value(err).pipe(
    Match.when(Match.instanceOf(ValidationError), (e) =>
      error(res, 'VALIDATION_ERROR', e.message, 400)
    ),
    Match.when(Match.instanceOf(AuthError), (e) =>
      error(res, 'AUTH_ERROR', e.message, 401)
    ),
    Match.when(Match.instanceOf(DatabaseError), (e) =>
      error(res, e.code ?? 'DATABASE_ERROR', e.message, 500)
    ),
    Match.when(Match.instanceOf(Error), (e) =>
      error(res, 'INTERNAL_ERROR', e.message, 500)
    ),
    Match.orElse(() => error(res, 'UNKNOWN_ERROR', 'An unexpected error occurred', 500))
  )
