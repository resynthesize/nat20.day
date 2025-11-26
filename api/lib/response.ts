import type { VercelResponse } from '@vercel/node'
import { AuthError, DatabaseError } from './supabase'

export const success = <T>(res: VercelResponse, data: T, status = 200) => {
  return res.status(status).json({ success: true, data })
}

export const error = (
  res: VercelResponse,
  code: string,
  message: string,
  status = 400
) => {
  return res.status(status).json({
    success: false,
    error: { code, message },
  })
}

export const handleError = (res: VercelResponse, err: unknown) => {
  if (err instanceof AuthError) {
    return error(res, 'AUTH_ERROR', err.message, 401)
  }
  if (err instanceof DatabaseError) {
    return error(res, err.code ?? 'DATABASE_ERROR', err.message, 500)
  }
  if (err instanceof Error) {
    return error(res, 'INTERNAL_ERROR', err.message, 500)
  }
  return error(res, 'UNKNOWN_ERROR', 'An unexpected error occurred', 500)
}
