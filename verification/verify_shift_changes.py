from playwright.sync_api import sync_playwright, expect
import time

def verify_shift_admin(page):
    # Navigate to the app
    page.goto("http://localhost:3000/")

    # 1. Open Shift Admin Mode
    # Click "Shift Entry/Management" button
    page.locator("#shiftEntryCard").click()

    # Wait for loading
    page.wait_for_timeout(1000)

    # Click "Admin" button
    page.locator("#btn-shift-admin-login").click()

    # Enter password "admin"
    page.fill("#password-input", "admin")

    # Click "認証" button (using text selector since ID is missing/ambiguous based on grep)
    page.get_by_role("button", name="認証").click()

    # Wait for admin view to load
    page.wait_for_selector("#shift-view-admin")

    # 2. Verify Footer Rows (Actuals/Targets)
    # Scroll to bottom of table container
    page.evaluate("document.getElementById('admin-table-container').scrollTop = document.getElementById('admin-table-container').scrollHeight")
    page.wait_for_timeout(1000) # Wait for scroll

    # Take screenshot of the table bottom
    page.screenshot(path="verification/shift_admin_table_footer.png", full_page=False)

    # 3. Verify Staff Master List
    # Click "Staff" button
    page.click("#btn-open-staff-master")

    # Wait for modal
    page.wait_for_selector("#staff-master-modal:not(.hidden)")

    # Take screenshot of staff list
    page.screenshot(path="verification/staff_master_list.png")

    print("Verification screenshots captured.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_shift_admin(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
