import { useTheme } from '@/hooks/useTheme'
import { themeList, type ThemeId } from '@/lib/themes'

/**
 * Theme selector for party settings.
 * Allows admins to choose a visual theme for their party.
 */
export function ThemeSelector() {
  const { themeId, setThemeId, isLoading } = useTheme()

  const handleChange = async (newThemeId: ThemeId) => {
    if (newThemeId === themeId) return

    try {
      await setThemeId(newThemeId)
    } catch (err) {
      console.error('Failed to change theme:', err)
    }
  }

  return (
    <div className="theme-selector">
      <h3>Party Theme</h3>
      <p className="form-hint">Choose a visual style that matches your game.</p>
      <div className="theme-options">
        {themeList.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-option ${themeId === theme.id ? 'selected' : ''}`}
            onClick={() => handleChange(theme.id)}
            disabled={isLoading}
            title={theme.metadata.name}
          >
            <span className="theme-icon">{theme.metadata.icon}</span>
            <span className="theme-name">{theme.metadata.shortName}</span>
            <span className="theme-tagline">{theme.metadata.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
