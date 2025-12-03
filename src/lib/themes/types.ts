/**
 * Theme System Types
 *
 * Defines the structure for game-based visual themes.
 * Each theme provides colors, typography, and metadata
 * that transform the app's look and feel.
 */

export type ThemeId = 'dnd' | 'mtg' | 'vtm'

export interface ThemeColors {
  // Backgrounds (4-level elevation system)
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgElevated: string

  // Accent colors
  accentPrimary: string // Main accent (gold for D&D, purple for MTG, crimson for VTM)
  accentPrimaryHover: string
  accentPrimaryLight: string
  accentSecondary: string // Secondary action color
  accentSecondaryHover: string

  // Text hierarchy
  textPrimary: string
  textSecondary: string
  textMuted: string

  // Borders
  borderColor: string

  // Availability status colors
  available: string
  availableBg: string
  unavailable: string
  unavailableBg: string
  unset: string
  unsetBg: string
}

export interface ThemeTypography {
  fontDisplay: string // Display/title font
  fontHeading: string // Headings
  fontBody: string // Body text
  fontUrls: string[] // Google Fonts URLs to load dynamically
}

export interface ThemeMetadata {
  id: ThemeId
  name: string // Full name: "Dungeons & Dragons"
  shortName: string // Abbreviated: "D&D"
  tagline: string // Subtitle for the app
  icon: string // Emoji icon for selector
}

export interface Theme {
  id: ThemeId
  metadata: ThemeMetadata
  colors: ThemeColors
  typography: ThemeTypography
}

export interface ThemeRegistry {
  [key: string]: Theme
}
