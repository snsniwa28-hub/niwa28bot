from playwright.sync_api import sync_playwright, expect

def verify_shift_toolbar():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Navigate to the app
        page.goto("http://localhost:8080/")

        # 2. Open Shift Modal
        # Wait for the card to be visible
        shift_card = page.locator("#shiftEntryCard")
        expect(shift_card).to_be_visible()
        shift_card.click()

        # 3. Wait for Modal to open
        modal = page.locator("#shift-main-view")
        expect(modal).to_be_visible()

        # 4. Activate Admin Mode via JS injection to bypass password
        # Need to wait a bit for modules to load/init
        page.wait_for_timeout(1000)

        # Check if function exists
        page.evaluate("if(window.activateShiftAdminMode) window.activateShiftAdminMode()")

        # 5. Wait for Admin View
        admin_view = page.locator("#shift-view-admin")
        expect(admin_view).to_be_visible()

        # 6. Verify the new button exists in the toolbar
        # Toolbar is hidden on mobile (md:flex), so we need to ensure viewport is wide enough.
        page.set_viewport_size({"width": 1280, "height": 720})

        btn_clear_roles = page.locator("#btn-clear-roles-only")
        expect(btn_clear_roles).to_be_visible()
        expect(btn_clear_roles).to_have_text("🧹 役職のみクリア")

        btn_clear_shift = page.locator("#btn-clear-shift")
        expect(btn_clear_shift).to_have_text("🗑️ 全クリア")

        # 7. Screenshot
        # Capture the footer toolbar area
        toolbar = page.locator("#shift-view-admin > div.hidden.md\\:flex") # The footer div
        # Alternatively, take screenshot of the whole admin view
        page.screenshot(path="verification/shift_toolbar.png")

        print("Verification successful!")
        browser.close()

if __name__ == "__main__":
    verify_shift_toolbar()
