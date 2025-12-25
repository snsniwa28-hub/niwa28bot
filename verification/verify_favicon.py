
from playwright.sync_api import sync_playwright

def verify_favicon():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Start a simple HTTP server to serve the current directory
        # We need a server because local file access might behave differently regarding favicons
        import subprocess
        import time

        server = subprocess.Popen(['python3', '-m', 'http.server', '8000'])
        time.sleep(2) # Give it time to start

        try:
            page.goto('http://localhost:8000')

            # Check for the link tags in the head
            icon_link = page.locator('link[rel="icon"]')
            apple_touch_icon_link = page.locator('link[rel="apple-touch-icon"]')

            # Verify attributes
            print(f'Icon href: {icon_link.get_attribute("href")}')
            print(f'Apple Touch Icon href: {apple_touch_icon_link.get_attribute("href")}')

            if icon_link.count() > 0 and apple_touch_icon_link.count() > 0:
                print('Both link tags found.')
            else:
                print('Link tags NOT found.')

        finally:
            server.terminate()
            browser.close()

if __name__ == '__main__':
    verify_favicon()
