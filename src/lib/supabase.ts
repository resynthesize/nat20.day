import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

console.log('[Supabase] Creating client with URL:', supabaseUrl)

// Custom storage wrapper for debugging
const debugStorage = {
  getItem: (key: string) => {
    const value = localStorage.getItem(key)
    console.log('[Supabase Storage] getItem:', key, value ? `(${value.length} chars)` : 'null')
    return value
  },
  setItem: (key: string, value: string) => {
    console.log('[Supabase Storage] setItem:', key, `(${value.length} chars)`)
    localStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    console.log('[Supabase Storage] removeItem:', key)
    localStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'nat20-auth',
    storage: typeof window !== 'undefined' ? debugStorage : undefined,
  },
})

console.log('[Supabase] Client created')
