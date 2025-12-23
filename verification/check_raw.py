
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load file directly to bypass potential server issues if any (though server seemed fine)
        # Using server is better for module loading due to CORS
        page.goto('http://localhost:8000')

        time.sleep(5)

        # Check raw HTML content for fonts
        html = page.content()
        if 'Kaisei+Opti' in html and 'Rampart+One' in html:
             print('SUCCESS: Font URL params found in HTML source.')
        else:
             print('FAILURE: Font URL params NOT found in HTML source.')
             print(f'Snippet: {html[:500]}') # print head part

        # Check functionality
        # If window.openStrategyEditor is not defined, it might be that an error occurred in js/strategy.js execution
        # Let's check if the module loaded at all

        try:
             # Just try to open the modal by clicking the button if it exists
             # The button logic in main.js calls initStrategy which sets up the listener for #btn-create-strategy

             # But first let's see if we can force the property check again
             prop_check = page.evaluate('window.openStrategyEditor')
             print(f'Property check: {prop_check}')

        except Exception as e:
            print(f'Error: {e}')

        browser.close()

if __name__ == '__main__':
    verify_changes()
