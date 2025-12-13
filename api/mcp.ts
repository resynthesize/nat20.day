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

const ScheduleSessionSchema = PartyIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
  host_member_id: z.string().optional().describe('Party member ID of the host'),
  host_location: z.string().optional().describe('Custom location name (e.g., "Game Store", "Discord")'),
  host_address: z.string().optional().describe('Physical address or meeting URL'),
  is_virtual: z.boolean().optional().describe('Whether this is a virtual meeting'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Start time in HH:MM format (24-hour)'),
})

const SessionIdSchema = z.object({
  session_id: z.string().uuid().describe('Session ID'),
})

const UpdateSessionSchema = SessionIdSchema.extend({
  host_member_id: z.string().nullable().optional().describe('Party member ID of the host (null to clear)'),
  host_location: z.string().nullable().optional().describe('Custom location name (null to clear)'),
  host_address: z.string().nullable().optional().describe('Physical address or meeting URL (null to clear)'),
  is_virtual: z.boolean().optional().describe('Whether this is a virtual meeting'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe('Start time in HH:MM format (null to clear)'),
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

async function requireAdmin(userId: string, partyId: string) {
  const { data, error } = await supabase
    .from('party_admins')
    .select('id')
    .eq('party_id', partyId)
    .eq('profile_id', userId)
    .single()

  if (error || !data) throw new Error('Admin access required')
  return data
}

async function getSessionPartyId(sessionId: string): Promise<string> {
  const { data, error } = await supabase
    .from('sessions')
    .select('party_id')
    .eq('id', sessionId)
    .single()

  if (error || !data) throw new Error('Session not found')
  return data.party_id
}

// ============================================================================
// Tool Annotations (hints for AI models)
// ============================================================================

const ReadOnlyAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
}

const WriteAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: true,
}

// Clear is reversible (just call set_availability), so not truly destructive
const ClearAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: true,
}

// Destructive operations (delete sessions)
const DestructiveAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  destructiveHint: true,
  openWorldHint: true,
}

// ============================================================================
// MCP Handler
// ============================================================================

