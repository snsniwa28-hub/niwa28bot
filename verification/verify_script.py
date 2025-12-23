from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Open local server
        page.goto("http://localhost:8080/index.html")
        # Relaxed wait
        page.wait_for_selector("#newOpeningCard", timeout=10000)

        # 2. Check "New Opening" Card
        # In this env, DB access might fail or be empty, which triggers our "disabled" state.
        # Let's check the class list to see if 'opacity-50' is present (meaning empty/disabled).
        card = page.locator("#newOpeningCard")
        classes = card.get_attribute("class")
        print(f"Card classes: {classes}")

        # Screenshot of dashboard
        page.screenshot(path="verification/dashboard_initial.png")
        print("Dashboard screenshot taken.")

        # 3. Check Internal Shared Modal - Pachinko
        pachinko_btn = page.locator("button:has-text('パチンコ共有')")
        if pachinko_btn.is_visible():
            pachinko_btn.click()
            # Wait for modal to appear and have the correct title
            # The title text should be "パチンコ共有" and color should be pink-600
            page.wait_for_selector("#internalSharedModal h3:has-text('パチンコ共有')")

            modal_title = page.locator("#internalSharedModal h3")
            print(f"Modal Title: {modal_title.inner_text()}")

            # Check if text-pink-600 is in class
            title_class = modal_title.get_attribute("class")
            if "text-pink-600" in title_class:
                print("SUCCESS: Title has pink color.")
            else:
                print(f"FAIL: Title class is {title_class}")

            page.screenshot(path="verification/modal_pachinko.png")

            # Close
            page.locator("#internalSharedModal button:has-text('✕')").click()
            page.wait_for_timeout(500)

        # 4. Check Internal Shared Modal - Monthly Strategy
        strategy_btn = page.locator("button:has-text('月間戦略')")
        if strategy_btn.is_visible():
            strategy_btn.click()
            page.wait_for_selector("#internalSharedModal h3:has-text('月間戦略')")

            modal_title = page.locator("#internalSharedModal h3")
            print(f"Modal Title: {modal_title.inner_text()}")

            # Check if text-red-600 is in class
            title_class = modal_title.get_attribute("class")
            if "text-red-600" in title_class:
                print("SUCCESS: Title has red color.")
            else:
                print(f"FAIL: Title class is {title_class}")

            page.screenshot(path="verification/modal_strategy.png")

            # Close
            page.locator("#internalSharedModal button:has-text('✕')").click()

        browser.close()

if __name__ == "__main__":
    verify_changes()
