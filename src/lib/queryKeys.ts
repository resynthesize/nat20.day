export const queryKeys = {
  // Party-related (Supabase)
  parties: (userId: string) => ['parties', userId] as const,
  partyMembers: (partyId: string) => ['party', partyId, 'members'] as const,
  partyAdmins: (partyId: string) => ['party', partyId, 'admins'] as const,

  // Availability (Supabase)
  availability: (partyId: string) => ['availability', partyId] as const,

  // Sessions (Supabase)
  sessions: (partyId: string) => ['sessions', partyId] as const,

  // Billing (Vercel API - conservative caching)
  subscription: (partyId: string) => ['billing', 'subscription', partyId] as const,

  // API Tokens (Vercel API - conservative caching)
  apiTokens: (userId: string) => ['tokens', userId] as const,
} as const
