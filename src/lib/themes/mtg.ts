import type { Theme } from './types'

/**
 * Magic: The Gathering Theme
 *
 * A mystical, strategic aesthetic inspired by the five mana colors.
 * Purple evokes the arcane and mysterious nature of planeswalkers,
 * while blue represents the strategic depth of the game.
 * Clean, modern typography reflects MTG's competitive scene.
 */
export const mtgTheme: Theme = {
  id: 'mtg',
  metadata: {
    id: 'mtg',
    name: 'Magic: The Gathering',
    shortName: 'MTG',
    tagline: 'Game Night Planner',
    icon: '\u2728', // ✨
  },
  colors: {
    // Backgrounds - Deeper, more mystical darkness
    bgPrimary: '#0d0f14',
    bgSecondary: '#151922',
    bgTertiary: '#1c212c',
    bgElevated: '#252b38',

    // Purple accents - Arcane, mystical energy
    accentPrimary: '#9b7ed9',
    accentPrimaryHover: '#b094e8',
    accentPrimaryLight: '#d4c4f0',
    accentPrimaryBg: 'rgba(155, 126, 217, 0.15)',

    // Blue accents - Strategic, controlled
    accentSecondary: '#3d82c6',
    accentSecondaryHover: '#5294d4',

    // Text
    textPrimary: '#e8eaed',
    textSecondary: '#9aa3b0',
    textMuted: '#5c6573',

    // Borders
    borderColor: '#2d3545',

    // Availability status
    available: '#4caf50',
    availableBg: 'rgba(76, 175, 80, 0.15)',
    unavailable: '#f44336',
    unavailableBg: 'rgba(244, 67, 54, 0.1)',
    unset: '#546e7a',
    unsetBg: 'rgba(84, 110, 122, 0.2)',
  },
  typography: {
    // Cinzel for display - Elegant, fantasy serif
    // Raleway for headings - Modern, clean
    // Source Sans for body - Highly readable
    fontDisplay: "'Cinzel', serif",
    fontHeading: "'Raleway', sans-serif",
    fontBody: "'Source Sans 3', sans-serif",
    fontUrls: [
      'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Raleway:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap',
    ],
  },
}
