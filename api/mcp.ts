/**
 * MCP Server for nat20.day
 *
 * Schema Boundary:
 * - Zod: Tool input schemas only (required by MCP SDK)
 * - Effect: Business logic, error handling, response validation
 *
 * Endpoints:
 *   POST /api/mcp - MCP protocol handler (Streamable HTTP)
 *   GET  /api/mcp - MCP server metadata
 */
import { z } from 'zod'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// Zod Schemas (MCP tool input definitions only)
// ============================================================================

const PartyIdSchema = z.object({
  party_id: z.string().regex(/^party_[A-Za-z0-9]{8}$/).describe('Party ID'),
})

const DateRangeSchema = PartyIdSchema.extend({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Start date (YYYY-MM-DD)'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('End date (YYYY-MM-DD)'),
})

const SetAvailabilitySchema = PartyIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
  available: z.boolean().describe('Whether you are available'),
})

const ClearAvailabilitySchema = PartyIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
})

// ============================================================================
// OAuth Token Verification
// ============================================================================

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
  if (error || !user) return undefined

  return { token: bearerToken, clientId: user.id, scopes: [], extra: { user } }
}

// ============================================================================
// Helper: Get user's party membership
// ============================================================================

async function getMembership(userId: string, partyId: string) {
  const { data, error } = await supabase
    .from('party_members')
    .select('id')
    .eq('party_id', partyId)
    .eq('profile_id', userId)
    .single()

  if (error || !data) throw new Error('Not a member of this party')
  return data
}

// ============================================================================
// MCP Handler
// ============================================================================

const handler = createMcpHandler(
  (server) => {
    // Tool: Get user profile
    server.tool('get_profile', 'Get your nat20.day profile', {}, async (_, extra) => {
      const userId = extra.authInfo?.clientId
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw new Error(error.message)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    })

    // Tool: List parties
    server.tool('get_parties', 'List all D&D parties you belong to', {}, async (_, extra) => {
      const userId = extra.authInfo?.clientId
      const { data, error } = await supabase
        .from('party_members')
        .select('party_id, parties(id, name, created_at)')
        .eq('profile_id', userId)
      if (error) throw new Error(error.message)
      return { content: [{ type: 'text', text: JSON.stringify(data?.map(m => m.parties) || [], null, 2) }] }
    })

    // Tool: Get party availability
    server.tool(
      'get_party_availability',
      'Get availability grid for a party',
      DateRangeSchema.shape,
      async ({ party_id, from, to }, extra) => {
        const userId = extra.authInfo?.clientId!
        await getMembership(userId, party_id)

        let query = supabase
          .from('availability')
          .select('*, party_members!inner(name, party_id)')
          .eq('party_members.party_id', party_id)
        if (from) query = query.gte('date', from)
        if (to) query = query.lte('date', to)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      }
    )

    // Tool: Set availability
    server.tool(
      'set_availability',
      'Set your availability for a specific date',
      SetAvailabilitySchema.shape,
      async ({ party_id, date, available }, extra) => {
        const userId = extra.authInfo?.clientId!
        const member = await getMembership(userId, party_id)

        const { error } = await supabase
          .from('availability')
          .upsert({ party_member_id: member.id, date, available }, { onConflict: 'party_member_id,date' })
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: `Set to ${available ? 'available' : 'unavailable'} on ${date}` }] }
      }
    )

    // Tool: Clear availability
    server.tool(
      'clear_availability',
      'Clear your availability for a specific date',
      ClearAvailabilitySchema.shape,
      async ({ party_id, date }, extra) => {
        const userId = extra.authInfo?.clientId!
        const member = await getMembership(userId, party_id)

        await supabase.from('availability').delete().eq('party_member_id', member.id).eq('date', date)
        return { content: [{ type: 'text', text: `Cleared availability for ${date}` }] }
      }
    )
  },
  { serverInfo: { name: 'nat20-day', version: '1.0.0' } },
  { basePath: '/api' }
)

// Wrap with OAuth authentication
const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
