from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1200})
        page = context.new_page()

        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        page.wait_for_selector(".grid")

        # Take screenshot of the full grid
        page.screenshot(path="verification/full_grid_desktop.png", clip={"x": 0, "y": 600, "width": 1280, "height": 600})

        browser.close()

if __name__ == "__main__":
    run()
