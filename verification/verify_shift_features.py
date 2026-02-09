from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Capture console logs
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

    # Ensure the server is running on port 8000
    page.goto("http://localhost:8000")

    # 1. Open Shift View
    print("Clicking Shift Entry Card...")
    page.click('#shiftEntryCard')

    # Check if loading overlay appears and wait a bit
    try:
        page.wait_for_selector('#shift-loading-overlay', state='visible', timeout=2000)
        print("Loading overlay appeared.")
    except:
        print("Loading overlay did not appear or was too fast.")

    # Wait for overlay to disappear?
    try:
        page.wait_for_selector('#shift-loading-overlay', state='hidden', timeout=5000)
        print("Loading overlay disappeared.")
    except:
        print("Loading overlay stuck. Force removing...")
        page.evaluate("document.getElementById('shift-loading-overlay').classList.add('hidden')")
        # Also maybe hide global loading overlay
        page.evaluate("document.getElementById('global-loading-overlay')?.classList.add('hidden')")

    # 2. Click "Admin" button
    print("Clicking Admin Login Button...")
    page.click('#btn-shift-admin-login')

    # 3. Enter password
    print("Entering Password...")
    page.fill('#password-input', 'admin')

    # 4. Submit password
    page.press('#password-input', 'Enter')

    # Wait for admin view to appear
    print("Waiting for Admin View...")
    expect(page.locator('#shift-view-admin')).to_be_visible()

    # 5. Take Screenshot of Admin View
    time.sleep(2) # Wait for data load
    page.screenshot(path="verification/admin_view_initial.png")
    print("Initial Admin View Screenshot Taken.")

    # 6. Test "Clear" Button on a cell
    print("Testing Cell Clear...")
    # Check if table populated
    cells = page.locator('td[data-type="shift-cell"]')
    if cells.count() > 0:
        print(f"Found {cells.count()} cells. Testing click.")
        cells.first.click()

        # Verify Modal appears
        expect(page.locator('#shift-action-modal')).to_be_visible()

        # Click "Clear" button in the modal
        clear_btn = page.locator('#admin-role-grid button[data-role="clear"]').first
        clear_btn.click()

        # Verify Modal closes
        expect(page.locator('#shift-action-modal')).to_be_hidden()
        time.sleep(1) # wait for render
        page.screenshot(path="verification/admin_view_after_clear.png")
        print("After Clear Screenshot Taken.")
    else:
        print("No cells found. Skipping cell clear test.")

    # 7. Test "Clear Work Only"
    print("Testing Clear Work Only...")
    btn = page.locator('#btn-clear-work-only')
    if btn.is_visible():
        btn.click()

        # Verify Confirm Modal
        time.sleep(1)
        expect(page.locator('#global-confirm-modal')).to_be_visible()
        expect(page.locator('#global-confirm-title')).to_have_text("出勤のみクリア")

        # Take screenshot of confirm modal
        page.screenshot(path="verification/confirm_modal_clear_work.png")
        print("Confirm Modal Screenshot Taken.")
    else:
        print("Clear Work Only button not found!")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
