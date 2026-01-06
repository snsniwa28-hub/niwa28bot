from playwright.sync_api import sync_playwright

def verify_buttons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        page.goto("http://localhost:8080/index.html")

        # Wait a bit for JS to init
        page.wait_for_timeout(1000)

        # 1. Verify Header Nav Button Click (AI Chat)
        print("Clicking #nav-ai...")
        page.click("#nav-ai")
        try:
            page.wait_for_selector("#ai-chat-modal:not(.hidden)", state="visible", timeout=3000)
            print("AI Modal Opened!")
        except Exception as e:
            print(f"Failed to open AI modal: {e}")
            # Take screenshot to see state
            page.screenshot(path="verification/debug_ai_fail.png")
            raise e

        # Close it
        print("Closing AI Modal...")
        page.click("#btn-ai-close")
        page.wait_for_selector("#ai-chat-modal.hidden", state="hidden", timeout=2000)
        print("AI Modal Closed!")

        # 2. Verify Dashboard Card Click (Staff)
        print("Clicking #card-staff...")
        page.click("#card-staff")
        page.wait_for_selector("#app-staff:not(.hidden)", state="visible", timeout=2000)
        print("Switched to Staff View!")

        # 3. Verify Staff Back Button
        print("Clicking Back Button...")
        page.click("#btn-staff-back")
        page.wait_for_selector("#app-customer:not(.hidden)", state="visible", timeout=2000)
        print("Back to Customer View!")

        # 4. Verify Strategy Modal Open
        print("Clicking Pachinko Card...")
        page.click("#card-pachinko")
        page.wait_for_selector("#internalSharedModal:not(.hidden)", state="visible", timeout=2000)
        print("Strategy Modal Opened!")

        page.screenshot(path="verification/button_verification.png")

        browser.close()

if __name__ == "__main__":
    try:
        verify_buttons()
        print("Verification script ran successfully.")
    except Exception as e:
        print(f"Verification failed: {e}")