const handler = createMcpHandler(
  (server) => {
    // Tool: Get user profile
    server.tool(
      'get_profile',
      'Get your nat20.day profile including display name and avatar',
      {},
      { title: 'Get Profile', ...ReadOnlyAnnotations },
      async (_, extra) => {
        const userId = extra.authInfo?.clientId
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      }
    )

    // Tool: List parties
    server.tool(
      'get_parties',
      'List all D&D parties you belong to. Returns party IDs and whether you are an admin of each party.',
      {},
      { title: 'List Parties', ...ReadOnlyAnnotations },
      async (_, extra) => {
        const userId = extra.authInfo?.clientId

        // Get memberships with party info
        const { data: memberships, error: memberError } = await supabase
          .from('party_members')
          .select('party_id, parties(id, name, created_at)')
          .eq('profile_id', userId)
        if (memberError) throw new Error(memberError.message)

        // Get admin status for all parties
        const { data: adminships } = await supabase
          .from('party_admins')
          .select('party_id')
          .eq('profile_id', userId)

        const adminPartyIds = new Set(adminships?.map(a => a.party_id) || [])

        const parties = memberships?.map(m => ({
          ...m.parties,
          is_admin: adminPartyIds.has(m.party_id),
        })) || []

        return { content: [{ type: 'text', text: JSON.stringify(parties, null, 2) }] }
      }
    )

    // Tool: Get party availability
    server.tool(
      'get_party_availability',
      'Get availability grid showing when each party member is available. Use date filters to narrow results.',
      DateRangeSchema.shape,
      { title: 'Get Party Availability', ...ReadOnlyAnnotations },
      async ({ party_id, from, to }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')
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
      'Set your availability for a specific date. Use available=true to mark available, false for unavailable.',
      SetAvailabilitySchema.shape,
      { title: 'Set Availability', ...WriteAnnotations },
      async ({ party_id, date, available }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')
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
      'Remove your availability entry for a specific date, returning it to "no response" state.',
      ClearAvailabilitySchema.shape,
      { title: 'Clear Availability', ...ClearAnnotations },
      async ({ party_id, date }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')
        const member = await getMembership(userId, party_id)

        await supabase.from('availability').delete().eq('party_member_id', member.id).eq('date', date)
        return { content: [{ type: 'text', text: `Cleared availability for ${date}` }] }
      }
    )

    // Tool: Get scheduled sessions
    server.tool(
      'get_sessions',
      'Get scheduled sessions for a party, including host information. Use date filters to narrow results.',
      DateRangeSchema.shape,
      { title: 'Get Sessions', ...ReadOnlyAnnotations },
      async ({ party_id, from, to }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')
        await getMembership(userId, party_id)

        let query = supabase
          .from('sessions')
          .select(`
            id,
            party_id,
            date,
            start_time,
            host_member_id,
            host_location,
            host_address,
            is_virtual,
            confirmed_at,
            host_member:party_members!host_member_id(
              id,
              name,
              profiles(display_name, address)
            )
          `)
          .eq('party_id', party_id)
          .order('date', { ascending: true })

        if (from) query = query.gte('date', from)
        if (to) query = query.lte('date', to)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      }
    )

    // Tool: Schedule a session (admin only)
    server.tool(
      'schedule_session',
      'Schedule a D&D session for a specific date. Admin only. Optionally specify host (party member or custom location) and start time.',
      ScheduleSessionSchema.shape,
      { title: 'Schedule Session', ...WriteAnnotations },
      async ({ party_id, date, host_member_id, host_location, host_address, is_virtual, start_time }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')
        await requireAdmin(userId, party_id)

        const { data, error } = await supabase
          .from('sessions')
          .insert({
            party_id,
            date,
            confirmed_by: userId,
            host_member_id: host_member_id || null,
            host_location: host_location || null,
            host_address: host_address || null,
            is_virtual: is_virtual || false,
            start_time: start_time || null,
          })
          .select()
          .single()

        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: `Scheduled session for ${date}${start_time ? ` at ${start_time}` : ''}. Session ID: ${data.id}` }] }
      }
    )

    // Tool: Cancel a scheduled session (admin only)
    server.tool(
      'cancel_session',
      'Cancel (delete) a scheduled session. Admin only. This action cannot be undone.',
      SessionIdSchema.shape,
      { title: 'Cancel Session', ...DestructiveAnnotations },
      async ({ session_id }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')

        const partyId = await getSessionPartyId(session_id)
        await requireAdmin(userId, partyId)

        const { error } = await supabase.from('sessions').delete().eq('id', session_id)
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: `Session ${session_id} has been cancelled` }] }
      }
    )

    // Tool: Update session host info (admin only)
    server.tool(
      'update_session',
      'Update host information or start time for a scheduled session. Admin only. Use null values to clear fields.',
      UpdateSessionSchema.shape,
      { title: 'Update Session', ...WriteAnnotations },
      async ({ session_id, host_member_id, host_location, host_address, is_virtual, start_time }, extra) => {
        const userId = extra.authInfo?.clientId
        if (!userId) throw new Error('Authentication required')

        const partyId = await getSessionPartyId(session_id)
        await requireAdmin(userId, partyId)

        const updates: Record<string, unknown> = {}
        if (host_member_id !== undefined) updates.host_member_id = host_member_id
        if (host_location !== undefined) updates.host_location = host_location
        if (host_address !== undefined) updates.host_address = host_address
        if (is_virtual !== undefined) updates.is_virtual = is_virtual
        if (start_time !== undefined) updates.start_time = start_time

        if (Object.keys(updates).length === 0) {
          return { content: [{ type: 'text', text: 'No updates provided' }] }
        }

        const { error } = await supabase.from('sessions').update(updates).eq('id', session_id)
        if (error) throw new Error(error.message)
        return { content: [{ type: 'text', text: `Session ${session_id} updated` }] }
      }
    )
  },
  { serverInfo: { name: 'nat20-day', version: '1.0.0' } },
  { basePath: '/api' }
)

// Wrap with OAuth authentication
const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
