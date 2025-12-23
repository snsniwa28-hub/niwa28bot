from playwright.sync_api import sync_playwright
import time

def verify_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:8080")
            time.sleep(2) # Wait for initial load

            # 1. Verify Shift Tabs
            print("1. Opening Shift Modal...")
            page.click("#shiftEntryCard")
            time.sleep(1)

            print("Checking Tabs...")
            # Check tabs existence
            if page.locator("#btn-tab-early").is_visible() and \
               page.locator("#btn-tab-late").is_visible() and \
               page.locator("#btn-tab-employee").is_visible():
                print("PASS: Tabs are visible")
            else:
                print("FAIL: Tabs not visible")

            page.screenshot(path="verification/1_shift_tabs.png")

            # 2. Verify Task Filters
            print("2. Navigate to Task View...")
            page.reload()
            time.sleep(1)
            # Switch to Task View (using the function directly via evaluate or clicking the button)
            # Find the button that calls switchView('staff')
            # It's in #task-section > div
            page.click("#task-section > div")
            time.sleep(1)

            print("Checking Filter Buttons...")
            if page.locator("#filter-btn-all").is_visible() and \
               page.locator("#filter-btn-employee").is_visible() and \
               page.locator("#filter-btn-byte").is_visible():
                print("PASS: Filter buttons visible")
            else:
                print("FAIL: Filter buttons not visible")

            page.screenshot(path="verification/2_task_filters.png")

            # 3. Verify Auto Shift Preview Modal
            print("3. Admin Auto Shift Preview...")
            page.reload()
            time.sleep(1)
            page.click("#shiftEntryCard")
            time.sleep(1)

            # Login as Admin
            page.click("#btn-shift-admin-login")
            time.sleep(0.5)
            # Fill password (assumed 'admin' or 'shift_admin')
            # The prompt memory says EDIT_PASSWORD is 'admin'. Shift admin might be same or different.
            # js/shift.js uses showPasswordModal('shift_admin').
            # js/config.js defines SHIFT_ADMIN_PASSWORD? Let's check or just try 'admin'.
            # Actually, I can mock the admin mode by setting state in console.
            page.evaluate("() => { \
                document.getElementById('password-modal').classList.add('hidden'); \
                window.activateShiftAdminMode(); \
            }")
            time.sleep(1)

            # Click Auto Create
            # Handle confirm dialog
            page.on("dialog", lambda dialog: dialog.accept())

            # Click the button
            # Need to scroll to it or ensure it's visible. It's in the footer of admin view.
            # #btn-auto-create-shift
            page.click("#btn-auto-create-shift")

            # Wait for modal #auto-shift-preview-modal
            # It might take a moment if it runs calculation (it mocks calculation so it's fast)
            try:
                page.wait_for_selector("#auto-shift-preview-modal", state="visible", timeout=5000)
                print("PASS: Preview Modal appeared")
                page.screenshot(path="verification/3_auto_shift_preview.png")
            except:
                print("FAIL: Preview Modal did not appear")
                page.screenshot(path="verification/3_fail_preview.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_features()
