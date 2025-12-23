import os
from playwright.sync_api import sync_playwright

# Create directory
os.makedirs("/home/jules/verification", exist_ok=True)

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000")

    # Inject data and state
    page.evaluate("""async () => {
        const m = await import('./js/shift.js');
        m.createShiftModals();

        // Mock State
        window.shiftState.shiftDataCache = {
            'StaffA': {
                assignments: { 1: 'A出勤' },
                monthly_settings: { shift_type: 'A' },
                remarks: '',
                daily_remarks: {}
            },
            'StaffB': {
                assignments: {},
                monthly_settings: { shift_type: 'A' },
                remarks: '',
                daily_remarks: {}
            }
        };
        window.shiftState.staffDetails = {
            'StaffA': { rank: '一般', basic_shift: 'A', contract_days: 20, allowed_roles: [], type: 'employee' },
            'StaffB': { rank: '一般', basic_shift: 'A', contract_days: 20, allowed_roles: [], type: 'employee' }
        };
        window.shiftState.staffListLists = {
            employees: ['StaffA', 'StaffB'],
            alba_early: [],
            alba_late: []
        };
        window.shiftState.currentYear = 2024;
        window.shiftState.currentMonth = 10;
        window.shiftState.prevMonthCache = {};

        // Show Main View Container
        const mainView = document.getElementById('shift-main-view');
        if(mainView) mainView.classList.remove('translate-x-full');

        // Go to Admin Mode
        window.activateShiftAdminMode();

        // Enable Adjustment Mode
        window.shiftState.adjustmentMode = true;
        const chk = document.getElementById('chk-adjustment-mode');
        if(chk) chk.checked = true;

        // Re-render
        m.renderShiftAdminTable();
    }""")

    # Wait for table
    page.wait_for_selector('td[data-name="StaffA"]', timeout=5000)

    # Click Cell (StaffA, Day 1)
    page.click('td[data-name="StaffA"][data-day="1"]')

    # Wait for candidate list
    page.wait_for_selector('#adj-candidate-list > div', timeout=5000)

    # Click candidate
    page.click('#adj-candidate-list > div')

    # Wait for confirmation modal
    page.wait_for_selector('#adjustment-confirm-modal', state='visible', timeout=5000)

    # Screenshot
    page.screenshot(path="/home/jules/verification/modal_verification.png")

    browser.close()

with sync_playwright() as p:
    run(p)
