import type { VercelRequest, VercelResponse } from '@vercel/node'
import { validateApiToken, errorResponse, successResponse } from '../lib/auth.js'
import { getServiceClient } from '../lib/supabase.js'

/**
 * Programmatic API Router
 *
 * All routes require API token authentication via Authorization header:
 *   Authorization: Bearer nat20_...
 *
 * Endpoints:
 *   GET  /api/v1/me                              - Get user profile
 *   GET  /api/v1/parties                         - List user's parties
 *   GET  /api/v1/parties/:id/availability        - Get availability for a party
 *   PUT  /api/v1/availability/:memberId/:date    - Set availability
 *   DELETE /api/v1/availability/:memberId/:date  - Clear availability
 */

interface ApiContext {
  profileId: string
  supabase: ReturnType<typeof getServiceClient>
}

type RouteHandler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: ApiContext,
  params: Record<string, string>
) => Promise<void>

// Simple path pattern matching
function matchRoute(
  path: string,
  method: string,
  routes: Array<{ pattern: string; method: string; handler: RouteHandler }>
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue

    const patternParts = route.pattern.split('/')
    const pathParts = path.split('/')

    if (patternParts.length !== pathParts.length) continue

    const params: Record<string, string> = {}
    let matches = true

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i]
      } else if (patternParts[i] !== pathParts[i]) {
        matches = false
        break
      }
    }

    if (matches) {
      return { handler: route.handler, params }
    }
  }
  return null
}

// Route handlers
const handleGetMe: RouteHandler = async (_req, res, ctx) => {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, display_name, avatar_url, created_at')
    .eq('id', ctx.profileId)
    .single()

  if (error || !data) {
    return res.status(404).json(errorResponse('NOT_FOUND', 'Profile not found', 404))
  }

  res.json(successResponse(data))
}

const handleGetParties: RouteHandler = async (_req, res, ctx) => {
  // Get parties where user is a member
  const { data: memberData, error: memberError } = await ctx.supabase
    .from('party_members')
    .select('party_id')
    .eq('profile_id', ctx.profileId)

  if (memberError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to fetch parties', 500))
  }

  const partyIds = memberData.map((m) => m.party_id)

  if (partyIds.length === 0) {
    return res.json(successResponse([]))
  }

  const { data: parties, error: partiesError } = await ctx.supabase
    .from('parties')
    .select('id, name, created_at')
    .in('id', partyIds)
    .order('name')

  if (partiesError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to fetch parties', 500))
  }

  res.json(successResponse(parties))
}

const handleGetPartyAvailability: RouteHandler = async (req, res, ctx, params) => {
  const partyId = params.id

  // Verify user is a member of this party
  const { data: membership, error: memberError } = await ctx.supabase
    .from('party_members')
    .select('id')
    .eq('party_id', partyId)
    .eq('profile_id', ctx.profileId)
    .single()

  if (memberError || !membership) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Not a member of this party', 403))
  }

  // Get optional date range from query params
  const fromDate = (req.query.from as string) || new Date().toISOString().split('T')[0]
  const toDate = req.query.to as string

  // Get all party members
  const { data: members, error: membersError } = await ctx.supabase
    .from('party_members')
    .select('id, name, profile_id, profiles(display_name, avatar_url)')
    .eq('party_id', partyId)
    .order('name')

  if (membersError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to fetch members', 500))
  }

  // Get availability
  let availabilityQuery = ctx.supabase
    .from('availability')
    .select('id, party_member_id, date, available, updated_at')
    .in('party_member_id', members.map((m) => m.id))
    .gte('date', fromDate)
    .order('date')

  if (toDate) {
    availabilityQuery = availabilityQuery.lte('date', toDate)
  }

  const { data: availability, error: availError } = await availabilityQuery

  if (availError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to fetch availability', 500))
  }

  res.json(
    successResponse({
      party_id: partyId,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        profile_id: m.profile_id,
        display_name: (m.profiles as { display_name?: string })?.display_name || m.name,
      })),
      availability,
    })
  )
}

