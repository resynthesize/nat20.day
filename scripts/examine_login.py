from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})

    # Navigate to the login/app page
    page.goto('http://localhost:5173/app')
    page.wait_for_load_state('domcontentloaded')
    page.wait_for_timeout(2000)  # Wait for React to render

    # Take a screenshot of the login page
    page.screenshot(path='/tmp/login_page.png', full_page=True)
    print("Screenshot saved to /tmp/login_page.png")

    # Get the page title
    print(f"\nPage title: {page.title()}")

    # Get all visible text content
    print("\n--- Page Content ---")
    body_text = page.locator('body').inner_text()
    print(body_text[:2000] if len(body_text) > 2000 else body_text)

    # Find all buttons
    print("\n--- Buttons Found ---")
    buttons = page.locator('button').all()
    for btn in buttons:
        text = btn.inner_text()
        classes = btn.get_attribute('class') or ''
        print(f"  Button: '{text}' | class: {classes[:50]}")

    # Find all links
    print("\n--- Links Found ---")
    links = page.locator('a').all()
    for link in links:
        text = link.inner_text()
        href = link.get_attribute('href') or ''
        print(f"  Link: '{text}' -> {href}")

    # Find form inputs
    print("\n--- Form Inputs Found ---")
    inputs = page.locator('input').all()
    for inp in inputs:
        input_type = inp.get_attribute('type') or 'text'
        name = inp.get_attribute('name') or ''
        placeholder = inp.get_attribute('placeholder') or ''
        print(f"  Input: type={input_type}, name={name}, placeholder={placeholder}")

    # Check for OAuth/Google sign-in elements
    print("\n--- Google OAuth Elements ---")
    google_elements = page.locator('[class*="google"], [id*="google"], [data-provider*="google"]').all()
    for elem in google_elements:
        tag = elem.evaluate('el => el.tagName')
        text = elem.inner_text() if elem.is_visible() else ''
        print(f"  {tag}: {text}")

    # Get main container structure
    print("\n--- Main Containers ---")
    containers = page.locator('.auth-container, .login-container, [class*="auth"], [class*="login"], main, .app').all()
    for container in containers[:5]:
        classes = container.get_attribute('class') or ''
        print(f"  Container: {classes}")

    browser.close()
    print("\nDone examining login page.")
