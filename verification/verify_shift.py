
import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import time
import os

PORT = 8092

def run_server():
    os.chdir(os.getcwd())
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def start_server_thread():
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(2)

async def main():
    start_server_thread()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(f"http://localhost:{PORT}/index.html")
            await page.wait_for_timeout(2000)

            # Initialize Modals and Inject Mock Data
            await page.evaluate("""() => {
                if (!window.createShiftModals) {
                    console.error("createShiftModals not exposed!");
                    throw new Error("createShiftModals missing");
                }
                // Create DOM
                window.createShiftModals();

                // Mock Staff
                window.shiftState.staffListLists = {
                    employees: ['Emp1'],
                    alba_early: ['Alba1'],
                    alba_late: []
                };

                window.shiftState.staffDetails = {
                    'Emp1': { rank: '一般', type: 'employee', basic_shift: 'A' },
                    'Alba1': { rank: 'Regular', type: 'byte', basic_shift: 'A' }
                };

                // Mock Shift Data (Empty assignments)
                window.shiftState.shiftDataCache = {
                    'Emp1': { assignments: {}, monthly_settings: { shift_type: 'A' } },
                    'Alba1': { assignments: {}, monthly_settings: { shift_type: 'A' } }
                };

                window.shiftState.currentYear = 2025;
                window.shiftState.currentMonth = 5;

                // Render Admin Table
                window.shiftState.isAdminMode = true;

                // Unhide the modal and the view
                document.getElementById('shift-modal').classList.remove('hidden');
                document.getElementById('shift-view-admin').classList.remove('hidden');

                window.renderShiftAdminTable();
            }""")

            await page.wait_for_timeout(1000)

            # Check for empty cells (Request 1)
            content = await page.evaluate("""() => {
                const rows = document.querySelectorAll('#shift-admin-body tr');
                // Row 0: Section Title
                // Row 1: Emp1
                // Emp1 has Name cell + 31 days (May has 31)
                const cells = rows[1].querySelectorAll('td');
                // Cell 0: Name, Cell 1: Day 1
                return cells[1].innerText;
            }""")

            print(f"Cell Content (Should be empty): '{content}'")
            if content.strip() == "":
                print("SUCCESS: Cell is empty.")
            else:
                print(f"FAILURE: Cell has content '{content}'")

            await page.screenshot(path="verification/admin_table_before.png")

            # Verify Request 2: generateAutoShift fill
            await page.evaluate("""() => {
                window.confirm = () => true;
                window.alert = (msg) => console.log("Alert:", msg);
                window.generateAutoShift();
            }""")

            await page.wait_for_timeout(2000)

            # Check assignments
            result = await page.evaluate("""() => {
                const s = window.shiftState.shiftDataCache['Emp1'];
                // Day 1 should be assigned something. If not role, then '公休'.
                return s.assignments[1];
            }""")

            print(f"Assignment for Day 1: '{result}'")

            # If it's undefined, fail.
            if not result:
                print("FAILURE: Assignment is undefined.")
            else:
                print(f"SUCCESS: Assignment is present ('{result}').")

            await page.screenshot(path="verification/admin_table_after.png")
            print("Screenshots saved in verification/")

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="verification/error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
