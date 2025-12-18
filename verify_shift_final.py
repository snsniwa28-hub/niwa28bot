from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # 1. Open Shift
        page.click("#shiftEntryCard", force=True)
        page.wait_for_timeout(1000)

        # 2. Click Admin
        page.click("#btn-shift-admin-login", force=True)
        page.wait_for_timeout(1000)

        # 3. Enter Password
        page.fill("#password-input", "admin")

        # 4. Click Auth Button (using specific text)
        page.click("button:has-text('認証')", force=True)
        page.wait_for_timeout(2000)

        # 5. Check if view switched by checking class of admin view
        # The admin view should NOT have 'hidden' class

        # NOTE: If page transition animation is slow, wait more

        # Try to find the admin view
        admin_view = page.query_selector("#shift-view-admin")
        if admin_view:
             classes = admin_view.get_attribute("class")
             print(f"Admin View Classes: {classes}")
             if "hidden" not in classes:
                 print("Admin View is visible!")

                 # Open Staff Master
                 page.click("#btn-open-staff-master", force=True)
                 page.wait_for_timeout(1000)

                 # Add Staff
                 page.click("#btn-add-staff", force=True)
                 page.wait_for_timeout(1000)

                 if page.is_visible("#se-max-consecutive"):
                     print("SUCCESS: Input found")
                 else:
                     print("FAIL: Input not found")

                 page.screenshot(path="verification_modal.png")

                 # Close modals to see table
                 page.click("button:text('キャンセル')")
                 page.click("#staff-master-modal button:text('✕')")
                 page.wait_for_timeout(500)
                 page.screenshot(path="verification_table.png")
             else:
                 print("FAIL: Admin view is still hidden")
                 page.screenshot(path="verification_fail.png")
        else:
             print("FAIL: Admin view element not found")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
