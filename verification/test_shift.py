from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    try:
        page.goto("http://localhost:8000")
        page.wait_for_selector("#shiftEntryCard")
        page.click("#shiftEntryCard")
        page.wait_for_selector("#shift-modal:not(.hidden)", state="visible", timeout=5000)
        page.screenshot(path="verification/shift_modal.png")
        print("Shift modal opened successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
