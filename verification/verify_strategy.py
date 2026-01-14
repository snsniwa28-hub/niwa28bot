import asyncio
from playwright.async_api import async_playwright
import time
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Mock Firestore by injecting scripts or intercepting logic if possible
        # Since we are testing UI logic that depends on `window.openInternalSharedModal`, we can load the page and run JS.

        # 1. Load index.html
        # Since we are in the repo root, we can use file:// protocol.
        # But some modules might fail due to CORS if not served via HTTP.
        # Let's try to serve it with python http.server in background or just open file if modules allow (ES modules often require HTTP).

        # We'll assume the user has a dev server or we can use file:// if main.js is handled correctly.
        # Given `type="module"` in index.html, file:// usually fails for imports.
        # So we should start a simple HTTP server.

        # We will assume a server is running on port 8000 for this test or start one.
        # I'll rely on the `run_in_bash_session` to start a server in a separate step or background.
        # But wait, I can just use `http.server` here? No, I need it to be running.

        # Let's assume I can't easily start a server inside this python script without blocking.
        # I'll create a plan to start server first.

        # Actually, let's try to verify via file protocol if possible, but modules...
        # "Access to script at ... from origin 'null' has been blocked by CORS policy"

        # So I will start a server on port 8080 in the bash session.
        await page.goto("http://localhost:8080/index.html")

        # Wait for initialization
        await page.wait_for_timeout(2000)

        # 2. Open Internal Shared Modal (Unified View)
        # Execute JS to open it
        await page.evaluate("window.openInternalSharedModal()")
        await page.wait_for_selector("#internalSharedModal", state="visible")

        # 3. Verify Header Title
        title_text = await page.locator("#internalSharedModal h3").text_content()
        print(f"Header Title: {title_text}")

        # Check if title matches expected "社内共有・戦略（全体）"
        if "社内共有・戦略（全体）" not in title_text:
            print("ERROR: Header title does not match expected value.")

        # 4. Mock Strategies Data & Render
        # We can inject data into `strategies` variable if it's exposed or mock the render function?
        # `strategies` is local to module.
        # But we can call `renderStrategyList` if we mock `getDocs`... that's hard.

        # Alternative: The app tries to load from Firestore. It will likely fail or get empty.
        # If it gets empty, it shows "登録された知識データはありません" or "まだ記事がありません".

        # Let's verify the "Create Strategy" button opens the editor with correct defaults.
        # Ensure we are in admin mode or just call `openStrategyEditor` directly.
        await page.evaluate("window.openStrategyEditor()")
        await page.wait_for_selector("#strategy-editor-modal", state="visible")

        # 5. Verify Editor Defaults
        category_value = await page.input_value("#strategy-editor-category")
        print(f"Initial Category Value: '{category_value}'")

        if category_value != "":
             print("ERROR: Category should be empty/unselected by default.")

        # 6. Verify Save Alert
        # Mock alert
        dialog_message = []
        page.on("dialog", lambda dialog: dialog_message.append(dialog.message) or dialog.accept())

        await page.click("text=保存して公開")

        if len(dialog_message) > 0:
            print(f"Alert Message: {dialog_message[0]}")
            if "【必須】共有するチーム（カテゴリ）を選択してください" in dialog_message[0]:
                print("SUCCESS: Alert triggered correctly.")
            else:
                print("ERROR: Unexpected alert message.")
        else:
            print("ERROR: No alert triggered.")

        # Screenshot
        await page.screenshot(path="verification/verification.png")
        print("Screenshot saved to verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
