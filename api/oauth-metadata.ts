/**
 * OAuth Protected Resource Metadata
 *
 * MCP clients discover authentication requirements via this endpoint.
 * Returns RFC 9470 Protected Resource Metadata pointing to Supabase OAuth.
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
 */
import { protectedResourceHandler } from 'mcp-handler'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!

const handler = protectedResourceHandler({
  authServerUrls: [`${SUPABASE_URL}/auth/v1`],
})

export { handler as GET }
