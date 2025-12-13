import type { PartyMember } from './schemas'

/**
 * Resolves the display name for a party member using priority:
 * 1. party_members.display_name (per-party override)
 * 2. profiles.display_name (global profile name)
 * 3. party_members.name (admin-managed fallback)
 */
export function getDisplayName(member: PartyMember): string {
  return member.display_name ?? member.profiles?.display_name ?? member.name
}

/**
 * Resolves display name for a host member (from session join)
 * Same priority chain as getDisplayName
 */
export function getHostDisplayName(hostMember: {
  name: string
  display_name?: string | null
  profiles?: { display_name: string } | null
} | null | undefined): string | null {
  if (!hostMember) return null
  return hostMember.display_name ?? hostMember.profiles?.display_name ?? hostMember.name
}
