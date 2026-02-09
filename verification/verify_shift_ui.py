from playwright.sync_api import sync_playwright, expect

def verify_shift_button():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Arrange: Go to the homepage
        try:
            page.goto("http://localhost:8080")
            print("Page loaded")
        except Exception as e:
            print(f"Failed to load page: {e}")
            return

        # 2. Act: Click the Shift Entry Card to open the modal
        # Using the ID from index.html
        shift_card = page.locator("#shiftEntryCard")
        expect(shift_card).to_be_visible()
        shift_card.click()
        print("Clicked Shift Entry Card")

        # 3. Assert: Check if the Shift Modal is visible
        shift_view = page.locator("#shift-main-view")
        expect(shift_view).to_be_visible()
        print("Shift View is visible")

        # 4. Assert: Check if the Admin Login button is visible (Default state)
        admin_btn = page.locator("#btn-shift-admin-login")
        expect(admin_btn).to_be_visible()
        print("Admin Login Button is visible")

        # 5. Screenshot
        page.screenshot(path="/home/jules/verification/shift_view_default.png")
        print("Screenshot taken")

        browser.close()

if __name__ == "__main__":
    verify_shift_button()
