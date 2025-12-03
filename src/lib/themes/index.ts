/**
 * Theme Registry
 *
 * Central export point for all themes.
 * New themes are added here after creating their definition file.
 */

import { dndTheme } from './dnd'
import { mtgTheme } from './mtg'
import { vtmTheme } from './vtm'
import type { Theme, ThemeId, ThemeRegistry } from './types'

export const themes: ThemeRegistry = {
  dnd: dndTheme,
  mtg: mtgTheme,
  vtm: vtmTheme,
}

export const themeList = Object.values(themes)

export const defaultThemeId: ThemeId = 'dnd'

export function getTheme(id: ThemeId): Theme {
  return themes[id] ?? themes[defaultThemeId]
}

export function isValidThemeId(id: string): id is ThemeId {
  return id in themes
}

// Re-export types for convenience
export type { Theme, ThemeId, ThemeColors, ThemeTypography, ThemeMetadata } from './types'
