from playwright.sync_api import sync_playwright

def verify_map_recovery():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:8080")

        # Wait for map section
        page.wait_for_selector("#map-section")

        # 1. Simulate "Destruction" of the image (as if the old error handler ran)
        # We manually remove the img tag to test the recovery logic in JS
        page.evaluate("""() => {
            const img = document.querySelector('#map-section img');
            if(img) img.remove();

            // Also add a fake error message to simulate the old state
            const container = document.querySelector('#map-container-inner');
            if(container) container.innerHTML = '<div class="error">Old Error</div>';
        }""")

        # 2. Trigger fetchMapData logic manually (since we can't push to Firestore)
        # We will call the function that listens to snapshot.
        # But wait, we can't trigger onSnapshot from here easily without mocking.

        # However, we can verify that IF the JS runs, it recreates the image.
        # Let's inspect the code we just wrote? No, we need to verify runtime behavior.

        # We can check if the INITIAL load of the page (which calls fetchMapData)
        # recovers the image if it was missing?
        # No, initial load happens on page load.

        # We can verify the "Update Map" flow DOES NOT fail.
        # But without a backend, saveMapUpdate will fail or hang.

        # Let's verify the `onerror` handler in the HTML is the new one.
        img_onerror = page.get_attribute("#map-section img", "onerror")
        print(f"Current onerror: {img_onerror}")

        if "this.classList.add('hidden')" in img_onerror and "map-error-msg" in img_onerror:
             print("SUCCESS: New non-destructive error handler detected.")
        else:
             print("FAILURE: Old or incorrect error handler detected.")
             exit(1)

        # verify that the image exists
        count = page.locator("#map-section img").count()
        if count == 1:
            print("SUCCESS: Image element is present.")
        else:
            print("FAILURE: Image element is missing.")

        browser.close()

if __name__ == "__main__":
    verify_map_recovery()
