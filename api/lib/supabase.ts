import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service role client for API endpoints (bypasses RLS)
let serviceClient: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceClient
}
