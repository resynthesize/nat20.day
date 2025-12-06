import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { generateToken } from './_lib/crypto.js'

// Request body schema for POST
const CreateTokenBodySchema = z.object({
  name: z.string().min(1).max(100),
})

// Query params schema for DELETE
const DeleteTokenQuerySchema = z.object({
  id: z.string().uuid(),
})

/**
 * Token Management API
 *
 * POST /api/tokens        - Create a new token
 * GET  /api/tokens        - List user's tokens
 * DELETE /api/tokens?id=x - Revoke a token
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
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

  try {
    // POST /api/tokens - Create new token
    if (req.method === 'POST') {
      const parsed = CreateTokenBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Token name is required (1-100 chars)' })
      }

      const { name } = parsed.data
      const { raw, hash, prefix } = generateToken()

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
    if (req.method === 'GET') {
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

    // DELETE /api/tokens?id=xxx - Delete token
    if (req.method === 'DELETE') {
      const parsed = DeleteTokenQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Valid token ID required' })
      }

      const tokenId = parsed.data.id
      const { error: deleteError } = await supabase
        .from('api_tokens')
        .delete()
        .eq('id', tokenId)
        .eq('profile_id', user.id)

      if (deleteError) {
        console.error('Error deleting token:', deleteError)
        return res.status(500).json({ success: false, error: 'Failed to delete token' })
      }

      return res.status(200).json({ success: true, data: { deleted: true } })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Token API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
