/**
 * Script to capture mobile viewport screenshots for testing.
 *
 * Prerequisites:
 *   1. Run the dev server: npm run dev
 *   2. Save auth state: npx tsx scripts/save-auth-state.ts
 *
 * Usage:
 *   npx tsx scripts/mobile-screenshot.ts
 *
 * Output: Screenshots saved to test-results/mobile/
 */

import { chromium, devices } from 'playwright'
import { existsSync, mkdirSync } from 'fs'

const AUTH_FILE = 'auth.json'
const APP_URL = 'http://localhost:5173/app'
const OUTPUT_DIR = 'test-results/mobile'

// iPhone 14 viewport
const IPHONE_VIEWPORT = devices['iPhone 14']

async function captureScreenshots() {
  // Check auth file exists
  if (!existsSync(AUTH_FILE)) {
    console.error(`Auth file not found: ${AUTH_FILE}`)
    console.error('Run: npx tsx scripts/save-auth-state.ts')
    process.exit(1)
  }

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Launching browser with mobile viewport...')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...IPHONE_VIEWPORT,
    storageState: AUTH_FILE,
  })
  const page = await context.newPage()

  try {
    // Navigate to app
    console.log(`Navigating to ${APP_URL}...`)
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // Wait for schedule container to load
    await page.waitForSelector('.schedule-container', { timeout: 10000 })
    console.log('Page loaded.')

    // Wait a bit for any animations
    await page.waitForTimeout(500)

    // Capture full page screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${OUTPUT_DIR}/mobile-${timestamp}.png`

    await page.screenshot({
      path: filename,
      fullPage: true,
    })
    console.log(`Screenshot saved: ${filename}`)

    // Also capture just the viewport (what user sees initially)
    const viewportFilename = `${OUTPUT_DIR}/mobile-viewport-${timestamp}.png`
    await page.screenshot({
      path: viewportFilename,
      fullPage: false,
    })
    console.log(`Viewport screenshot saved: ${viewportFilename}`)

    // Test hamburger menu
    const hamburger = page.locator('.mobile-menu-button')
    if (await hamburger.isVisible()) {
      console.log('Testing hamburger menu...')
      await hamburger.click()
      await page.waitForTimeout(300)

      const menuFilename = `${OUTPUT_DIR}/mobile-menu-open-${timestamp}.png`
      await page.screenshot({
        path: menuFilename,
        fullPage: false,
      })
      console.log(`Menu screenshot saved: ${menuFilename}`)
    } else {
      console.log('Hamburger menu not visible (viewport may be too wide)')
    }

  } catch (error) {
    console.error('Error capturing screenshots:', error)
    // Save error screenshot
    await page.screenshot({ path: `${OUTPUT_DIR}/error.png` })
    process.exit(1)
  } finally {
    await browser.close()
  }

  console.log('\nDone! Screenshots saved to:', OUTPUT_DIR)
}

captureScreenshots()
