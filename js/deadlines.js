import { db } from './firebase.js';
import { collection, doc, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { $ } from './utils.js';

let deadlineItems = [];
let isEditing = false;

export function subscribeDeadlines() {
    onSnapshot(collection(db, "deadlines"), (s) => {
        deadlineItems = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => {
             if (a.date < b.date) return -1;
             if (a.date > b.date) return 1;
             return 0;
        });
        renderDeadlinesList();
    });
}

export function renderDeadlinesList() {
    const c = $('#deadlinesListContainer');
    if(!c) return;
    c.innerHTML = "";

    // Header / Title logic could be outside, but let's just manage the list content here.

    if (deadlineItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = "text-center py-4 text-slate-400 text-sm font-bold";
        empty.textContent = "期限物はありません";
        c.appendChild(empty);
    } else {
        const list = document.createElement('div');
        list.className = "space-y-3";

        deadlineItems.forEach(item => {
             const el = document.createElement('div');
             el.className = "flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100";

             let html = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0">
                        ${item.displayDate || item.date}
                    </div>
                    <div class="text-sm font-bold text-slate-700 truncate">
                        ${item.content}
                    </div>
                </div>
             `;

             if (isEditing) {
                 html += `
                    <button onclick="deleteDeadline('${item.id}')" class="text-slate-400 hover:text-rose-500 p-2 shrink-0 transition">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 `;
             }

             el.innerHTML = html;
             list.appendChild(el);
        });
        c.appendChild(list);
    }

    if (isEditing) {
        renderAddForm(c);
    }
}

function renderAddForm(container) {
    const form = document.createElement('div');
    form.className = "mt-4 pt-4 border-t border-slate-100";
    form.innerHTML = `
        <div class="grid grid-cols-1 gap-2 mb-2">
            <div class="flex gap-2">
                <input type="date" id="newDeadlineSortDate" class="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ソート日付">
                <input type="text" id="newDeadlineDisplay" placeholder="表示日付 (例: 12/15 12時)" class="w-2/3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <input type="text" id="newDeadlineContent" placeholder="内容 (例: シフト提出)" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <button onclick="addDeadline()" class="w-full bg-indigo-600 text-white text-sm font-bold py-2 rounded-lg shadow-md hover:bg-indigo-700 transition">期限物を追加</button>
    `;
    container.appendChild(form);
}

export async function addDeadline() {
    const sortDate = $('#newDeadlineSortDate').value;
    const dispDate = $('#newDeadlineDisplay').value;
    const content = $('#newDeadlineContent').value;

    if (!sortDate || !dispDate || !content) {
        alert("すべての項目を入力してください");
        return;
    }

    try {
        await addDoc(collection(db, "deadlines"), {
            date: sortDate,
            displayDate: dispDate,
            content: content
        });
        // Clear inputs handled by re-render or could clear manually here
        $('#newDeadlineSortDate').value = '';
        $('#newDeadlineDisplay').value = '';
        $('#newDeadlineContent').value = '';
    } catch(e) {
        console.error("Error adding deadline:", e);
        alert("追加に失敗しました");
    }
}

export async function deleteDeadline(id) {
    if(confirm("削除しますか？")) {
        try {
            await deleteDoc(doc(db, "deadlines", id));
        } catch(e) {
            console.error("Error deleting deadline:", e);
            alert("削除に失敗しました");
        }
    }
}

export function activateEditMode() {
    isEditing = true;
    renderDeadlinesList();
}
