from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 375, "height": 812}) # Mobile viewport

    page.goto("http://localhost:8080")

    # Wait for the main content to load
    page.wait_for_selector("#open-unified-chat-btn")

    # Click the Team Communication button which opens the modal
    # Force click because sometimes the fade-in animation or overlay might interfere
    page.click("#open-unified-chat-btn", force=True)

    # Wait for modal to be visible - increase timeout
    # The modal has id="internalSharedModal" and classes "modal-overlay hidden" initially.
    # When opened, it should lose "hidden" and gain "flex".
    try:
        page.wait_for_selector("#internalSharedModal:not(.hidden)", state="visible", timeout=5000)
    except Exception as e:
        print(f"Failed to wait for modal: {e}")
        page.screenshot(path="verification/failed_to_open.png")
        # Try to execute JS directly to open it
        page.evaluate("window.openInternalSharedModal('unified')")
        page.wait_for_selector("#internalSharedModal:not(.hidden)", state="visible")

    # Wait a bit for animations
    page.wait_for_timeout(1000)

    # Take screenshot of the modal content
    modal_content = page.locator("#internalSharedModal .modal-content")
    modal_content.screenshot(path="verification/header_mobile.png")

    # Also take a desktop screenshot
    page.set_viewport_size({"width": 1280, "height": 720})
    page.wait_for_timeout(500)
    modal_content.screenshot(path="verification/header_desktop.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
