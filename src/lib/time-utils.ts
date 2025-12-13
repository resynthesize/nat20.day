/**
 * Time preset utilities for the scheduler
 */

import { TIME_PRESETS } from './constants'

export interface TimeOption {
  value: string // "17:00" - 24-hour format for storage
  label: string // "5 PM" - 12-hour format for display
}

/**
 * Format 24-hour time string to 12-hour display
 * "17:00" -> "5 PM"
 * "17:30" -> "5:30 PM"
 */
export function formatTimeDisplay(time: string): string {
  const [hourStr, minuteStr] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr || '00'

  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const ampm = hour < 12 ? 'AM' : 'PM'

  if (minute === '00') {
    return `${hour12} ${ampm}`
  }
  return `${hour12}:${minute} ${ampm}`
}

/**
 * Generate all hourly time options (00:00 - 23:00)
 */
export function generateHourlyOptions(): TimeOption[] {
  return Array.from({ length: 24 }, (_, i) => {
    const hour24 = i.toString().padStart(2, '0')
    const value = `${hour24}:00`
    return {
      value,
      label: formatTimeDisplay(value),
    }
  })
}

/**
 * Generate all half-hour time options (00:00, 00:30, 01:00, ...)
 */
export function generateHalfHourOptions(): TimeOption[] {
  const options: TimeOption[] = []
  for (let i = 0; i < 24; i++) {
    const hour24 = i.toString().padStart(2, '0')
    options.push({
      value: `${hour24}:00`,
      label: formatTimeDisplay(`${hour24}:00`),
    })
    options.push({
      value: `${hour24}:30`,
      label: formatTimeDisplay(`${hour24}:30`),
    })
  }
  return options
}

/**
 * Sort time strings chronologically
 */
export function sortTimes(times: string[]): string[] {
  return [...times].sort((a, b) => {
    const [aH, aM] = a.split(':').map(Number)
    const [bH, bM] = b.split(':').map(Number)
    return aH * 60 + aM - (bH * 60 + bM)
  })
}

/**
 * Get the effective presets to display in scheduler
 * Returns default_time_presets if set, otherwise first 4 from time_options
 */
export function getEffectivePresets(
  timeOptions?: string[],
  defaultPresets?: string[] | null
): TimeOption[] {
  const defaults =
    defaultPresets ?? timeOptions?.slice(0, TIME_PRESETS.MAX_PRESETS) ?? TIME_PRESETS.DEFAULT_OPTIONS
  return defaults.map((value) => ({
    value,
    label: formatTimeDisplay(value),
  }))
}
