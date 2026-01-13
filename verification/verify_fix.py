
from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # 1. Open App
        page.goto("http://localhost:8080/")
        page.wait_for_timeout(2000) # Wait for initial fade-ins

        # 2. Click Team Communication Button
        # The button text is "各チームの伝達"
        # Since it's a button inside a complex div, let's use get_by_role or text
        # The button has an onclick trigger 'openCategoryChat'

        # Taking a screenshot of the main page to ensure button is visible
        page.screenshot(path="verification/1_main_page.png")

        # Click the Chat button
        # Selector based on text "各チームの伝達" which is inside the button
        chat_btn = page.locator("button:has-text('各チームの伝達')")
        chat_btn.click()
        page.wait_for_timeout(1000)

        # 3. Verify Chat Modal Opens
        page.screenshot(path="verification/2_chat_opened.png")

        # Check if we can see the "Manage Knowledge" button (gear icon or "知識リスト")
        # In the chat modal, we injected a gear icon button dynamically in js/ai.js
        # But wait, that injection happens inside toggleAIChat.
        # Let's verify if the chat loaded.

        # 4. Open Knowledge Management
        # There is a gear icon injected: .admin-knowledge-btn
        # Or we can open it via the menu in the main page too ("社内共有・戦略")

        # Let's try closing chat and opening the "社内共有・戦略" modal directly from header
        close_btn = page.locator("#ai-chat-modal button:has-text('✕')")
        close_btn.click()
        page.wait_for_timeout(500)

        # Click header link "社内共有・戦略"
        header_link = page.get_by_role("button", name="社内共有・戦略")
        header_link.click()
        page.wait_for_timeout(1000)

        # 5. Verify Internal Shared Modal
        page.screenshot(path="verification/3_shared_modal.png")

        browser.close()

if __name__ == "__main__":
    verify_ui()
