/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  getTheme,
  defaultThemeId,
  isValidThemeId,
  type Theme,
  type ThemeId,
} from '../lib/themes'
import { useParty } from './useParty'
import { supabase } from '../lib/supabase'

interface ThemeContextValue {
  theme: Theme
  themeId: ThemeId
  setThemeId: (id: ThemeId) => Promise<void>
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Apply theme CSS variables to the document root.
 * This enables all CSS using var(--*) to update automatically.
 */
function applyThemeToDOM(theme: Theme): void {
  const root = document.documentElement

  // Background colors
  root.style.setProperty('--bg-primary', theme.colors.bgPrimary)
  root.style.setProperty('--bg-secondary', theme.colors.bgSecondary)
  root.style.setProperty('--bg-tertiary', theme.colors.bgTertiary)
  root.style.setProperty('--bg-elevated', theme.colors.bgElevated)

  // Accent colors (new naming)
  root.style.setProperty('--accent-primary', theme.colors.accentPrimary)
  root.style.setProperty('--accent-primary-hover', theme.colors.accentPrimaryHover)
  root.style.setProperty('--accent-primary-light', theme.colors.accentPrimaryLight)
  root.style.setProperty('--accent-secondary', theme.colors.accentSecondary)
  root.style.setProperty('--accent-secondary-hover', theme.colors.accentSecondaryHover)

  // Legacy aliases for backwards compatibility
  root.style.setProperty('--gold', theme.colors.accentPrimary)
  root.style.setProperty('--gold-hover', theme.colors.accentPrimaryHover)
  root.style.setProperty('--gold-light', theme.colors.accentPrimaryLight)
  root.style.setProperty('--accent-red', theme.colors.accentSecondary)
  root.style.setProperty('--accent-red-hover', theme.colors.accentSecondaryHover)

  // Text colors
  root.style.setProperty('--text-primary', theme.colors.textPrimary)
  root.style.setProperty('--text-secondary', theme.colors.textSecondary)
  root.style.setProperty('--text-muted', theme.colors.textMuted)

  // Border color
  root.style.setProperty('--border-color', theme.colors.borderColor)

  // Availability status colors
  root.style.setProperty('--available', theme.colors.available)
  root.style.setProperty('--available-bg', theme.colors.availableBg)
  root.style.setProperty('--unavailable', theme.colors.unavailable)
  root.style.setProperty('--unavailable-bg', theme.colors.unavailableBg)
  root.style.setProperty('--unset', theme.colors.unset)
  root.style.setProperty('--unset-bg', theme.colors.unsetBg)

  // Typography
  root.style.setProperty('--font-display', theme.typography.fontDisplay)
  root.style.setProperty('--font-heading', theme.typography.fontHeading)
  root.style.setProperty('--font-body', theme.typography.fontBody)

  // Set data attribute for potential CSS selectors (e.g., [data-theme="vtm"])
  root.dataset.theme = theme.id
}

/**
 * Dynamically load Google Fonts by injecting link tags.
 * Skips fonts that are already loaded.
 */
function loadFonts(urls: string[]): void {
  urls.forEach((url) => {
    // Check if already loaded
    const existingLink = document.querySelector(`link[href="${url}"]`)
    if (existingLink) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentParty } = useParty()
  const [themeId, setThemeIdState] = useState<ThemeId>(defaultThemeId)
  const [isLoading, setIsLoading] = useState(false)

  const theme = getTheme(themeId)

  // Sync theme with current party
  useEffect(() => {
    if (currentParty?.theme && isValidThemeId(currentParty.theme)) {
      setThemeIdState(currentParty.theme)
    } else {
      setThemeIdState(defaultThemeId)
    }
  }, [currentParty?.theme])

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    loadFonts(theme.typography.fontUrls)
    applyThemeToDOM(theme)
  }, [theme])

  // Update theme in database (admin only)
  const setThemeId = useCallback(
    async (id: ThemeId) => {
      if (!currentParty) return
      if (!isValidThemeId(id)) return

      setIsLoading(true)

      try {
        const { error } = await supabase
          .from('parties')
          .update({ theme: id })
          .eq('id', currentParty.id)

        if (error) throw error

        // Optimistically update local state
        setThemeIdState(id)
      } catch (err) {
        console.error('Failed to update theme:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [currentParty]
  )

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
