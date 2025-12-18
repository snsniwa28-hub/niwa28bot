from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:8080/index.html")
        # Just wait for the selector we need
        page.wait_for_selector("#shiftEntryCard", state="visible")

        # Open Shift Modal
        page.click("#shiftEntryCard")

        # Wait for modal to appear
        page.wait_for_selector("#shift-modal", state="visible")

        # Click "Admin Menu"
        page.click("#btn-shift-admin-login")

        # Wait for password modal
        page.wait_for_selector("#password-modal", state="visible")

        # Enter password "admin"
        page.fill("#password-input", "admin")

        # Click Login
        page.click("#btn-password-submit")

        # Wait for Admin View
        page.wait_for_selector("#shift-view-admin", state="visible")

        # Ensure Staff Master button is visible and click it
        page.click("#btn-open-staff-master")
        page.wait_for_selector("#staff-master-modal", state="visible")

        # Click "Add Staff" to open edit modal
        page.click("#btn-add-staff")
        page.wait_for_selector("#staff-edit-modal", state="visible")

        # Verify "Max Consecutive Days" input exists
        if page.is_visible("#se-max-consecutive"):
            print("SUCCESS: Max Consecutive Days input found.")
        else:
            print("FAILURE: Max Consecutive Days input NOT found.")

        # Take screenshot of the edit modal
        page.screenshot(path="verification_modal.png")

        # Close edit modal
        page.click("button:text('キャンセル')")

        # Close master modal
        page.click("#staff-master-modal button:text('✕')")

        # Take screenshot of the admin table (to see if names have extra info)
        page.wait_for_timeout(2000)
        page.screenshot(path="verification_table.png")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
