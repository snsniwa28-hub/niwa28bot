
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load via HTTP server
        page.goto('http://localhost:8080/index.html')

        # Check for the new date navigation header
        # It initially has 'hidden' class.
        # renderOperationsBoard calls updateMachineDateDisplay which removes hidden.
        # However, JS modules need to load and execute.
        # We need to wait for the hidden class to be removed.

        # Wait for #machine-date-nav to not have class 'hidden'
        try:
            page.wait_for_selector('#machine-date-nav:not(.hidden)', timeout=10000)
        except Exception as e:
            print(f'Error waiting for selector: {e}')
            # Take screenshot even if failed to see state
            page.screenshot(path='verification/frontend_verify_fail.png')
            browser.close()
            return

        # Take screenshot of the operations section
        # Locate the section
        section = page.locator('#operations-dashboard-section')
        section.screenshot(path='verification/frontend_verify.png')

        browser.close()

if __name__ == '__main__':
    run()
