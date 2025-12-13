/**
 * Script to save browser auth state for Playwright testing.
 *
 * Usage:
 *   npx tsx scripts/save-auth-state.ts
 *
 * This opens a browser window for you to log in manually.
 * After logging in, the script saves the auth state to auth.json.
 */

import { chromium } from 'playwright'

const AUTH_FILE = 'auth.json'
const APP_URL = 'http://localhost:5173/app'

async function saveAuthState() {
  console.log('Opening browser for authentication...')
  console.log('Please log in to the app, then close the browser window when done.\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  await page.goto(APP_URL)

  // Wait for the user to log in and the page to show authenticated content
  console.log('Waiting for you to log in...')
  console.log('(The browser will stay open until you close it)\n')

  // Wait for the browser to be closed by the user
  await new Promise<void>((resolve) => {
    browser.on('disconnected', () => {
      console.log('Browser closed.')
      resolve()
    })
  })

  // Note: We can't save state after browser is closed
  // So instead we use a different approach - save on navigation
}

async function saveAuthStateOnSchedulePage() {
  console.log('Opening browser for authentication...')
  console.log('Please log in to the app.\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  await page.goto(APP_URL)

  // Wait for user to be on the schedule page (authenticated)
  console.log('Waiting for authentication (looking for schedule-container)...')

  try {
    // 5 minute timeout to allow for login
    await page.waitForSelector('.schedule-container', { timeout: 300000 })
    console.log('\nAuthenticated! Saving auth state...')

    // Wait a moment for full page load
    await page.waitForTimeout(2000)

    // Save storage state
    await context.storageState({ path: AUTH_FILE })
    console.log(`Auth state saved to ${AUTH_FILE}`)

    await browser.close()
    console.log('\nYou can now run: npx tsx scripts/mobile-screenshot.ts')
  } catch (error) {
    console.error('Timeout waiting for authentication. Please try again.')
    await browser.close()
    process.exit(1)
  }
}

saveAuthStateOnSchedulePage()
