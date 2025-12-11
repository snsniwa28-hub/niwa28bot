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

function formatDate(dateStr) {
    if (!dateStr) return '---';
    try {
        // Parse YYYY-MM-DD
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);

        // Days array
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = days[date.getDay()];

        return `${month}/${day}(${dayOfWeek})`;
    } catch (e) {
        return dateStr;
    }
}

function createDeadlineElement(id, data) {
    const isHighPriority = data.priority === 'high';

    const div = document.createElement('div');
    div.className = `flex items-start justify-between p-3 rounded-xl border ${isHighPriority ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'} mb-2`;

    const leftPart = document.createElement('div');
    leftPart.className = 'flex flex-col gap-1 overflow-hidden flex-1';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex items-center gap-2';

    // Date badge
    const dateSpan = document.createElement('span');
    dateSpan.className = `shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${isHighPriority ? 'bg-rose-200 text-rose-700' : 'bg-slate-200 text-slate-600'}`;
    // Use automatic formatting
    dateSpan.textContent = formatDate(data.date);

    // Content
    const contentSpan = document.createElement('span');
    contentSpan.className = `text-sm font-bold ${isHighPriority ? 'text-rose-700' : 'text-slate-700'}`;
    contentSpan.textContent = data.content || '';

    headerDiv.appendChild(dateSpan);
    headerDiv.appendChild(contentSpan);
    leftPart.appendChild(headerDiv);

    // Remarks
    if (data.remarks) {
        const remarksP = document.createElement('p');
        remarksP.className = `text-xs ml-1 ${isHighPriority ? 'text-rose-500' : 'text-slate-500'}`;
        remarksP.textContent = `※ ${data.remarks}`;
        leftPart.appendChild(remarksP);
    }

    div.appendChild(leftPart);

    // Delete button (hidden by default)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'deadline-delete-btn hidden shrink-0 ml-2 text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-full hover:bg-rose-50 self-center';
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
    const remarksInput = document.getElementById('deadline-remarks-input');
    const priorityInput = document.getElementById('deadline-priority-input'); // checkbox

    const dateVal = dateInput.value;
    const contentVal = contentInput.value.trim();
    const remarksVal = remarksInput ? remarksInput.value.trim() : '';
    const isHigh = priorityInput.checked;

    if (!dateVal || !contentVal) {
        alert("日付と内容は必須です");
        return;
    }

    try {
        await addDoc(collection(db, "deadlines"), {
            date: dateVal,
            content: contentVal,
            remarks: remarksVal,
            priority: isHigh ? 'high' : 'normal',
            createdAt: serverTimestamp()
        });

        // Reset inputs
        contentInput.value = '';
        if (remarksInput) remarksInput.value = '';
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
