from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # Click shift card
        page.click("#shiftEntryCard", force=True)
        page.wait_for_timeout(1000)

        # Click admin login
        page.click("#btn-shift-admin-login", force=True)
        page.wait_for_timeout(1000)

        # Check password modal status
        modal = page.query_selector("#password-modal")
        if modal:
            print(f"Modal class: {modal.get_attribute('class')}")
            # Try to force remove hidden if it's there (debugging)
            page.evaluate("document.getElementById('password-modal').classList.remove('hidden')")
        else:
            print("Password modal NOT found in DOM")

        page.fill("#password-input", "admin")
        page.click("#btn-password-submit", force=True)
        page.wait_for_timeout(2000)

        # Check if we are in admin view
        admin_view = page.query_selector("#shift-view-admin")
        if admin_view:
             print(f"Admin view class: {admin_view.get_attribute('class')}")
             if "hidden" not in admin_view.get_attribute("class"):
                 print("SUCCESS: Admin view is visible")

                 # Now try to open staff master
                 page.click("#btn-open-staff-master", force=True)
                 page.wait_for_timeout(1000)

                 page.click("#btn-add-staff", force=True)
                 page.wait_for_timeout(1000)

                 if page.is_visible("#se-max-consecutive"):
                     print("SUCCESS: Max Consecutive Days input found.")
                 else:
                     print("FAILURE: Max Consecutive Days input NOT found.")

                 page.screenshot(path="verification_modal.png")
             else:
                 print("FAILURE: Admin view is still hidden")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
