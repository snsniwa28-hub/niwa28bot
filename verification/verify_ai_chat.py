from playwright.sync_api import sync_playwright, expect
import time

def verify_ai_chat():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:8080")

        # Wait for app to load
        page.wait_for_selector("header")

        # 2. Open Internal Shared Modal
        print("Opening Shared Modal...")
        page.locator("button:has-text('社内共有・戦略')").first.click()

        modal = page.locator("#internalSharedModal")
        expect(modal).to_be_visible()

        # 3. Open AI Chat
        print("Opening AI Chat...")
        ai_btn = page.locator("#btn-category-ai")
        expect(ai_btn).to_be_visible()
        ai_btn.click()

        chat_modal = page.locator("#ai-chat-modal")
        expect(chat_modal).to_be_visible()

        # 4. Verify Greeting
        print("Verifying Greeting...")
        # Use first() to avoid strict mode error if multiple matches (though there should be one container + one text div)
        greeting = page.locator("#ai-messages").get_by_text("資料に基づいて回答します")
        page.wait_for_timeout(1000)
        expect(greeting.first).to_be_visible()

        # 5. Verify Footer is GONE
        print("Verifying Footer Removal...")
        content = page.content()
        if "Powered by Gemini" in content:
            print("FAILURE: 'Powered by Gemini' text found!")
        else:
            print("SUCCESS: 'Powered by Gemini' text not found.")

        # 6. Take Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/verify_ai_chat.png")

        browser.close()

if __name__ == "__main__":
    verify_ai_chat()
