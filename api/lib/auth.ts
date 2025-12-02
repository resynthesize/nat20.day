import { getServiceClient } from './supabase'
import { hashToken } from './crypto'

export interface TokenValidationResult {
  valid: boolean
  profileId?: string
  tokenId?: string
  error?: string
}

/**
 * Validate an API token from the Authorization header
 * Returns the profile_id if valid, or an error message if not
 */
export async function validateApiToken(
  authHeader: string | undefined
): Promise<TokenValidationResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.slice(7) // Remove "Bearer "

  if (!token.startsWith('nat20_')) {
    return { valid: false, error: 'Invalid token format' }
  }

  const tokenHash = hashToken(token)
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, profile_id')
    .eq('token_hash', tokenHash)
    .single()

  if (error || !data) {
    return { valid: false, error: 'Invalid or revoked token' }
  }

  // Update last_used_at (fire and forget - don't block the request)
  supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    valid: true,
    profileId: data.profile_id,
    tokenId: data.id,
  }
}

/**
 * Standard JSON error response
 */
export function errorResponse(code: string, message: string, status: number = 400) {
  return {
    success: false,
    error: { code, message },
    _status: status,
  }
}

/**
 * Standard JSON success response
 */
export function successResponse<T>(data: T) {
  return {
    success: true,
    data,
  }
}
