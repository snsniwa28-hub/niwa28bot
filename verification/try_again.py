
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))

        page.goto('http://localhost:8000')

        # Wait a bit longer for modules to initialize
        time.sleep(5)

        # Check fonts in head
        content = page.content()
        if 'Kaisei Opti' in content and 'Rampart One' in content:
            print('SUCCESS: Fonts link found in HTML.')
        else:
            print('FAILURE: Fonts link not found.')

        # Verify window object
        # Note: Playwright evaluation context might be different from module context
        # But global window properties should be visible.

        try:
             # We can try to attach a listener to the button and see if it fires
             # Or just check if the function is on window

             handle_exists = page.evaluate('!!window.openStrategyEditor')
             print(f'window.openStrategyEditor exists: {handle_exists}')

             if handle_exists:
                 # Trigger it
                 page.evaluate('window.openStrategyEditor()')
                 time.sleep(1)

                 # Look for the modal which should be visible now
                 modal = page.locator('#strategy-editor-modal')
                 if modal.is_visible():
                     print('SUCCESS: Editor modal opened.')

                     # Check for the new toolbar buttons
                     # Specifically 極太 (Rampart One) and 筆文字 (Kaisei Opti)
                     if page.get_by_role(button, name=極太).is_visible() and page.get_by_role(button, name=筆文字).is_visible():
                         print('SUCCESS: New font buttons visible in toolbar.')
                         page.screenshot(path='verification/verified_strategy_feature.png')
                         print('Screenshot saved.')
                     else:
                         print('FAILURE: Toolbar buttons not found.')
                 else:
                     print('FAILURE: Modal did not open.')

        except Exception as e:
            print(f'Error: {e}')

        browser.close()

if __name__ == '__main__':
    verify_changes()
