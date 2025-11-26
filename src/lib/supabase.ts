import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface PartyMember {
  id: string
  name: string
  email: string | null
  profile_id: string | null
  created_at: string
  profiles?: Pick<Profile, 'display_name' | 'avatar_url'> | null
}

export interface Availability {
  id: string
  party_member_id: string
  date: string
  available: boolean
  updated_at: string
}

export interface AvailabilityWithMember extends Availability {
  party_members: Pick<PartyMember, 'name'>
}
