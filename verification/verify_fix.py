from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Load the page
    page.goto("http://localhost:8080/index.html")

    # 2. Mock Firebase & Auth to avoid errors and bypass login
    # We will override the Shift module's internal state via JS if possible,
    # but since it's a module, we can't access variables directly.
    # Instead, we will simulate user actions and mock the network or override functions.

    # Actually, simpler approach: Just click the buttons and see if we can get to the modal.
    # But authentication will block us.
    # Let's inject a script to expose the Shift module or override functions.

    # Wait for modules to load
    page.wait_for_timeout(1000)

    # 3. Open Shift View
    # We can trigger the click on #shiftEntryCard
    page.click("#shiftEntryCard")
    page.wait_for_timeout(1000) # Wait for view to open

    # 4. Bypass Admin Login and Open Staff Master
    # Since we can't easily bypass Google Auth in this environment without mocking,
    # we will try to manually invoke the modal opening logic by importing the module in the page context.

    page.evaluate("""async () => {
        // Dynamic import to get the module
        const Shift = await import('./js/shift.js');

        // Mock data
        Shift.shiftState = Shift.shiftState || {}; // Should be there but not exported directly usually
        // Actually shiftState is not exported. But we can trigger openStaffEditModal directly if we can access the module.

        // Since we can't modify non-exported variables, we rely on the fact that `openStaffEditModal` is exported.
        // We can call it with null to create new staff, or with a name to edit.
        // But we need DOM elements to be present.

        // Ensure modals are created
        Shift.createShiftModals();

        // Mock document elements if needed, but they should be there after createShiftModals.

        // Simulate data loading
        // effectively we just want to see if `openStaffEditModal` throws an error or works.
        // The error `window.updateRankOptions is not a function` would happen here.

        // Let's try to open the "Add Staff" modal (name=null)
        try {
            await Shift.openStaffEditModal(null);
            console.log("Modal opened successfully");
        } catch (e) {
            console.error("Error opening modal:", e);
            document.body.setAttribute('data-error', e.message);
        }
    }""")

    page.wait_for_timeout(500)

    # 5. Check for Error
    error_attr = page.evaluate("document.body.getAttribute('data-error')")
    if error_attr:
        print(f"JS Error detected: {error_attr}")
        # Fail the test? Or just log.

    # 6. Verify Dropdown Options
    # Check if #se-rank has options.
    options_count = page.locator("#se-rank option").count()
    print(f"Rank options found: {options_count}")

    if options_count == 0:
        print("FAIL: No options found in rank dropdown.")
    else:
        print("PASS: Rank dropdown populated.")

    # 7. Take Screenshot
    page.screenshot(path="verification/modal_fix.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
