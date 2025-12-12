
from playwright.sync_api import sync_playwright, expect
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions to clipboard and notification
        context = browser.new_context(permissions=['clipboard-read', 'clipboard-write', 'notifications'])
        page = context.new_page()

        # 1. Load the page
        page.goto("http://localhost:8080/index.html")
        time.sleep(2) # wait for initial rendering (auth check etc)

        # --- Task 2: Member Acquisition Section Accordion ---
        print("Verifying Member Acquisition Accordion...")
        # Check if details element exists within the member acquisition section
        # The ID is #member-acquisition-section
        section = page.locator("#member-acquisition-section")
        details = section.locator("details.group")
        expect(details).to_be_visible()

        # Check summary contains header
        summary = details.locator("summary")
        expect(summary).to_be_visible()

        # Click summary to toggle open
        # We need to make sure it's open for the screenshot
        if not details.get_attribute("open"):
             summary.click()
             time.sleep(1)

        # Take screenshot of Member Acquisition
        page.screenshot(path="/home/jules/verification/member_accordion.png", clip={"x":0, "y":0, "width": 1280, "height": 1000})

        # --- Task 3: Deadlines Form ---
        print("Verifying Deadlines Form...")
        # Scroll to deadlines section
        page.locator("#deadlines-section").scroll_into_view_if_needed()

        # Force form visible for visual check of structure (HTML change verification)
        # JS logic for auto-date was verified by code inspection and is simple.
        page.evaluate("document.getElementById('deadline-add-form').classList.remove('hidden')")
        time.sleep(1)

        # Check that 'deadline-display-date-input' is GONE.
        display_input = page.locator("#deadline-display-date-input")
        expect(display_input).to_have_count(0)

        # Check date input exists
        date_input = page.locator("#deadline-date-input")
        expect(date_input).to_be_visible()

        page.screenshot(path="/home/jules/verification/deadlines_form.png")

        # --- Task 1: Shift Admin View ---
        print("Verifying Shift Admin View...")

        # Click shift entry card
        page.locator("#shiftEntryCard").click()
        time.sleep(1)

        # Click Admin Login
        page.locator("#btn-shift-admin-login").click()
        time.sleep(1)

        # Input password '9999'
        page.locator("#password-input").fill("9999")
        # Click Auth button (same modal)
        page.get_by_role("button", name="認証").click()
        time.sleep(1)

        # Now in Admin View (Shift)
        # ShiftState is not attached to window, so we can't inject data directly into it.
        # However, we can use the UI to add a remark if we were a user, but we are admin now.
        # Or we can mock the fetch response? Firestore mocking is hard here.

        # But wait, I added `window.showAdminNoteModal = showAdminNoteModal;` in `js/shift.js`.
        # I can test the modal structure by calling this function directly!
        # I don't need to click the icon if I just want to verify the modal contents are editable.
        # But verification of the icon appearance requires state.

        # Since I can't easily inject state into the module-scoped `shiftState`,
        # I will verify the Modal UI by invoking `showAdminNoteModal` directly.
        # This confirms the "Edit" requirement (Task 1 part 2 & 3).
        # Task 1 Part 1 (Icon appearance) relies on logic `const hasAnyRemark = ...` which I inspected.

        print("Invoking showAdminNoteModal directly to verify UI...")
        page.evaluate("""
            window.showAdminNoteModal('TestUser', 'Monthly Note', {'1': 'Day Note'});
        """)
        time.sleep(1)

        # Verify Modal Content
        # Check for Textarea
        textarea = page.locator("#admin-note-monthly-edit")
        expect(textarea).to_be_visible()
        expect(textarea).to_have_value("Monthly Note")

        # Check for Daily Input
        daily_input = page.locator(".admin-daily-note-input")
        expect(daily_input).to_be_visible()
        expect(daily_input).to_have_value("Day Note")

        # Check for Save Button
        save_btn = page.locator("#btn-save-admin-note")
        expect(save_btn).to_be_visible()

        page.screenshot(path="/home/jules/verification/shift_admin_modal.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
