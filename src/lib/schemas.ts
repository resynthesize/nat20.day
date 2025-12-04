import { z } from 'zod'

// =============================================================================
// Theme Schemas
// =============================================================================

export const ThemeIdSchema = z.enum(['dnd', 'mtg', 'vtm'])
export type ThemeId = z.infer<typeof ThemeIdSchema>

// =============================================================================
// Profile Schemas
// =============================================================================

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  created_at: z.string(),
})

export type Profile = z.infer<typeof ProfileSchema>

const ProfileJoinSchema = z.object({
  display_name: z.string(),
  avatar_url: z.string().nullable(),
})

// =============================================================================
// Party Schemas
// =============================================================================

export const PartySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  theme: ThemeIdSchema.optional().default('dnd'),
})

export type Party = z.infer<typeof PartySchema>

export const PartyAdminSchema = z.object({
  party_id: z.string(),
  profile_id: z.string(),
  created_at: z.string(),
})

export type PartyAdmin = z.infer<typeof PartyAdminSchema>

// Party with admin info (for checking if current user is admin)
export const PartyWithAdminsSchema = PartySchema.extend({
  party_admins: z.array(z.object({
    profile_id: z.string(),
  })),
})

export type PartyWithAdmins = z.infer<typeof PartyWithAdminsSchema>

// =============================================================================
// Party Member Schemas
// =============================================================================

export const PartyMemberSchema = z.object({
  id: z.string(),
  party_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  profile_id: z.string().nullable(),
  created_at: z.string(),
  profiles: ProfileJoinSchema.nullable().optional(),
})

export type PartyMember = z.infer<typeof PartyMemberSchema>

// =============================================================================
// Availability Schemas
// =============================================================================

export const AvailabilitySchema = z.object({
  id: z.string(),
  party_member_id: z.string(),
  date: z.string(),
  available: z.boolean(),
  updated_at: z.string(),
})

export type Availability = z.infer<typeof AvailabilitySchema>

const PartyMemberJoinSchema = z.object({
  name: z.string(),
})

export const AvailabilityWithMemberSchema = AvailabilitySchema.extend({
  party_members: PartyMemberJoinSchema,
})

export type AvailabilityWithMember = z.infer<typeof AvailabilityWithMemberSchema>

// =============================================================================
// Session Schemas
// =============================================================================

export const SessionSchema = z.object({
  id: z.string(),
  party_id: z.string(),
  date: z.string(),
  confirmed_by: z.string().nullable(),
  confirmed_at: z.string(),
})

export type Session = z.infer<typeof SessionSchema>

// =============================================================================
// Parse Functions
// =============================================================================

export const parseProfile = (data: unknown): Profile | null => {
  const result = ProfileSchema.safeParse(data)
  return result.success ? result.data : null
}

export const parsePartyMembers = (data: unknown): PartyMember[] => {
  const result = z.array(PartyMemberSchema).safeParse(data)
  return result.success ? result.data : []
}

export const parseAvailabilityWithMembers = (data: unknown): AvailabilityWithMember[] => {
  const result = z.array(AvailabilityWithMemberSchema).safeParse(data)
  return result.success ? result.data : []
}

export const parseParties = (data: unknown): PartyWithAdmins[] => {
  const result = z.array(PartyWithAdminsSchema).safeParse(data)
  return result.success ? result.data : []
}

export const parseParty = (data: unknown): PartyWithAdmins | null => {
  const result = PartyWithAdminsSchema.safeParse(data)
  return result.success ? result.data : null
}

export const parseSessions = (data: unknown): Session[] => {
  const result = z.array(SessionSchema).safeParse(data)
  return result.success ? result.data : []
}
