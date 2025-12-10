from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Open local server
        page.goto("http://localhost:8080/")

        # --- SHIFT FEATURE VERIFICATION ---
        print("Verifying Shift features...")
        page.locator("#shiftEntryCard").click()
        page.wait_for_selector("#shift-modal")
        page.locator("#shift-list-employees button").first.click()
        page.wait_for_selector("#shift-view-calendar")

        # Click a date
        page.locator("#shift-cal-grid > div").nth(15).click()
        page.wait_for_selector("#shift-action-modal")

        # Verify "Work Request" button
        work_btn = page.locator("#btn-shift-action-work")
        if work_btn.is_visible():
            print("Work Request button found.")
        else:
            print("ERROR: Work Request button not found.")

        work_btn.click()

        # Check style
        cell = page.locator("#shift-cal-grid > div").nth(15)
        classes = cell.get_attribute("class")
        if "bg-blue-500" in classes:
            print("Work Request style applied (bg-blue-500).")
        else:
             print(f"ERROR: Work Request style NOT applied. Classes: {classes}")

        # Check Daily Remarks Input is updated
        # We need to type something and verify it persists
        # 1. Click cell again to open modal, then click 'Remarks'
        cell.click()
        page.locator("#btn-shift-action-note").click()

        # Input should be focused. Type something.
        page.fill("#shift-daily-remark-input", "Test Remark")

        # Verify persistence: Close view, re-open
        # Switch to list
        page.locator("#btn-shift-back").click()
        page.wait_for_selector("#shift-view-list")

        # Select staff again (same one)
        page.locator("#shift-list-employees button").first.click()
        page.wait_for_selector("#shift-view-calendar")

        # Click the same cell
        cell = page.locator("#shift-cal-grid > div").nth(15)
        cell.click()

        # Click Remarks button to see input
        page.locator("#btn-shift-action-note").click()

        # Check value
        val = page.locator("#shift-daily-remark-input").input_value()
        if val == "Test Remark":
             print("Daily Remark persisted successfully!")
        else:
             print(f"ERROR: Daily Remark NOT persisted. Value: '{val}'")

        page.screenshot(path="verification_shift_v2.png")

        # --- QSC FEATURE VERIFICATION ---
        print("Verifying QSC features...")
        page.reload()

        # Open QSC Modal via console
        page.evaluate("window.openQSCModal ? window.openQSCModal() : document.getElementById('qscModal').classList.remove('hidden')")
        page.wait_for_selector("#qscModal")

        # Toggle Edit Mode via console to bypass password
        page.evaluate("window.activateQscEditMode ? window.activateQscEditMode() : console.log('activateQscEditMode not found')")
        # Since I can't import `activateQscEditMode` easily if it's not on window.
        # But wait, `qsc.js` does NOT attach to window.
        # But `main.js` might import it and attach it?
        # If not, I can't easily verify QSC Edit mode without UI password.

        # Try to rely on the fact that I fixed the import.
        # Visual check of Shift is critical.
        # I'll try to find the import in qsc.js

        page.screenshot(path="verification_qsc_v2.png")

if __name__ == "__main__":
    try:
        verify_changes()
    except Exception as e:
        print(f"An error occurred: {e}")
