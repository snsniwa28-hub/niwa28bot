from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Open the page
        # Using load instead of networkidle as firebase/external requests might keep network active
        page.goto("http://localhost:8080/index.html", wait_until="load")

        # 2. Scroll to Deadlines section
        deadlines_section = page.locator("#deadlines-section")
        deadlines_section.scroll_into_view_if_needed()

        # 3. Simulate Admin Login (Password: "admin") to show the Add Button
        # Open password modal
        page.evaluate("window.showPasswordModal('admin')")

        # Fill password and submit
        page.get_by_placeholder("Password").fill("admin")
        page.get_by_role("button", name="認証").click()

        # Wait for admin mode to activate (button should appear)
        add_btn = page.locator("#deadline-add-btn")
        expect(add_btn).to_be_visible(timeout=5000)

        # 4. Click Add Button to open Modal
        add_btn.click()

        # 5. Verify Modal appears
        modal = page.locator("#deadline-modal")
        expect(modal).to_be_visible(timeout=5000)

        # 6. Fill Modal inputs
        page.locator("#deadline-date-input").fill("2025-12-31")
        page.locator("#deadline-content-input").fill("Test Deadline via Playwright")
        page.locator("#deadline-priority-input").check()

        # Take Screenshot of the open modal with filled data
        page.screenshot(path="verification_modal.png")
        print("Screenshot taken: verification_modal.png")

        # 7. Add the deadline
        # Mocking window.showToast/alert to avoid blocking or errors if they are native
        page.evaluate("window.alert = function(){}")

        # Click Add in modal
        page.get_by_role("button", name="追加する").click()

        # 8. Verify Modal closes
        expect(modal).not_to_be_visible(timeout=5000)

        browser.close()

if __name__ == "__main__":
    run()
