
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load local index.html
    # Since we are in the repo root, we can use absolute path
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # Wait for the button to appear
    page.wait_for_selector("#open-money-memo-btn")

    # Click the button
    page.click("#open-money-memo-btn")

    # Wait for modal
    page.wait_for_selector("#money-memo-modal", state="visible")

    # Take screenshot of the modal
    page.screenshot(path="verification/money_memo_modal.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
