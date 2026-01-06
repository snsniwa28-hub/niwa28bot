import { db } from './firebase.js';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal } from './ui.js';

let editMode = false;
const deadlineUIState = {
    expandedIds: new Set(),
    activeTabs: {} // id -> 'employees' | 'early' | 'late'
};

export function initDeadlines() {
    subscribeDeadlines();
}

// Function to update staff lists in existing deadlines (called from tasks.js after master fetch)
let latestDeadlineSnapshot = null;

function subscribeDeadlines() {
    const q = query(collection(db, "deadlines"), orderBy("date", "asc"));

    // Using onSnapshot for real-time updates
    onSnapshot(q, (snapshot) => {
        latestDeadlineSnapshot = snapshot;
        renderDeadlinesList();
    }, (error) => {
        console.error("Error fetching deadlines:", error);
    });
}

function renderDeadlinesList() {
    if (!latestDeadlineSnapshot) return;

    // Render for Dashboard (View Mode)
    const dashboardContainer = document.getElementById("deadlines-list");
    if (dashboardContainer) {
        dashboardContainer.innerHTML = '';
        if (latestDeadlineSnapshot.empty) {
            dashboardContainer.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">現在のお知らせはありません</p>';
        } else {
            latestDeadlineSnapshot.forEach((docSnap) => {
                dashboardContainer.appendChild(createDeadlineElement(docSnap.id, docSnap.data(), 'view'));
            });
        }
    }

    // Render for Admin Modal (Admin Mode)
    const adminContainer = document.getElementById("deadlines-list-admin");
    if (adminContainer) {
        adminContainer.innerHTML = '';
        if (latestDeadlineSnapshot.empty) {
            adminContainer.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">現在のお知らせはありません</p>';
        } else {
            latestDeadlineSnapshot.forEach((docSnap) => {
                adminContainer.appendChild(createDeadlineElement(docSnap.id, docSnap.data(), 'admin'));
            });
        }
    }
}

export function updateDeadlineStaffLists() {
    renderDeadlinesList();
}

function createDeadlineElement(id, data, mode) {
    const isHighPriority = data.priority === 'high';
    const isExpanded = deadlineUIState.expandedIds.has(id);
    const activeTab = deadlineUIState.activeTabs[id] || 'employees'; // default to employees

    const container = document.createElement('div');
    container.className = `rounded-xl border ${isHighPriority ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'} mb-2 overflow-hidden transition-all duration-300`;

    // Main Row
    const mainRow = document.createElement('div');
    mainRow.className = "flex items-center justify-between p-3";

    const leftPart = document.createElement('div');
    leftPart.className = 'flex items-center gap-3 overflow-hidden flex-1';

    // Date badge
    const dateSpan = document.createElement('span');
    dateSpan.className = `shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${isHighPriority ? 'bg-rose-200 text-rose-700' : 'bg-slate-200 text-slate-600'}`;
    dateSpan.textContent = data.displayDate || '---';

    // Content
    const contentSpan = document.createElement('span');
    contentSpan.className = `text-sm font-bold truncate ${isHighPriority ? 'text-rose-700' : 'text-slate-700'}`;
    contentSpan.textContent = data.content || '';

    leftPart.appendChild(dateSpan);
    leftPart.appendChild(contentSpan);
    mainRow.appendChild(leftPart);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'flex items-center gap-1 shrink-0';

    // Check Status Toggle Button (View Mode Only)
    if (mode === 'view') {
        const checkToggleBtn = document.createElement('button');
        checkToggleBtn.className = "text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm";

        // Calculate checked count
        const checks = data.checks || {};
        const checkedCount = Object.values(checks).filter(v => v === true).length;
        checkToggleBtn.textContent = `確認 ${checkedCount}名`;

        const checklistId = `checklist-${id}-${mode}`; // Unique ID for dashboard
        checkToggleBtn.onclick = () => {
            if (deadlineUIState.expandedIds.has(id)) {
                deadlineUIState.expandedIds.delete(id);
                document.getElementById(checklistId).classList.add('hidden');
            } else {
                deadlineUIState.expandedIds.add(id);
                document.getElementById(checklistId).classList.remove('hidden');
            }
        };
        actionContainer.appendChild(checkToggleBtn);
    }

    // Delete button (Admin Mode Only)
    if (mode === 'admin') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-slate-400 hover:text-rose-500 transition-colors p-1.5 rounded-full hover:bg-rose-100';
        deleteBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.onclick = () => deleteDeadline(id);
        actionContainer.appendChild(deleteBtn);
    }

    mainRow.appendChild(actionContainer);
    container.appendChild(mainRow);

    // Checklist Container (Collapsible) - Only in View Mode
    if (mode === 'view') {
        const checklistDiv = document.createElement('div');
        checklistDiv.id = `checklist-${id}-${mode}`;
        const isExpanded = deadlineUIState.expandedIds.has(id);
        checklistDiv.className = `${isExpanded ? '' : 'hidden'} bg-white border-t border-slate-100 p-4 animate-fade-in`;

        // Tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = "flex justify-center mb-4";
        const tabWrapper = document.createElement('div');
        tabWrapper.className = "bg-slate-100 p-1 rounded-xl flex gap-1";

        const createTabBtn = (key, label) => {
            const btn = document.createElement('button');
            const isActive = activeTab === key;
            btn.className = `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50'}`;
            btn.textContent = label;
            btn.onclick = () => {
                deadlineUIState.activeTabs[id] = key;
                renderDeadlinesList(); // Re-render to update list based on new tab
            };
            return btn;
        };

        tabWrapper.appendChild(createTabBtn('employees', '社員'));
        tabWrapper.appendChild(createTabBtn('early', '早番'));
        tabWrapper.appendChild(createTabBtn('late', '遅番'));
        tabsContainer.appendChild(tabWrapper);
        checklistDiv.appendChild(tabsContainer);

        // Staff List Grid
        const gridContainer = document.createElement('div');
        gridContainer.id = `grid-${id}`;

        if (window.masterStaffList) {
            let staffList = [];
            if (activeTab === 'employees') staffList = window.masterStaffList.employees || [];
            else if (activeTab === 'early') staffList = window.masterStaffList.alba_early || [];
            else if (activeTab === 'late') staffList = window.masterStaffList.alba_late || [];

            // Remove duplicates
            const uniqueStaff = [...new Set(staffList)];

            const checks = data.checks || {};

            if (uniqueStaff.length > 0) {
                const grid = document.createElement('div');
                grid.className = "grid grid-cols-2 sm:grid-cols-3 gap-2";

                uniqueStaff.forEach(name => {
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors";

                    const checkbox = document.createElement('input');
                    checkbox.type = "checkbox";
                    checkbox.className = "w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500";
                    checkbox.checked = !!checks[name];

                    checkbox.onchange = () => toggleDeadlineCheck(id, name, checkbox.checked);

                    const span = document.createElement('span');
                    span.className = "text-xs font-bold text-slate-600 select-none";
                    span.textContent = name;

                    label.appendChild(checkbox);
                    label.appendChild(span);
                    grid.appendChild(label);
                });
                gridContainer.appendChild(grid);
            } else {
                gridContainer.innerHTML = '<p class="text-xs text-slate-400 text-center">該当するスタッフがいません</p>';
            }
        } else {
            gridContainer.innerHTML = '<p class="text-xs text-slate-400 text-center">スタッフリスト読み込み中...</p>';
        }

        checklistDiv.appendChild(gridContainer);
        container.appendChild(checklistDiv);
    }

    return container;
}

