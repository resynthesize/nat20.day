import { supabase } from './supabase'
import { parseParties, parsePartyMembers, type PartyWithAdmins, type PartyMember } from './schemas'

// ============================================================================
// Supabase queries (direct to database, no Vercel function limit concerns)
// ============================================================================

export async function fetchParties(userId: string): Promise<PartyWithAdmins[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('parties')
    .select(`
      id,
      name,
      created_at,
      is_demo,
      days_of_week,
      theme,
      party_admins (
        profile_id
      )
    `)
    .eq('is_demo', false)
    .order('name')

  if (error) {
    console.error('Error fetching parties:', error)
    return []
  }

  return parseParties(data)
}

export interface AdminInfo {
  profile_id: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
}

export async function fetchPartyMembers(partyId: string): Promise<PartyMember[]> {
  if (!partyId) return []

  const { data, error } = await supabase
    .from('party_members')
    .select(`
      id,
      party_id,
      name,
      email,
      profile_id,
      created_at,
      profiles (
        display_name,
        avatar_url
      )
    `)
    .eq('party_id', partyId)
    .order('name')

  if (error) {
    console.error('Error fetching party members:', error)
    throw error
  }

  // Normalize joined data - Supabase returns joined relations as arrays
  const normalized = (data ?? []).map((item) => ({
    ...item,
    profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
  }))

  return parsePartyMembers(normalized)
}

export async function fetchPartyAdmins(partyId: string): Promise<AdminInfo[]> {
  if (!partyId) return []

  const { data, error } = await supabase
    .from('party_admins')
    .select(`
      profile_id,
      profiles (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('party_id', partyId)

  if (error) {
    console.error('Error fetching party admins:', error)
    throw error
  }

  // Normalize joined data
  return (data ?? []).map((item) => ({
    ...item,
    profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
  })) as AdminInfo[]
}

// ============================================================================
// Vercel API queries (conservative caching - free tier limits)
// ============================================================================

export interface SubscriptionInfo {
  id: string
  party_id: string
  status: 'active' | 'past_due' | 'canceled' | 'expired'
  current_period_end: string
  cancel_at_period_end: boolean
}

export async function fetchSubscription(
  partyId: string,
  accessToken: string
): Promise<SubscriptionInfo | null> {
  if (!partyId || !accessToken) return null

  const response = await fetch(`/api/v1/billing/subscription?party_id=${partyId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to fetch subscription')
  }

  return response.json()
}

export interface ApiToken {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
}

export async function fetchApiTokens(accessToken: string): Promise<ApiToken[]> {
  if (!accessToken) return []

  const response = await fetch('/api/tokens', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch tokens')
  }

  return result.data
}
