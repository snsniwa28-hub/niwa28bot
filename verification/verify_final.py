from playwright.sync_api import sync_playwright

def verify_shared_and_ops():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile view
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        page.goto("http://localhost:8080/index.html")
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(2000)

        print("Verifying Dashboard Grid...")
        # Check if Grid is back (Pachinko card)
        try:
            pachinko_btn = page.locator("button:has-text('パチンコ共有')").first
            pachinko_btn.scroll_into_view_if_needed()
            page.screenshot(path="verification/mobile_dashboard_grid.png")
            print("Snapshot: mobile_dashboard_grid.png")

            # Click it to open modal
            pachinko_btn.click()
            page.wait_for_timeout(1000)

            print("Verifying Modal Header...")
            # Check for Lock Button
            lock_btn = page.locator("#btn-strategy-admin-auth")
            if lock_btn.is_visible():
                print("Lock button visible in modal.")
                page.screenshot(path="verification/mobile_modal_header.png")
                print("Snapshot: mobile_modal_header.png")
            else:
                print("ERROR: Lock button NOT visible in modal.")

            # Close modal
            page.locator("button:text('✕')").click()
            page.wait_for_timeout(500)

        except Exception as e:
            print(f"Error verifying Shared Grid/Modal: {e}")

        print("Verifying Operations Board Layout...")
        try:
            ops_board = page.locator("#operationsBoardContainer")
            ops_board.scroll_into_view_if_needed()
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/mobile_ops_board_final.png")
            print("Snapshot: mobile_ops_board_final.png")
        except Exception as e:
            print(f"Error verifying Ops Board: {e}")

        browser.close()

if __name__ == "__main__":
    verify_shared_and_ops()