const handleSetAvailability: RouteHandler = async (req, res, ctx, params) => {
  const { memberId, date } = params
  const { available } = req.body as { available?: boolean }

  if (typeof available !== 'boolean') {
    return res.status(400).json(errorResponse('INVALID_INPUT', 'available must be a boolean', 400))
  }

  // Verify user owns this party member or is an admin
  const { data: member, error: memberError } = await ctx.supabase
    .from('party_members')
    .select('id, party_id, profile_id')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return res.status(404).json(errorResponse('NOT_FOUND', 'Party member not found', 404))
  }

  // Check if user owns this member
  const isOwner = member.profile_id === ctx.profileId

  // Check if user is admin of the party
  const { data: adminCheck } = await ctx.supabase
    .from('party_admins')
    .select('profile_id')
    .eq('party_id', member.party_id)
    .eq('profile_id', ctx.profileId)
    .single()

  const isAdmin = !!adminCheck

  if (!isOwner && !isAdmin) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Cannot edit this member\'s availability', 403))
  }

  // Upsert availability
  const { error: upsertError } = await ctx.supabase.from('availability').upsert(
    {
      party_member_id: memberId,
      date,
      available,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'party_member_id,date' }
  )

  if (upsertError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to set availability', 500))
  }

  res.json(successResponse({ party_member_id: memberId, date, available }))
}

const handleDeleteAvailability: RouteHandler = async (_req, res, ctx, params) => {
  const { memberId, date } = params

  // Verify user owns this party member or is an admin
  const { data: member, error: memberError } = await ctx.supabase
    .from('party_members')
    .select('id, party_id, profile_id')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return res.status(404).json(errorResponse('NOT_FOUND', 'Party member not found', 404))
  }

  const isOwner = member.profile_id === ctx.profileId

  const { data: adminCheck } = await ctx.supabase
    .from('party_admins')
    .select('profile_id')
    .eq('party_id', member.party_id)
    .eq('profile_id', ctx.profileId)
    .single()

  const isAdmin = !!adminCheck

  if (!isOwner && !isAdmin) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Cannot edit this member\'s availability', 403))
  }

  // Delete availability
  const { error: deleteError } = await ctx.supabase
    .from('availability')
    .delete()
    .eq('party_member_id', memberId)
    .eq('date', date)

  if (deleteError) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Failed to clear availability', 500))
  }

  res.json(successResponse({ deleted: true }))
}

// Route definitions
const routes: Array<{ pattern: string; method: string; handler: RouteHandler }> = [
  { pattern: 'me', method: 'GET', handler: handleGetMe },
  { pattern: 'parties', method: 'GET', handler: handleGetParties },
  { pattern: 'parties/:id/availability', method: 'GET', handler: handleGetPartyAvailability },
  { pattern: 'availability/:memberId/:date', method: 'PUT', handler: handleSetAvailability },
  { pattern: 'availability/:memberId/:date', method: 'DELETE', handler: handleDeleteAvailability },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Validate API token
  const authResult = await validateApiToken(req.headers.authorization)
  if (!authResult.valid || !authResult.profileId) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', authResult.error || 'Invalid token', 401))
  }

  // Parse path
  const pathSegments = req.query.path as string[] | undefined
  const path = pathSegments?.join('/') || ''
  const method = req.method || 'GET'

  // Match route
  const match = matchRoute(path, method, routes)
  if (!match) {
    return res.status(404).json(errorResponse('NOT_FOUND', `No route for ${method} /api/v1/${path}`, 404))
  }

  // Execute handler
  try {
    const ctx: ApiContext = {
      profileId: authResult.profileId,
      supabase: getServiceClient(),
    }
    await match.handler(req, res, ctx, match.params)
  } catch (err) {
    console.error('API error:', err)
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500))
  }
}
