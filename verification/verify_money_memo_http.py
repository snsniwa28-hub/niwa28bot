
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load via HTTP server
    page.goto("http://localhost:8080/index.html")

    # Wait for the button to appear and be stable
    page.wait_for_selector("#open-money-memo-btn", state="visible")

    # Click the button
    page.click("#open-money-memo-btn")

    # Wait for modal to be visible
    # We wait for the element to have class 'flex' or not have 'hidden'
    # Or just wait for selector visibility which checks computed style
    page.wait_for_selector("#money-memo-modal", state="visible")

    # Take screenshot of the modal
    page.screenshot(path="verification/money_memo_modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
