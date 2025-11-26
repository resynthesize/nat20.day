import { z } from 'zod'

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  is_admin: z.boolean(),
  created_at: z.string(),
})

export type Profile = z.infer<typeof ProfileSchema>

const ProfileJoinSchema = z.object({
  display_name: z.string(),
  avatar_url: z.string().nullable(),
})

export const PartyMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  profile_id: z.string().nullable(),
  created_at: z.string(),
  profiles: ProfileJoinSchema.nullable().optional(),
})

export type PartyMember = z.infer<typeof PartyMemberSchema>

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
