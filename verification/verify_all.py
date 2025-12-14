
import os
from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a desktop-sized screen
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # --- Task 3: Strategy Images ---
        print("Verifying Task 3 (Strategy Images)...")
        # Load the page and open the internal shared modal where strategy images are
        page.goto("http://localhost:8080/index.html")
        page.wait_for_timeout(2000) # wait for loads

        # The modal needs to be opened to see the images.
        # "📋 社内共有・戦略" button calls openInternalSharedModal()
        # Find button with exact text or close to it
        page.get_by_text("社内共有・戦略").first.click()
        page.wait_for_timeout(1000)

        # Check if the modal is visible
        modal = page.locator("#internalSharedModal")
        if modal.is_visible():
            print("  Modal opened.")
            # Take screenshot of the Strategy section
            # The images are in the "WEEKLY ACTIONS" section (bottom right of modal usually)
            # We look for the images with the class we changed
            # Wait for content to render (renderInfoSections is called)
            page.wait_for_timeout(1000)

            # Locate the specific image in the Weekly Action list (not the slide)
            # We can use the ALT text "Week 1-2"
            img = page.locator("img[alt='Week 1-2']")
            if img.is_visible():
                # Check class
                class_attr = img.get_attribute("class")
                if "object-contain" in class_attr and "h-auto" in class_attr:
                     print("  SUCCESS: Image has correct classes (object-contain, h-auto).")
                else:
                     print(f"  FAILURE: Image classes are {class_attr}")

            page.screenshot(path="verification/task3_strategy.png")
            print("  Screenshot saved: verification/task3_strategy.png")
        else:
            print("  FAILURE: Internal Shared Modal did not open.")

        # --- Task 2: Shift Remarks ---
        print("\nVerifying Task 2 (Shift Remarks)...")
        page.reload()
        page.wait_for_timeout(1000)

        # Click "シフト提出・管理" (Shift Entry/Management)
        # ID: shiftEntryCard
        page.locator("#shiftEntryCard").click()
        page.wait_for_timeout(1000)

        # Wait for modal body to be visible
        page.wait_for_selector("#shift-modal-body")

        # Staff list needs to be populated. If empty, we can't test.
        # We can inject a fake staff button if needed, but let's check if it's there.
        # Sometimes list is empty if Firestore fails.
        # Let's inject a fake staff button via JS just in case
        page.evaluate("""() => {
            const list = document.getElementById('shift-list-employees');
            if (list) {
                const btn = document.createElement('button');
                btn.textContent = 'TestUser';
                btn.className = 'test-user-btn';
                btn.onclick = () => window.selectShiftStaff('TestUser');
                list.appendChild(btn);
            }
        }""")

        first_staff = page.locator("#shift-list-employees button").first
        if first_staff.is_visible():
            first_staff.click()
            print("  Selected staff.")
            page.wait_for_timeout(500)

            # Now in Calendar view. Click a date (e.g., the 10th)
            # Find cell with text "10" inside #shift-cal-grid
            cell_10 = page.locator("#shift-cal-grid > div").filter(has_text="10").first
            if cell_10.is_visible():
                cell_10.click()
                print("  Clicked date 10.")
                page.wait_for_timeout(500)

                # Action Modal should appear (#shift-action-modal)
                # Click "備考を入力" (btn-shift-action-note)
                note_btn = page.locator("#btn-shift-action-note")
                if note_btn.is_visible():
                    note_btn.click()
                    print("  Clicked Note button.")
                    page.wait_for_timeout(500)

                    # Verify #shift-daily-remark-container is visible
                    container = page.locator("#shift-daily-remark-container")
                    # Check visibility strictly
                    is_hidden = "hidden" in (container.get_attribute("class") or "")

                    if not is_hidden:
                         print("  SUCCESS: Remark container is visible.")
                    else:
                         print("  FAILURE: Remark container is still hidden.")

                    page.screenshot(path="verification/task2_shift.png")
                    print("  Screenshot saved: verification/task2_shift.png")

                else:
                     print("  FAILURE: Note button not found.")
            else:
                 print("  FAILURE: Date cell 10 not found.")
        else:
            print("  FAILURE: No staff buttons found.")


        # --- Task 1: Deadlines ---
        print("\nVerifying Task 1 (Deadlines Checklist)...")
        page.reload()
        page.wait_for_timeout(1000)

        # 1. Enable Admin Mode for Deadlines (Click gear icon)
        # Use more specific locator for the gear icon in the Deadlines section
        # "今月の期限物・お知らせ" is the header. The button is next to it.
        # Section ID: deadlines-section
        deadline_section = page.locator("#deadlines-section")
        # Find the SVG gear icon inside this section's header
        gear_btn = deadline_section.locator("button").first # The only button in header

        if gear_btn.is_visible():
            gear_btn.click()
            page.wait_for_timeout(500)
            page.fill("#password-input", "garden840")
            page.click("text=認証")
            page.wait_for_timeout(1000)

            # Check if form appeared
            if page.locator("#deadline-add-form").is_visible():
                print("  Admin mode activated.")
                # Add a test deadline
                page.fill("#deadline-date-input", "2024-12-31")
                page.fill("#deadline-content-input", "Test Checklist Item")
                page.click("#deadline-add-btn")
                page.wait_for_timeout(2000)

                # Check if item appeared in list
                item = page.locator("#deadlines-list").get_by_text("Test Checklist Item")
                if item.is_visible():
                    print("  Deadline item added.")

                    check_btn = page.locator("button", has_text="確認").last

                    if check_btn.is_visible():
                         print("  Checklist button found.")
                         check_btn.click()
                         page.wait_for_timeout(500)

                         # Since masterStaffList might be empty in this env, we might not see checkboxes.
                         # But we should see "スタッフリスト" message if empty.
                         checklist = page.locator("[id^='checklist-']").last
                         if checklist.is_visible():
                             print("  SUCCESS: Checklist container expanded.")

                             # Check content
                             if checklist.get_by_text("スタッフリスト").is_visible() or checklist.locator("input[type='checkbox']").count() > 0:
                                 print("  Checklist content visible.")
                             else:
                                 print("  Checklist empty (expected if no staff data).")
                         else:
                              print("  FAILURE: Checklist container not visible.")
                    else:
                         print("  FAILURE: Checklist button not found.")

                    page.screenshot(path="verification/task1_deadlines.png")
                    print("  Screenshot saved: verification/task1_deadlines.png")
                else:
                    print("  WARNING: Item did not appear.")
            else:
                print("  FAILURE: Could not enter admin mode.")
        else:
             print("  FAILURE: Gear button not found.")

        browser.close()

if __name__ == "__main__":
    verify_changes()
