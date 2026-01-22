
from playwright.sync_api import sync_playwright

def verify_ai_shift_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to local server
        page.goto("http://localhost:3000/index.html")
        page.wait_for_timeout(1000)

        # Click Shift Entry Card
        entry_card = page.locator("#shiftEntryCard")
        if entry_card.is_visible():
            entry_card.click()
            page.wait_for_timeout(1000)

            # Click Admin Login button
            admin_btn = page.locator("#btn-shift-admin-login")
            if admin_btn.is_visible():
                admin_btn.click()
                page.wait_for_timeout(500)

                # Enter password "1192" - ID is "password-input" NOT "admin-password-input"
                page.fill("#password-input", "1192")
                page.click("#btn-check-password")
                page.wait_for_timeout(1000)

                # Now in Admin View.
                # Check for the new button "完全AIモード"
                ai_btn = page.get_by_text("完全AIモード").first
                if ai_btn.is_visible():
                    print("AI Button Found!")
                    page.screenshot(path="verification/shift_admin_ai_button.png")
                else:
                    print("AI Button NOT Found")
                    page.screenshot(path="verification/shift_admin_fail.png")
            else:
                 print("Admin Button not visible")
        else:
             print("Shift Entry Card not visible")
             page.screenshot(path="verification/main_view_fail.png")

        browser.close()

if __name__ == "__main__":
    verify_ai_shift_ui()
