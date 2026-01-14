
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

    # Force remove hidden manually if openStrategyEditor fails to do so visually (it shouldn't, but let's debug)
    # Actually, check if it's ACTUALLY hidden in computed style

    print("Opening Strategy Editor via JS...")
    page.evaluate("window.openStrategyEditor()")

    modal = page.locator("#strategy-editor-modal")

    # Wait for a bit
    page.wait_for_timeout(500)

    # Check classes
    classes = modal.get_attribute("class")
    print(f"Classes after open: {classes}")

    # If hidden is still there, print why
    if "hidden" in classes:
        print("ERROR: 'hidden' class was not removed.")
    else:
        print("SUCCESS: 'hidden' class was removed.")

    # Check visibility
    if modal.is_visible():
        print("Modal is visible to Playwright")
    else:
        print("Modal is NOT visible to Playwright")

    # Check for AI Summary Textarea
    ai_summary = page.locator("#strategy-editor-ai-summary")
    if ai_summary.count() > 0:
        print("AI Summary Textarea found in DOM")
        if ai_summary.is_visible():
             print("AI Summary Textarea is visible")
        else:
             print("AI Summary Textarea is NOT visible")
    else:
        print("AI Summary Textarea NOT found in DOM")

    page.screenshot(path="verification/strategy_editor_ui.png")

    page.evaluate("window.closeStrategyEditor()")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_admin_ui(page)
        finally:
            browser.close()
