
from playwright.sync_api import sync_playwright, expect
import time

def verify_deadline_admin_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (served locally)
        page.goto("http://localhost:8080/index.html")

        # 1. Verify Deadline Admin Button exists and has correct ID
        btn = page.locator("#btn-deadline-admin")
        expect(btn).to_be_visible()

        # 2. Click it -> Password Modal should appear
        btn.click()
        password_modal = page.locator("#password-modal")
        expect(password_modal).to_be_visible()

        # 3. Enter password "admin" and submit
        page.fill("#password-input", "admin")

        # Trigger validation (Enter key)
        page.press("#password-input", "Enter")

        # 4. Verify Deadline Management Modal appears
        deadline_modal = page.locator("#deadlineManagementModal")
        expect(deadline_modal).to_be_visible()

        # 5. Verify Tasks Admin (Edit Mode) did NOT trigger
        # In this app, Admin Mode usually shows "Edit Mode: ON" or specific admin buttons become visible.
        # Let's check if the 'edit-mode-container' is visible. It should NOT be visible if we only opened deadline modal.
        # Wait, the bug was that "Task Management" AND "Deadline Management" opened.
        # "Task Management" usually means the view switches to staff view OR admin edit mode toggles.
        # The user said "Tasks.activateAdminMode()". This usually shows #edit-mode-container.

        # Let's check #edit-mode-container visibility.
        # However, #edit-mode-container is inside #app-staff.
        # If we are in #app-customer (default), #app-staff is hidden.
        # So even if activated, we might not see it unless view switched.
        # But if Tasks.activateAdminMode() was called, it might switch view?
        # Let's check if #app-staff is hidden.
        expect(page.locator("#app-staff")).to_be_hidden()

        # Take screenshot of the Deadline Modal open
        page.screenshot(path="verification_deadline_fix.png")
        print("Verification successful: Deadline modal opened, Staff view remains hidden.")

        browser.close()

if __name__ == "__main__":
    verify_deadline_admin_fix()
