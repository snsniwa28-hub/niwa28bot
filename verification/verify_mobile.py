from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # iPhone 12 Pro dimensions
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        page.wait_for_selector(".grid")

        # Take screenshot of the grid (Mobile)
        # Capture enough height to see multiple rows
        page.screenshot(path="verification/grid_mobile.png", clip={"x": 0, "y": 400, "width": 390, "height": 800})

        browser.close()

if __name__ == "__main__":
    run()
