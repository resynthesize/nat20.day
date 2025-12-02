import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { generateToken } from '../lib/crypto'

/**
 * Token Management API
 *
 * POST /api/tokens - Create a new token (returns raw token once)
 * GET /api/tokens - List user's tokens (prefix only)
 * DELETE /api/tokens/:id - Revoke a token
 *
 * All routes require Supabase session authentication (via cookie/header)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Create Supabase client with user's auth
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  // Get auth token from request
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing authorization' })
  }

  const accessToken = authHeader.slice(7)

  // Create client with user's session
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })

  // Verify user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid session' })
  }

  // Parse the action from the URL path
  const action = req.query.action as string[] | undefined
  const path = action?.join('/') || ''

  try {
    // POST /api/tokens - Create new token
    if (req.method === 'POST' && path === '') {
      const { name } = req.body as { name?: string }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Token name is required' })
      }

      if (name.length > 100) {
        return res.status(400).json({ success: false, error: 'Token name too long (max 100 chars)' })
      }

      // Generate token
      const { raw, hash, prefix } = generateToken()

      // Store in database (only hash, never raw)
      const { error: insertError } = await supabase.from('api_tokens').insert({
        profile_id: user.id,
        name: name.trim(),
        token_hash: hash,
        token_prefix: prefix,
      })

      if (insertError) {
        console.error('Error creating token:', insertError)
        return res.status(500).json({ success: false, error: 'Failed to create token' })
      }

      // Return raw token (shown only once!)
      return res.status(201).json({
        success: true,
        data: {
          token: raw,
          prefix,
          name: name.trim(),
          message: 'Save this token now - you will not be able to see it again!',
        },
      })
    }

    // GET /api/tokens - List tokens
    if (req.method === 'GET' && path === '') {
      const { data: tokens, error: listError } = await supabase
        .from('api_tokens')
        .select('id, name, token_prefix, created_at, last_used_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })

      if (listError) {
        console.error('Error listing tokens:', listError)
        return res.status(500).json({ success: false, error: 'Failed to list tokens' })
      }

      return res.status(200).json({ success: true, data: tokens })
    }

    // DELETE /api/tokens/:id - Delete token
    if (req.method === 'DELETE' && path) {
      const tokenId = path

      const { error: deleteError } = await supabase
        .from('api_tokens')
        .delete()
        .eq('id', tokenId)
        .eq('profile_id', user.id) // Ensure user owns the token

      if (deleteError) {
        console.error('Error deleting token:', deleteError)
        return res.status(500).json({ success: false, error: 'Failed to delete token' })
      }

      return res.status(200).json({ success: true, data: { deleted: true } })
    }

    // Unknown route
    return res.status(404).json({ success: false, error: 'Not found' })
  } catch (err) {
    console.error('Token API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
