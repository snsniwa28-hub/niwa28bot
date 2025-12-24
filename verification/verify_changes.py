from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile view to check responsive changes
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        # Navigate to the page
        page.goto("http://localhost:8080/index.html")
        # Just wait for DOM content loaded, not network idle (due to firebase)
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(2000) # Give a bit of time for initial rendering

        # 1. Verify Shared/Strategy Section (List Layout)
        print("Verifying Shared/Strategy List...")
        # Check if the grid container is gone and we have list items

        # Scroll to shared section
        # The buttons have text 'パチンコ共有'
        try:
            pachinko_btn = page.locator("button:has-text('パチンコ共有')").first
            pachinko_btn.wait_for(state="visible", timeout=5000)
            pachinko_btn.scroll_into_view_if_needed()
            page.screenshot(path="verification/mobile_shared_list.png")
            print("Snapshot: mobile_shared_list.png")
        except Exception as e:
            print(f"Error verifying Shared List: {e}")

        # 2. Verify Operations Board (Vertical Stack)
        print("Verifying Operations Board...")
        try:
            ops_board = page.locator("#operationsBoardContainer")
            ops_board.scroll_into_view_if_needed()
            page.wait_for_timeout(2000)
            page.screenshot(path="verification/mobile_operations.png")
            print("Snapshot: mobile_operations.png")
        except Exception as e:
            print(f"Error verifying Ops Board: {e}")

        # 3. Verify Deadline Management
        print("Verifying Deadline Management...")
        try:
            deadline_section = page.locator("#deadlines-section")
            deadline_section.scroll_into_view_if_needed()

            # Check if #deadline-management-modal exists
            modal = page.locator("#deadline-management-modal")
            if modal.count() > 0:
                print("Deadline Management Modal found in DOM.")

                # Use JS to force show it for screenshot
                page.evaluate("document.getElementById('deadline-management-modal').classList.remove('hidden')")

                page.wait_for_timeout(500)
                page.screenshot(path="verification/mobile_deadline_modal.png")
                print("Snapshot: mobile_deadline_modal.png")
            else:
                print("ERROR: Deadline Management Modal NOT found.")
        except Exception as e:
            print(f"Error verifying Deadlines: {e}")

        browser.close()

if __name__ == "__main__":
    verify_changes()
