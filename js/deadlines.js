import { db } from './firebase.js';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

let editMode = false;

export function initDeadlines() {
    subscribeDeadlines();
    setupDeadlineForm();
}

function subscribeDeadlines() {
    const q = query(collection(db, "deadlines"), orderBy("date", "asc"));

    // Using onSnapshot for real-time updates
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById("deadlines-list");
        if (!container) return;

        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">現在のお知らせはありません</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const el = createDeadlineElement(docSnap.id, data);
            container.appendChild(el);
        });

        updateEditModeUI();
    }, (error) => {
        console.error("Error fetching deadlines:", error);
    });
}

function createDeadlineElement(id, data) {
    const isHighPriority = data.priority === 'high';

    const div = document.createElement('div');
    div.className = `flex items-center justify-between p-3 rounded-xl border ${isHighPriority ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'} mb-2`;

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

    div.appendChild(leftPart);

    // Delete button (hidden by default)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'deadline-delete-btn hidden shrink-0 ml-2 text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-full hover:bg-rose-50';
    deleteBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    deleteBtn.onclick = () => deleteDeadline(id);

    div.appendChild(deleteBtn);

    return div;
}

function setupDeadlineForm() {
    const addBtn = document.getElementById('deadline-add-btn');
    if (addBtn) {
        addBtn.onclick = addDeadline;
    }
}

export function activateDeadlineAdminMode() {
    editMode = true;
    updateEditModeUI();
    const form = document.getElementById("deadline-add-form");
    if (form) {
        form.classList.remove("hidden");
    }
}

function updateEditModeUI() {
    const deleteBtns = document.querySelectorAll('.deadline-delete-btn');
    deleteBtns.forEach(btn => {
        if (editMode) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });
}

async function addDeadline() {
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

    try {
        await addDoc(collection(db, "deadlines"), {
            date: dateVal, // used for sorting
            displayDate: displayVal,
            content: contentVal,
            priority: isHigh ? 'high' : 'normal',
            createdAt: serverTimestamp()
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

async function deleteDeadline(id) {
    if (!confirm("このお知らせを削除しますか？")) return;
    try {
        await deleteDoc(doc(db, "deadlines", id));
        showToast("削除しました");
    } catch (e) {
        console.error("Error deleting deadline:", e);
        alert("削除に失敗しました");
    }
}
