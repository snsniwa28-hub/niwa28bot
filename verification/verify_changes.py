
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Open the index.html file directly
        # Since I'm in the root, I can use file:// protocol or serve it
        # For simplicity, let's start a server or try file protocol if relative paths allow
        # Best to start a server in background, but let's try python http.server

        page.goto('http://localhost:8000')

        # Wait for fonts to load (a bit tricky, but visual check is key)
        time.sleep(2)

        # Check for font families in computed styles
        # Kaisei Opti should be available for use.
        # Rampart One should be available.

        # Verify Strategy Editor Modal
        # Click the button to open it
        # Try both the desktop button (ID: btn-create-strategy)

        try:
             # Need to simulate being logged in as admin to see the button?
             # No, main.js hides it unless logged in, but I can manually trigger the function

             # Trigger openStrategyEditor
             page.evaluate('window.openStrategyEditor()')
             time.sleep(1)

             # Take screenshot of the editor
             page.screenshot(path='verification/strategy_editor.png')
             print('Strategy editor screenshot taken.')

             # Verify new tags buttons exist
             content = page.content()
             if 'Kaisei Opti' in content or 'Rampart One' in content:
                 print('Fonts found in HTML (link tag).')

             # Check if buttons for tags exist
             if '筆文字' in content and '極太' in content:
                 print('New tag buttons found.')

        except Exception as e:
            print(f'Error: {e}')

        browser.close()

if __name__ == '__main__':
    verify_changes()

