
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to the local server
    page.goto("http://localhost:8080")

    # 1. Open the Internal Sharing Modal
    # Use exact selector or role
    page.get_by_role("button", name="社内共有・戦略").click()

    # Wait for modal to appear
    modal = page.locator("#internalSharedModal")
    expect(modal).to_be_visible()

    # 2. Check the Title
    # It should be "社内共有・戦略（全体）"
    title_el = modal.locator("h3")
    expect(title_el).to_have_text("社内共有・戦略（全体）")
    print("Checked Title: OK")

    # 3. Simulate opening Editor (We need to be admin or mock it)
    page.evaluate("window.openStrategyEditor()")

    editor = page.locator("#strategy-editor-modal")
    expect(editor).to_be_visible()

    # 4. Check Category Select Default
    select = page.locator("#strategy-editor-category")
    # Value should be "" (empty)
    expect(select).to_have_value("")
    print("Checked Select Default: OK")

    # 5. Check Save Validation
    # Setup dialog handler
    def handle_dialog(dialog):
        print(f"Alert message: {dialog.message}")
        dialog.accept()

    page.on("dialog", handle_dialog)

    # Trigger save via JS
    page.evaluate("window.saveStrategy()")

    # 6. Take Screenshot of Editor showing strict select
    page.screenshot(path="verification_strategy.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
