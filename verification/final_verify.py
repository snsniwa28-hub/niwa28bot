
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))
        page.on('pageerror', lambda exc: print(f'PAGE ERROR: {exc}'))

        page.goto('http://localhost:8000')

        time.sleep(3)

        # Check if window.openStrategyEditor is defined
        try:
             is_defined = page.evaluate('typeof window.openStrategyEditor !== undefined')
             print(f'window.openStrategyEditor defined: {is_defined}')

             if is_defined:
                 # Manually trigger the editor open
                 page.evaluate('window.openStrategyEditor()')
                 time.sleep(1)

                 # Verify buttons with new fonts exist in the editor
                 # The 'toolbar' HTML is injected into the DOM.
                 # Let's check for the text '筆文字' and '極太' which are part of the new feature.
                 content = page.content()
                 if '筆文字' in content and '極太' in content:
                      print('SUCCESS: New toolbar buttons found.')
                      page.screenshot(path='verification/strategy_editor_verified.png')
                 else:
                      print('FAILURE: New toolbar buttons NOT found.')

             else:
                 print('window.openStrategyEditor is NOT defined.')

        except Exception as e:
            print(f'Error during evaluation: {e}')

        browser.close()

if __name__ == '__main__':
    verify_changes()
