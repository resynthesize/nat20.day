import type { Theme } from './types'

/**
 * Vampire: The Masquerade Theme
 *
 * Gothic-Punk meets Neo-Noir, inspired by V5's art direction.
 * Deep blood reds and warm blacks create an intimate, dangerous atmosphere.
 * Serif typography evokes Victorian elegance with a modern edge.
 * The muted status colors maintain the somber, sophisticated mood.
 */
export const vtmTheme: Theme = {
  id: 'vtm',
  metadata: {
    id: 'vtm',
    name: 'Vampire: The Masquerade',
    shortName: 'V:TM',
    tagline: 'Night Council',
    icon: '\uD83E\uDE78', // 🩸
  },
  colors: {
    // Backgrounds - Almost black with warm undertones
    bgPrimary: '#0a0808',
    bgSecondary: '#120e0c',
    bgTertiary: '#1a1412',
    bgElevated: '#221a16',

    // Blood red accents - The essence of vampires
    accentPrimary: '#8b0000',
    accentPrimaryHover: '#a50000',
    accentPrimaryLight: '#d4a5a5',

    // Gothic gold accents - Victorian elegance
    accentSecondary: '#c9a227',
    accentSecondaryHover: '#dab838',

    // Text - Warm, aged paper tones
    textPrimary: '#e6e0dc',
    textSecondary: '#a89e96',
    textMuted: '#6b6058',

    // Borders
    borderColor: '#3a302a',

    // Availability status - Muted to fit gothic aesthetic
    available: '#4a7c4e',
    availableBg: 'rgba(74, 124, 78, 0.15)',
    unavailable: '#8b0000',
    unavailableBg: 'rgba(139, 0, 0, 0.1)',
    unset: '#4a4038',
    unsetBg: 'rgba(74, 64, 56, 0.2)',
  },
  typography: {
    // Cormorant Garamond - Elegant, gothic serif
    // Crimson Text - Readable body with character
    fontDisplay: "'Cormorant Garamond', serif",
    fontHeading: "'Cormorant Garamond', serif",
    fontBody: "'Crimson Text', serif",
    fontUrls: [
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Crimson+Text:wght@400;600;700&display=swap',
    ],
  },
}
