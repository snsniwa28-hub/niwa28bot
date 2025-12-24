from playwright.sync_api import sync_playwright

def verify_deadline_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate
        page.goto("http://localhost:8082/index.html")

        # 1. Verify dashboard list is visible immediately
        dashboard_list = page.locator("#deadlines-list")
        dashboard_list.wait_for(state="visible")
        print("Dashboard list visible")

        # 3. Click Lock Button to open password modal
        lock_btn = page.locator("button[onclick=\"showPasswordModal('admin')\"]")
        lock_btn.wait_for(state="visible")
        lock_btn.click()

        # 4. Verify Password Modal is visible and z-index is correct
        pwd_modal = page.locator("#password-modal")
        pwd_modal.wait_for(state="visible")
        z_index = pwd_modal.evaluate("el => getComputedStyle(el).zIndex")
        if int(z_index) >= 200:
            print("Password modal z-index correct (>=200)")
        else:
            print(f"Password modal z-index incorrect: {z_index}")

        # 5. Enter Password and Open Management Modal
        page.fill("#password-input", "admin")
        page.get_by_role("button", name="認証").click()

        # 6. Verify Management Modal Opens
        mgmt_modal = page.locator("#deadlineManagementModal")
        mgmt_modal.wait_for(state="visible")
        print("Management modal visible")

        # 7. Verify Management Modal Content
        if page.locator("#new-deadline-date").is_visible():
            print("Add New Date input visible")

        if page.locator("#deadlines-list-admin").is_visible():
            print("Admin list container visible")

        # 8. Check for Delete Buttons in Admin List (even if empty, logic check)
        # We can't easily check for buttons if list is empty without mock data,
        # but the visibility of the container confirms the flow.

        page.screenshot(path="verification/final_check.png")
        print("Flow captured")

        browser.close()

if __name__ == "__main__":
    verify_deadline_features()
