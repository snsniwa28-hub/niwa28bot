from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Load the page (Use localhost as we started a server)
        page.goto("http://localhost:8080/index.html")

        # 2. Open Shift Modal (User Mode)
        # The text is "シフト提出・管理" or "シフト作成・管理". Using partial text "シフト提出" or ID "shiftEntryCard"
        page.locator("#shiftEntryCard").click()

        # Click "Admin" button
        page.get_by_role("button", name="管理者").click()

        # 3. Handle Password Modal
        page.fill("#password-input", "admin")
        page.get_by_role("button", name="認証").click()

        # 4. Verify Adjustment Mode Toggle exists
        toggle = page.locator("#chk-adjustment-mode")
        expect(toggle).to_be_visible()

        # 5. Enable Adjustment Mode
        toggle.check()

        # 6. Interact: Click a shift cell that has an assignment (Not '公休' or empty)
        is_checked = toggle.is_checked()
        print(f"Adjustment Mode Checked: {is_checked}")

        # Take a screenshot of the Admin View with the new toggle
        page.screenshot(path="verification/shift_admin_adjustment.png")

        browser.close()

if __name__ == "__main__":
    run()
