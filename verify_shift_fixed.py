from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # 1. Open Shift
        page.click("#shiftEntryCard", force=True)
        # Wait for modal content
        page.wait_for_selector("#btn-shift-admin-login", state="visible")

        # 2. Click Admin
        page.click("#btn-shift-admin-login")
        # Wait for password input
        page.wait_for_selector("#password-input", state="visible")

        # 3. Enter Password
        page.fill("#password-input", "admin")

        # 4. Click Auth Button (with id="btn-password-submit" ? NO, check below)
        # Checking main.js and ui.js...
        # ui.js uses showPasswordModal. But main.js has custom logic or UI might not have ID.
        # Let's check the HTML for password modal button.
        # HTML says: <button onclick="checkPassword()" ...>認証</button>
        # It does NOT have an ID like 'btn-password-submit'.
        # That was my mistake in previous scripts.

        # Use text selector for the button
        page.click("button:has-text('認証')")

        # 5. Wait for Admin View
        page.wait_for_selector("#shift-view-admin", state="visible")

        # 6. Open Staff Master
        page.click("#btn-open-staff-master")
        page.wait_for_selector("#staff-master-modal", state="visible")

        # 7. Add Staff
        page.click("#btn-add-staff")
        page.wait_for_selector("#staff-edit-modal", state="visible")

        # 8. Check Input
        if page.is_visible("#se-max-consecutive"):
             print("SUCCESS: Max Consecutive Days input found.")
        else:
             print("FAILURE: Max Consecutive Days input NOT found.")

        page.screenshot(path="verification_modal.png")

        # Close
        page.click("button:text('キャンセル')")
        page.click("#staff-master-modal button:text('✕')")

        # 9. Screenshot Table
        page.wait_for_timeout(1000)
        page.screenshot(path="verification_table.png")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
