from playwright.sync_api import sync_playwright
import time

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        print("Navigating...")
        page.goto("http://localhost:8080/index.html")

        # Manually invoke the modal creation logic via console to bypass UI clicks if needed
        # But let's try direct clicking again with simple selectors

        print("Clicking shift card...")
        # Use force click in case of overlay issues
        page.click("#shiftEntryCard", force=True)

        print("Waiting for modal...")
        page.wait_for_selector("#shift-modal", state="visible", timeout=5000)

        print("Clicking admin login...")
        page.click("#btn-shift-admin-login", force=True)

        print("Waiting for password modal...")
        page.wait_for_selector("#password-modal", state="visible", timeout=5000)

        print("Filling password...")
        page.fill("#password-input", "admin")

        print("Submitting password...")
        page.click("#btn-password-submit", force=True)

        print("Waiting for admin view...")
        page.wait_for_selector("#shift-view-admin", state="visible", timeout=5000)

        print("Opening staff master...")
        page.click("#btn-open-staff-master", force=True)
        page.wait_for_selector("#staff-master-modal", state="visible", timeout=5000)

        print("Clicking add staff...")
        page.click("#btn-add-staff", force=True)
        page.wait_for_selector("#staff-edit-modal", state="visible", timeout=5000)

        # Verify "Max Consecutive Days" input exists
        if page.is_visible("#se-max-consecutive"):
            print("SUCCESS: Max Consecutive Days input found.")
        else:
            print("FAILURE: Max Consecutive Days input NOT found.")

        page.screenshot(path="verification_modal.png")
        print("Screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
