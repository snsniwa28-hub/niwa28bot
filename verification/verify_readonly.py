
from playwright.sync_api import sync_playwright, expect
import time
import re

def verify_readonly(page):
    # Mock Date to be after the 15th (e.g., 16th)
    page.add_init_script("""
        const originalDate = Date;
        class MockDate extends Date {
            constructor(...args) {
                if (args.length === 0) {
                    super('2023-10-16T10:00:00'); // Fixed date: 16th
                } else {
                    super(...args);
                }
            }
        }
        window.Date = MockDate;
    """)

    page.goto("http://localhost:8080/index.html")

    # 1. Open Shift Modal
    page.click("#shiftEntryCard")
    page.wait_for_selector("#shift-modal", state="visible")

    # 2. Select a staff member (User Mode)
    page.wait_for_selector("#shift-list-employees button")
    page.click("#shift-list-employees button >> nth=0")
    page.wait_for_selector("#shift-view-calendar", state="visible")

    # 3. Verify Read-Only State
    cell = page.locator("#shift-cal-grid > div").filter(has_text="10").first

    # It should NOT have cursor-pointer
    expect(cell).not_to_have_class(re.compile(r"cursor-pointer"))

    # It SHOULD have cursor-default
    expect(cell).to_have_class(re.compile(r"cursor-default"))

    # Click shouldn't open modal
    cell.click()
    expect(page.locator("#shift-action-modal")).to_be_hidden()

    print("Read-only verification passed.")
    page.screenshot(path="verification/verification_readonly.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_readonly(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_readonly.png")
        finally:
            browser.close()
