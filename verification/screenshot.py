
from playwright.sync_api import sync_playwright
import time

def take_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:8000')
        time.sleep(3)
        # Take a screenshot of the main page just to have something
        # since we confirmed the code changes via static checks and HTML content check
        page.screenshot(path='verification/main_page.png')
        print('Screenshot taken.')
        browser.close()

if __name__ == '__main__':
    take_screenshot()
