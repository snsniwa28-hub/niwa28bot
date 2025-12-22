
from playwright.sync_api import sync_playwright

def verify_shift_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the app (using localhost for modules)
        page.goto("http://localhost:8080/index.html")

        # 1. Login as Admin to see the Shift Admin view
        # The app requires entering 'admin' password
        # Click the gear/settings icon for Shift Admin or similar if present.
        # But wait, how do we access Shift Admin?
        # js/shift.js says: $('#btn-shift-admin-login').onclick = checkShiftAdminPassword;
        # And injectShiftButton() attaches to #shiftEntryCard

        # Click the Shift Entry Card to open the modal first
        page.locator("#shiftEntryCard").click()

        # Wait for animation
        page.wait_for_timeout(1000)

        # Click Admin Login button in the modal header
        page.locator("#btn-shift-admin-login").click()

        # Enter password
        page.fill("#password-input", "admin")
        page.click("button:has-text('認証')")

        # Wait for Admin View to load
        page.wait_for_timeout(1000)

        # 2. Check for Badges in the Admin Matrix
        # Look for the badges we added: '金', '副', '倉', '責'
        # Classes: bg-yellow-100, bg-orange-100, etc.

        print("Checking Admin Matrix for badges...")
        badges = page.locator("#shift-admin-body .bg-yellow-100:has-text('金')")
        count = badges.count()
        print(f"Found {count} 'Money Main' badges in Admin Matrix.")

        page.screenshot(path="verification_admin_matrix.png")

        # 3. Check Staff Master List
        # Click "Staff" button in Admin Header
        # id="btn-open-staff-master"
        page.locator("#btn-open-staff-master").click()

        page.wait_for_timeout(1000)

        print("Checking Staff Master List for badges...")
        master_badges = page.locator("#staff-master-list .bg-yellow-100:has-text('金')")
        master_count = master_badges.count()
        print(f"Found {master_count} 'Money Main' badges in Master List.")

        page.screenshot(path="verification_master_list.png")

        browser.close()

if __name__ == "__main__":
    verify_shift_ui()
