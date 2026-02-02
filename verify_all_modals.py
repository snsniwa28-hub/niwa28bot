from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating...")
        page.goto("http://localhost:8080/index.html", wait_until="domcontentloaded")
        time.sleep(2) # Allow JS to inject modals if they are dynamic

        # List of IDs to verify
        views_to_check = [
            "#new-opening-view",
            "#qsc-view",
            "#todo-view",
            "#deadline-view",
            "#map-update-view",
            "#member-target-view",
            "#ai-chat-view",
            "#strategy-view",
            "#strategy-editor-view",

            # Shift Views (injected by js/shift.js)
            "#shift-main-view",
            "#staff-master-view",
            "#staff-edit-view",
            "#admin-note-view",
            "#auto-shift-settings-view",
            "#compensatory-off-view",
            "#adjustment-candidate-view"
        ]

        # Shift modals are injected on click usually?
        # checking js/shift.js: createShiftModals is called in openShiftUserModal.
        # But maybe they are injected on init?
        # main.js calls Shift.injectShiftButton(). It doesn't call createShiftModals immediately.
        # So shift views might NOT be in DOM yet.

        # Let's trigger shift modal creation.
        # window.createShiftModals is exposed.
        print("Triggering createShiftModals...")
        page.evaluate("if(window.createShiftModals) window.createShiftModals();")
        time.sleep(1)

        failed = []
        for view_id in views_to_check:
            locator = page.locator(view_id)
            count = locator.count()
            classes = locator.get_attribute("class") if count > 0 else "N/A"

            if count > 0 and "fullscreen-view" in classes:
                print(f"PASS: {view_id} exists and has 'fullscreen-view'.")
            elif count > 0:
                print(f"FAIL: {view_id} exists but MISSING 'fullscreen-view'. Classes: {classes}")
                failed.append(view_id)
            else:
                print(f"FAIL: {view_id} does NOT exist.")
                failed.append(view_id)

        if failed:
            print(f"FAILED views: {failed}")
            exit(1)
        else:
            print("ALL VIEWS VERIFIED.")

        browser.close()

if __name__ == "__main__":
    run()
