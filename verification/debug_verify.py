
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))
        page.on('pageerror', lambda exc: print(f'PAGE ERROR: {exc}'))

        page.goto('http://localhost:8000')

        # Wait for potential module load
        time.sleep(5)

        # Check fonts in head
        content = page.content()
        if 'Kaisei Opti' in content and 'Rampart One' in content:
            print('SUCCESS: Fonts link found in HTML.')
        else:
            print('FAILURE: Fonts link not found.')

        # Check if window.openStrategyEditor is defined
        try:
             is_defined = page.evaluate('typeof window.openStrategyEditor !== undefined')
             print(f'window.openStrategyEditor defined: {is_defined}')

             if is_defined:
                 page.evaluate('window.openStrategyEditor()')
                 time.sleep(1)
                 page.screenshot(path='verification/strategy_editor.png')
                 print('Screenshot taken.')
             else:
                 print('window.openStrategyEditor is NOT defined. Module likely failed to load.')

        except Exception as e:
            print(f'Error during evaluation: {e}')

        browser.close()

if __name__ == '__main__':
    verify_changes()
