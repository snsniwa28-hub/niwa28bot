from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Start a local server (assuming python http.server is running on port 8000)
        # Note: I need to start the server first in bash.
        page.goto("http://localhost:8000")

        # 1. Verify Operations Dashboard Labels
        # "本日目標 (19時)" -> "目標稼働 (19時)"
        page.wait_for_selector("#operationsBoardContainer")
        # Give it a moment to render (it fetches from firestore, might be slow or fail if offline)
        # Since I'm mocking or relying on existing structure...
        # Actually, the labels are rendered by JS. I need to wait for render.
        # But without Firestore, it might show "loading..." or error.
        # The labels are in renderOperationsBoard, which runs on snapshot.

        # Wait for the board to be populated or just check static HTML if possible?
        # The board is dynamically rendered.
        # If I can't connect to Firestore, I might need to mock or just check if I can trigger the modal.

        # Click "入力" button to check the modal labels.
        # Button ID: btn-op-input
        # But wait, button is inside the dynamic HTML.

        # Let's try to wait for the button.
        try:
            page.wait_for_selector("#btn-op-input", timeout=5000)
            page.click("#btn-op-input")

            # Check Modal Labels
            # "予想目標" -> "目標稼働"
            # "当日目標" -> "実際稼働"
            page.wait_for_selector("#operations-modal", state="visible")
            page.screenshot(path="verification/operations_modal.png")
            print("Operations modal screenshot taken.")

            page.click("button:text('キャンセル')")
        except Exception as e:
            print(f"Could not verify operations modal: {e}")

        # 2. Verify Strategy Modals
        # Click Pachinko Share
        try:
            page.click("button:has-text('パチンコ共有')")
            page.wait_for_selector("#internalSharedModal", state="visible")
            # Check Title
            title = page.locator("#internalSharedModal h3").text_content()
            print(f"Pachinko Modal Title: {title}")
            page.screenshot(path="verification/pachinko_modal.png")
            page.click("#internalSharedModal button:text('✕')")
        except Exception as e:
            print(f"Could not verify Pachinko modal: {e}")

        # Click Slot Share
        try:
            page.click("button:has-text('スロット共有')")
            page.wait_for_selector("#internalSharedModal", state="visible")
             # Check Title
            title = page.locator("#internalSharedModal h3").text_content()
            print(f"Slot Modal Title: {title}")
            page.screenshot(path="verification/slot_modal.png")
            page.click("#internalSharedModal button:text('✕')")
        except Exception as e:
            print(f"Could not verify Slot modal: {e}")

        browser.close()

if __name__ == "__main__":
    verify_changes()
