
from playwright.sync_api import sync_playwright, expect
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a consistent context to allow local storage if needed, though we clear it
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # 1. Navigate to the app
        print("Navigating to app...")
        try:
            page.goto("http://localhost:8080/index.html", timeout=30000)
        except Exception as e:
            print(f"Navigation error: {e}")
            # Try to continue if content loaded partialy

        # Wait for the main container or body
        page.wait_for_selector("body")

        # 2. Check for the new "Team Communication" button
        print("Verifying Team Communication button...")
        # The button text is "各チームの伝達"
        # We increase timeout just in case
        team_btn = page.get_by_role("button", name="各チームの伝達")
        expect(team_btn).to_be_visible(timeout=10000)

        # Take screenshot of the main page with the new button
        page.screenshot(path="verification/step1_main_page_new_button.png")
        print("Screenshot saved: verification/step1_main_page_new_button.png")

        # 3. Open the "Team Communication" chat (Unified View)
        print("Opening Unified Chat...")
        team_btn.click()

        # Wait for modal to open
        chat_modal = page.locator("#ai-chat-modal")
        expect(chat_modal).to_be_visible()

        # Verify status text (should indicate Unified/Shared Data)
        # Based on logic: toggleAIChat('strategy', '社内共有・戦略') -> '社内共有・戦略の資料を表示中'
        status_text = page.locator("#ai-status-text")
        expect(status_text).to_contain_text("社内共有・戦略")

        page.screenshot(path="verification/step2_unified_chat.png")
        print("Screenshot saved: verification/step2_unified_chat.png")

        # 4. Open Admin Auth (Lock Button)
        print("Opening Admin Auth...")
        # Close chat
        page.locator("#ai-chat-modal button").filter(has_text="✕").click()
        expect(chat_modal).not_to_be_visible()

        # Click Admin Lock Button (top right of the card)
        # The button has an onclick attribute containing "openStrategyAdminAuth('strategy')"
        admin_btn = page.locator("button[onclick*=\"openStrategyAdminAuth('strategy')\"]")
        admin_btn.click()

        # 5. Handle Password Modal
        print("Handling Password Modal...")
        password_modal = page.locator("#password-modal")
        expect(password_modal).to_be_visible()

        page.fill("#password-input", "admin")
        page.click("button:has-text('認証')")

        # 6. Verify Internal Shared Modal (Admin View)
        print("Verifying Admin Strategy Modal...")
        shared_modal = page.locator("#internalSharedModal")
        expect(shared_modal).to_be_visible()

        # Verify Create Button is visible
        create_btn = page.locator("#btn-create-strategy")
        expect(create_btn).to_be_visible()

        # 7. Open Editor and Verify Changes (No CS, Optional Title)
        print("Opening Editor...")
        create_btn.click()

        editor_modal = page.locator("#strategy-editor-modal")
        expect(editor_modal).to_be_visible()

        # Verify Category Options
        # Should contain: pachinko, slot, strategy. Should NOT contain cs.
        select_options = page.locator("#strategy-editor-category option")
        option_texts = select_options.all_inner_texts()
        print("Options found:", option_texts)

        assert any("パチンコ" in t for t in option_texts), "Pachinko option missing"
        assert any("スロット" in t for t in option_texts), "Slot option missing"
        assert any("戦略" in t for t in option_texts), "Strategy option missing"
        assert not any("CS" in t for t in option_texts), "CS option should be removed"

        # Verify Title Input Placeholder
        title_input = page.locator("#strategy-editor-title")
        placeholder = title_input.get_attribute("placeholder")
        print("Title placeholder:", placeholder)
        assert "未入力時はチーム名がタイトルになります" in placeholder

        page.screenshot(path="verification/step3_editor.png")
        print("Screenshot saved: verification/step3_editor.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
