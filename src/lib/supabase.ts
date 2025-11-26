import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Availability {
  id: string
  user_id: string
  date: string
  available: boolean
  updated_at: string
}

export interface AvailabilityWithProfile extends Availability {
  profiles: Pick<Profile, 'display_name' | 'avatar_url'>
}
