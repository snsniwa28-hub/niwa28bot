from playwright.sync_api import sync_playwright

def verify_strategy_knowledge_checkbox():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the app (using localhost:8080)
        page.goto("http://localhost:8080/index.html")

        # Wait for app to load
        page.wait_for_selector("text=社内共有・戦略")

        # Open "Internal Shared & Strategy" modal
        page.click("text=社内共有・戦略")

        # Mock isStrategyAdmin = true to see the create button, or use openStrategyAdminAuth
        # Since we can't easily mock auth in this static context without typing password,
        # we can inject a script to set the flag or call the open function directly.

        # Calling openStrategyEditor directly from window context
        page.evaluate("window.openStrategyEditor()")

        # Wait for the editor modal to appear
        page.wait_for_selector("#strategy-editor-modal")

        # Check if the Knowledge Checkbox exists
        # Selector based on the added HTML
        checkbox_selector = "#strategy-is-knowledge"
        page.wait_for_selector(checkbox_selector)

        # Take screenshot of the editor with the new checkbox
        page.screenshot(path="verification_knowledge_checkbox.png")

        # Verify text presence
        content = page.content()
        assert "この記事をAIの知識ベース（長期記憶）として登録する" in content
        assert "チェックが入っている場合、Firestore保存時に isKnowledge: true をセットする" not in content # Logic check, not text check

        print("Verification successful: Checkbox found.")

        browser.close()

if __name__ == "__main__":
    verify_strategy_knowledge_checkbox()