export function openDeadlineManagementModal() {
    const modal = document.getElementById("deadlineManagementModal");
    if (modal) {
        modal.classList.remove("hidden");
        // Ensure rendering happens when opened to populate the admin list
        renderDeadlinesList();

        // Initialize Date Input with today if empty
        const dateInput = document.getElementById('new-deadline-date');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
        }
    }
}

export function closeDeadlineManagementModal() {
    const modal = document.getElementById("deadlineManagementModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    // Clear inputs
    const contentInput = document.getElementById('new-deadline-content');
    const priorityInput = document.getElementById('new-deadline-priority');
    if (contentInput) contentInput.value = '';
    if (priorityInput) priorityInput.checked = false;
}

// Function to add deadline directly from Management Modal
export async function addDeadlineDirectly() {
    const dateInput = document.getElementById('new-deadline-date');
    const contentInput = document.getElementById('new-deadline-content');
    const priorityInput = document.getElementById('new-deadline-priority');

    const dateVal = dateInput.value;
    const contentVal = contentInput.value.trim();
    const isHigh = priorityInput.checked;

    if (!dateVal || !contentVal) {
        alert("日付と内容は必須です");
        return;
    }

    const [year, month, day] = dateVal.split('-');
    const displayVal = `${Number(month)}/${Number(day)}`;

    try {
        await addDoc(collection(db, "deadlines"), {
            date: dateVal,
            displayDate: displayVal,
            content: contentVal,
            priority: isHigh ? 'high' : 'normal',
            createdAt: serverTimestamp(),
            checks: {}
        });

        // Reset inputs
        contentInput.value = '';
        priorityInput.checked = false;
        showToast("お知らせを追加しました");
    } catch (e) {
        console.error("Error adding deadline:", e);
        alert("追加に失敗しました");
    }
}

// Deprecated functions (cleaned up if no longer used by main.js, but keeping for compatibility if references exist)
export function openDeadlineModal() {}
export function closeDeadlineModal() {}
export async function addDeadline() {} // Legacy function

// ... (Rest of delete/toggle functions)

async function toggleDeadlineCheck(id, name, isChecked) {
    try {
        const docRef = doc(db, "deadlines", id);
        const updateData = {};
        updateData[`checks.${name}`] = isChecked;
        await updateDoc(docRef, updateData);
        // Note: Real-time listener will update the UI count
    } catch (e) {
        console.error("Error updating check:", e);
        showToast("更新に失敗しました", true); // Error toast
    }
}

async function deleteDeadline(id) {
    showConfirmModal("削除確認", "このお知らせを削除しますか？", async () => {
        try {
            await deleteDoc(doc(db, "deadlines", id));
            showToast("削除しました");
        } catch (e) {
            console.error("Error deleting deadline:", e);
            alert("削除に失敗しました");
        }
    }, 'bg-rose-600');
}
