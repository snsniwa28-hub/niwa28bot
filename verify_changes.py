
import os

def check_file_content(filepath, search_str, should_exist=True):
    if not os.path.exists(filepath):
        if should_exist:
            print(f"FAIL: {filepath} not found.")
        else:
            print(f"PASS: {filepath} correctly deleted.")
        return

    with open(filepath, 'r') as f:
        content = f.read()
        if search_str in content:
            if should_exist:
                print(f"PASS: Found '{search_str}' in {filepath}.")
            else:
                print(f"FAIL: Found '{search_str}' in {filepath} (should be removed).")
        else:
            if should_exist:
                print(f"FAIL: '{search_str}' not found in {filepath}.")
            else:
                print(f"PASS: '{search_str}' not found in {filepath}.")

print("--- Verification ---")
# 1. js/tasks.js should be gone
check_file_content('js/tasks.js', '', should_exist=False)

# 2. js/shift.js should have initStaffData
check_file_content('js/shift.js', 'export async function initStaffData()', should_exist=True)
check_file_content('js/shift.js', 'window.masterStaffList = shiftState.staffListLists;', should_exist=True)

# 3. main.js should use Shift.initStaffData
check_file_content('main.js', 'Shift.initStaffData().then', should_exist=True)
check_file_content('main.js', 'import * as Tasks', should_exist=False)

# 4. index.html should not have tasks-view or switch-view-staff-btn
check_file_content('index.html', 'id="switch-view-staff-btn"', should_exist=False)
check_file_content('index.html', 'id="app-staff"', should_exist=False)

# 5. js/components.js should not have select-modal
check_file_content('js/components.js', 'id="select-modal"', should_exist=False)

print("--- End Verification ---")
