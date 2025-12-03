import { randomBytes, createHash } from 'crypto'

export interface GeneratedToken {
  raw: string      // Full token to show user once
  hash: string     // SHA-256 hash to store in DB
  prefix: string   // First 8 chars for identification
}

// Token prefix constant - used for validation across handlers
export const TOKEN_PREFIX = 'nat20_'

// Base62 alphabet (alphanumeric, no confusing chars)
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Convert bytes to base62 string
 * More compact than hex while still URL-safe
 */
function toBase62(bytes: Buffer): string {
  let result = ''
  for (const byte of bytes) {
    result += BASE62[byte % 62]
  }
  return result
}

/**
 * Generate a new API token
 * Format: nat20_<22 base62 characters>
 * Example: nat20_aB3kLmN9pQrS7tUvWxYz12
 *
 * 128 bits of entropy (16 random bytes encoded as base62)
 * D&D themed prefix because rolling a nat 20 is the best!
 */
export function generateToken(): GeneratedToken {
  const randomPart = toBase62(randomBytes(22)) // 22 chars of base62
  const raw = `nat20_${randomPart}`
  const hash = hashToken(raw)
  const prefix = raw.slice(0, 10) // "nat20_aBc1"

  return { raw, hash, prefix }
}

/**
 * Hash a token using SHA-256
 * Used for both storage and lookup
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
