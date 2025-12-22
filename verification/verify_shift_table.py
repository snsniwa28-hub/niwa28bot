
from playwright.sync_api import sync_playwright, expect
import time

def verify_shift_admin_table_mobile():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        # Use iPhone 12 Pro dimensions
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        try:
            # Navigate to the app
            page.goto("http://localhost:8080")

            # Wait for content
            page.wait_for_selector("#shiftEntryCard", state="visible")

            # 1. Open Shift Modal
            page.locator("#shiftEntryCard").click()

            # 2. Click Admin Login
            # Using selector based on id for more stability
            page.locator("#btn-shift-admin-login").click()

            # 3. Enter Password
            page.wait_for_selector("#password-modal", state="visible")
            page.fill("#password-input", "admin")
            page.get_by_role("button", name="認証").click()

            # 4. Wait for Admin View
            page.wait_for_selector("#shift-view-admin", state="visible")

            # 5. Ensure Table View is active (might default to list on mobile if logic wasn't updated correctly)
            # We updated the logic to respect viewMode, but we initialized it to 'table' in js/shift.js.
            # If it's in list mode, we need to toggle it.
            # Check for table container visibility

            if not page.is_visible("#admin-table-container"):
                print("Table container hidden, toggling view...")
                # The button text changes based on mode.
                # If list view is active, button says "📊 表形式" (Table Format) or similar?
                # Let's check logic:
                # toggleBtn.textContent = shiftState.viewMode === 'table' ? "📱 カード表示" : "📊 表形式";
                # If we are in List mode (container hidden), button should say "📊 表形式"

                # Try clicking the toggle button directly by ID
                page.locator("#btn-view-toggle").click()
                page.wait_for_selector("#admin-table-container", state="visible")

            # 6. Wait for table to populate (it fetches data)
            # The table body should have rows
            page.wait_for_selector("#shift-admin-body tr", timeout=10000)

            # 7. Take Screenshot of the table area
            # We want to see the sticky headers and the first few columns/rows
            # Force a scroll to 0,0
            page.evaluate("document.getElementById('admin-table-container').scrollTo(0,0)")

            time.sleep(1) # Wait for any transitions

            # Capture the whole table container
            page.locator("#admin-table-container").screenshot(path="verification/shift_admin_mobile.png")
            print("Screenshot saved to verification/shift_admin_mobile.png")

            # 8. Assertions
            # Check if Name Cell has expected class for width (w-20)
            name_cell = page.locator("#shift-admin-body tr td.sticky").first
            classes = name_cell.get_attribute("class")
            print(f"Name Cell Classes: {classes}")
            if "w-20" in classes:
                print("SUCCESS: Name cell has w-20 class.")
            else:
                print("FAILURE: Name cell missing w-20 class.")

            # Check if details are hidden
            details_span = name_cell.locator("div > span.hidden.md\\:block")
            # is_hidden() checks visibility. The class 'hidden' makes it display:none.
            if details_span.is_hidden():
                print("SUCCESS: Details span is hidden on mobile.")
            else:
                print("FAILURE: Details span is visible.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            print("Saved error screenshot to verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_shift_admin_table_mobile()
