from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Load index.html via file protocol
        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for dashboard to render (initially might be loading state)
        # We can wait for the dashboard section
        page.wait_for_selector("#operations-dashboard-section")

        # Take screenshot of the top section (Operations Dashboard)
        page.screenshot(path="verification/dashboard_desktop.png", clip={"x": 0, "y": 0, "width": 1280, "height": 600})

        # Wait for the grid to appear
        page.wait_for_selector(".grid")

        # Take screenshot of the main grid (Function Buttons)
        # Adjust clip height to capture the grid area
        page.screenshot(path="verification/grid_desktop.png", clip={"x": 0, "y": 600, "width": 1280, "height": 600})

        browser.close()

if __name__ == "__main__":
    run()
