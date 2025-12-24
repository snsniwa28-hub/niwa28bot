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
let editingDeadlineId = null; // Track which deadline is being edited
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
    const container = document.getElementById("deadlines-list");
    if (!container || !latestDeadlineSnapshot) return;

    container.innerHTML = '';

    if (latestDeadlineSnapshot.empty) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">現在のお知らせはありません</p>';
        return;
    }

    latestDeadlineSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const el = createDeadlineElement(docSnap.id, data, false); // false = not manager mode
        container.appendChild(el);
    });
}

// Render Manager List (with Delete buttons)
function renderDeadlineManager() {
    const container = document.getElementById("deadline-manager-list");
    if (!container || !latestDeadlineSnapshot) return;

    container.innerHTML = '';

    if (latestDeadlineSnapshot.empty) {
        container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">現在のお知らせはありません</p>';
        return;
    }

    latestDeadlineSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const el = createDeadlineElement(docSnap.id, data, true); // true = manager mode
        container.appendChild(el);
    });
}

export function updateDeadlineStaffLists() {
    renderDeadlinesList();
    if (document.getElementById("deadline-management-modal") && !document.getElementById("deadline-management-modal").classList.contains("hidden")) {
        renderDeadlineManager();
    }
}

function createDeadlineElement(id, data, isManager = false) {
    const isHighPriority = data.priority === 'high';
    const isCompleted = data.completed === true;
    const isExpanded = deadlineUIState.expandedIds.has(id);
    const activeTab = deadlineUIState.activeTabs[id] || 'employees'; // default to employees

    const container = document.createElement('div');

    // Style adjustments for completed items
    let bgClass = isHighPriority ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100';
    if (isCompleted) bgClass = 'bg-slate-100 border-slate-200 opacity-60 grayscale';

    container.className = `rounded-xl border ${bgClass} mb-2 overflow-hidden transition-all duration-300`;

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
    contentSpan.className = `text-sm font-bold truncate ${isHighPriority ? 'text-rose-700' : 'text-slate-700'} ${isCompleted ? 'line-through text-slate-400' : ''}`;
    contentSpan.textContent = data.content || '';

    leftPart.appendChild(dateSpan);
    leftPart.appendChild(contentSpan);
    mainRow.appendChild(leftPart);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'flex items-center gap-1 shrink-0';

    // Manager Buttons (Complete Toggle)
    if (isManager) {
        const completeBtn = document.createElement('button');

        completeBtn.className = `text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1 ${isCompleted ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600'}`;
        completeBtn.innerHTML = isCompleted ? '<span>済</span>' : '<span>未</span>';
        completeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleComplete(id, !isCompleted);
        };
        actionContainer.appendChild(completeBtn);
    }

    // Check Status Toggle Button (Always visible)
    const checkToggleBtn = document.createElement('button');
    checkToggleBtn.className = "text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm";

    // Calculate checked count
    const checks = data.checks || {};
    const checkedCount = Object.values(checks).filter(v => v === true).length;
    checkToggleBtn.textContent = `確認 ${checkedCount}名`;

    const checklistId = `checklist-${id}${isManager ? '-mgr' : ''}`;

    checkToggleBtn.onclick = () => {
        // We use a unique set ID logic for manager vs dashboard if needed, but sharing state is fine
        // Actually, if we open it in manager, we might want it to persist or not.
        // Let's share state for simplicity, but DOM IDs must be unique if both views existed (they don't really overlap visually but safer to suffix)

        if (deadlineUIState.expandedIds.has(id)) {
            deadlineUIState.expandedIds.delete(id);
            // Close in all views? Or just re-render?
            // Re-render is safest to sync UI state
            updateDeadlineStaffLists();
        } else {
            deadlineUIState.expandedIds.add(id);
            updateDeadlineStaffLists();
        }
    };

    actionContainer.appendChild(checkToggleBtn);

    // Manager Buttons
    if (isManager) {
        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'text-slate-400 hover:text-indigo-500 transition-colors p-1.5 rounded-full hover:bg-indigo-50 ml-1';
        editBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>';
        editBtn.onclick = () => startEditDeadline(id, data);
        actionContainer.appendChild(editBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-slate-400 hover:text-rose-500 transition-colors p-1.5 rounded-full hover:bg-rose-100 ml-0.5';
        deleteBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.onclick = () => deleteDeadline(id);
        actionContainer.appendChild(deleteBtn);
    }

    mainRow.appendChild(actionContainer);
    container.appendChild(mainRow);

    // Checklist Container (Collapsible)
    const checklistDiv = document.createElement('div');
    checklistDiv.id = checklistId;
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

    return container;
}

