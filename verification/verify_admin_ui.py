
from playwright.sync_api import sync_playwright, expect

def test_admin_ui(page):
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"Browser Error: {exc}"))

    page.goto("http://localhost:3000/index.html")
    page.wait_for_timeout(2000)

    # ... Check Admin Button ...
    team_comm_section = page.locator("button[onclick*='openCategoryChat']").locator("..")
    admin_btn = team_comm_section.locator("button[onclick*='openStrategyAdminAuth']")
    expect(admin_btn).to_be_visible()
    page.screenshot(path="verification/admin_button_visible.png")

    # Need to open parent modal first for child modal to be visible
    print("Opening Internal Shared Modal...")
    page.evaluate("window.openInternalSharedModal('unified')")

    expect(page.locator("#internalSharedModal")).to_be_visible()

    print("Opening Strategy Editor via JS...")
    page.evaluate("window.openStrategyEditor()")

    modal = page.locator("#strategy-editor-modal")
    expect(modal).to_be_visible()

    # Check for AI Summary Textarea
    ai_summary = page.locator("#strategy-editor-ai-summary")
    expect(ai_summary).to_be_visible()

    page.screenshot(path="verification/strategy_editor_ui.png")

    page.evaluate("window.closeStrategyEditor()")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_admin_ui(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()
