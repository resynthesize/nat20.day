/**
 * Map URL utilities for generating links to Google Maps and Apple Maps
 */

/**
 * Check if a string is a valid URL
 */
export function isUrl(text: string): boolean {
  if (!text) return false
  try {
    new URL(text)
    return true
  } catch {
    return false
  }
}

/**
 * Generate a Google Maps search URL for an address
 */
export function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/**
 * Generate an Apple Maps URL for an address
 */
export function getAppleMapsUrl(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

/**
 * Get both map URLs for an address, or null if the address is a URL (meeting link)
 */
export function getMapsUrls(address: string): { google: string; apple: string } | null {
  if (!address || isUrl(address)) {
    return null // It's a meeting URL, not a physical address
  }
  return {
    google: getGoogleMapsUrl(address),
    apple: getAppleMapsUrl(address),
  }
}
