import type { Theme } from './types'

/**
 * Dungeons & Dragons Theme
 *
 * Inspired by D&D Beyond's dark fantasy aesthetic.
 * Gold accents evoke treasure and magic items,
 * while red suggests the drama of combat encounters.
 */
export const dndTheme: Theme = {
  id: 'dnd',
  metadata: {
    id: 'dnd',
    name: 'Dungeons & Dragons',
    shortName: 'D&D',
    tagline: 'Session Scheduler',
    icon: '\u2694\uFE0F', // ⚔️
  },
  colors: {
    // Backgrounds - Dark fantasy palette
    bgPrimary: '#12181c',
    bgSecondary: '#1a1f23',
    bgTertiary: '#232b2f',
    bgElevated: '#2a3238',

    // Gold accents - D&D's signature color
    accentPrimary: '#c49250',
    accentPrimaryHover: '#d4a660',
    accentPrimaryLight: '#f0dcb4',
    accentPrimaryBg: 'rgba(196, 146, 80, 0.15)',

    // Red accents - Action and combat
    accentSecondary: '#c53030',
    accentSecondaryHover: '#e53e3e',

    // Text
    textPrimary: '#ecedee',
    textSecondary: '#a8b3b9',
    textMuted: '#6c7a82',

    // Borders
    borderColor: '#3a4349',

    // Availability status
    available: '#48bb78',
    availableBg: 'rgba(72, 187, 120, 0.15)',
    unavailable: '#e53e3e',
    unavailableBg: 'rgba(229, 62, 62, 0.1)',
    unset: '#4a5568',
    unsetBg: 'rgba(74, 85, 104, 0.2)',
  },
  typography: {
    fontDisplay: "'JetBrains Mono', monospace",
    fontHeading: "'JetBrains Mono', monospace",
    fontBody: "'JetBrains Mono', monospace",
    fontUrls: [
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
    ],
  },
}
