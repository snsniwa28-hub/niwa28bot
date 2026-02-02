from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        print("Navigating...")
        page.goto("http://localhost:8080/index.html", wait_until="domcontentloaded")

        # Wait for JS to initialize (giving it a sec for module imports)
        time.sleep(2)

        # Check if function exists
        print("Checking window.openInternalSharedModal...")
        is_defined = page.evaluate("typeof window.openInternalSharedModal")
        print(f"window.openInternalSharedModal type: {is_defined}")

        print("Clicking button...")
        try:
            # Click and wait for class change potentially
            page.locator("#open-unified-chat-btn").click(timeout=2000)
            print("Clicked.")
        except Exception as e:
            print(f"Click failed: {e}")

        time.sleep(1) # Wait for animation/class toggle

        modal = page.locator("#strategy-view")
        classes = modal.get_attribute("class")
        print(f"Classes: {classes}")

        if "active" in classes:
            print("SUCCESS: Modal is active.")
        else:
            print("FAILURE: Modal is NOT active.")

        browser.close()

if __name__ == "__main__":
    run()