export function activateDeadlineAdminMode() {
    // Called when password check passes
    openDeadlineManager();
}

export function openDeadlineManager() {
    const modal = document.getElementById("deadline-management-modal");
    if (modal) {
        modal.classList.remove("hidden");
        renderDeadlineManager();

        // Set default date
        const dateInput = document.getElementById('deadline-date-input');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
        }
    }
}

export function closeDeadlineManager() {
    const modal = document.getElementById("deadline-management-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
    cancelEditMode();
}

function startEditDeadline(id, data) {
    editingDeadlineId = id;

    // Populate form
    const dateInput = document.getElementById('deadline-date-input');
    const contentInput = document.getElementById('deadline-content-input');
    const priorityInput = document.getElementById('deadline-priority-input');
    const addBtn = document.getElementById('deadline-add-btn-action'); // Need to ID this button in HTML or select by query

    if (dateInput) dateInput.value = data.date || '';
    if (contentInput) contentInput.value = data.content || '';
    if (priorityInput) priorityInput.checked = (data.priority === 'high');

    // Update Button Text (We need to select the button properly)
    // Since I didn't add an ID to the button in the previous step, I will select it via context
    const btn = document.querySelector('#deadline-management-modal button.bg-indigo-600');
    if (btn) {
        btn.textContent = "更新";
        btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
        btn.classList.replace('hover:bg-indigo-700', 'hover:bg-emerald-700');
    }
}

function cancelEditMode() {
    editingDeadlineId = null;
    const dateInput = document.getElementById('deadline-date-input');
    const contentInput = document.getElementById('deadline-content-input');
    const priorityInput = document.getElementById('deadline-priority-input');

    if (dateInput) dateInput.value = '';
    if (contentInput) contentInput.value = '';
    if (priorityInput) priorityInput.checked = false;

    const btn = document.querySelector('#deadline-management-modal button.bg-emerald-600');
    if (btn) {
        btn.textContent = "追加";
        btn.classList.replace('bg-emerald-600', 'bg-indigo-600');
        btn.classList.replace('hover:bg-emerald-700', 'hover:bg-indigo-700');
    }
}

// "updateEditModeUI" removed as we use separate modal

export async function addDeadline() {
    const dateInput = document.getElementById('deadline-date-input');
    const contentInput = document.getElementById('deadline-content-input');
    const priorityInput = document.getElementById('deadline-priority-input'); // checkbox

    const dateVal = dateInput.value;
    const contentVal = contentInput.value.trim();
    const isHigh = priorityInput.checked;

    if (!dateVal || !contentVal) {
        alert("日付と内容は必須です");
        return;
    }

    // Auto format date: YYYY-MM-DD -> M/D
    const [year, month, day] = dateVal.split('-');
    const displayVal = `${Number(month)}/${Number(day)}`;

    const docData = {
        date: dateVal,
        displayDate: displayVal,
        content: contentVal,
        priority: isHigh ? 'high' : 'normal',
        updatedAt: serverTimestamp()
    };

    try {
        if (editingDeadlineId) {
            // Update existing
            await updateDoc(doc(db, "deadlines", editingDeadlineId), docData);
            showToast("更新しました");
            cancelEditMode();
        } else {
            // Create new
            docData.createdAt = serverTimestamp();
            docData.checks = {};
            docData.completed = false; // Default status
            await addDoc(collection(db, "deadlines"), docData);
            showToast("追加しました");

            // Clear inputs (partial)
            contentInput.value = '';
            priorityInput.checked = false;
        }

        renderDeadlineManager();
    } catch (e) {
        console.error("Error saving deadline:", e);
        alert("保存に失敗しました");
    }
}

async function toggleComplete(id, newStatus) {
    try {
        await updateDoc(doc(db, "deadlines", id), {
            completed: newStatus
        });
        // Realtime listener updates UI
    } catch (e) {
        console.error("Error toggling complete:", e);
        showToast("更新に失敗しました", true);
    }
}

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
