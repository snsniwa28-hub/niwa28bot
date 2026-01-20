import { db } from './firebase.js';
import {
    collection,
    addDoc,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getTodayDateString, $ } from './utils.js';

let unsubscribe = null;

export function initMoneyMemo() {
    const listContainer = $('#money-memo-list');
    if (!listContainer) return;

    fetchMoneyStaff();

    const dateFilter = $('#money-memo-filter-date');
    if (dateFilter) {
        dateFilter.value = getTodayDateString();
        dateFilter.addEventListener('change', () => {
             subscribeMoneyMemos(dateFilter.value);
        });
        subscribeMoneyMemos(dateFilter.value);
    } else {
        // Fallback if no filter (should not happen with new HTML)
        subscribeMoneyMemos(getTodayDateString());
    }
}

async function fetchMoneyStaff() {
    try {
        const docRef = doc(db, 'masters', 'staff_data');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            const details = data.staff_details || {};
            const allNames = [
                ...(data.employees || []),
                ...(data.alba_early || []),
                ...(data.alba_late || [])
            ];

            const moneyStaff = allNames.filter(name => {
                const d = details[name];
                return d && d.allowed_roles && (d.allowed_roles.includes('money_main') || d.allowed_roles.includes('money_sub'));
            });

            // Remove duplicates and sort
            const uniqueStaff = [...new Set(moneyStaff)].sort();

            const datalist = $('#money-memo-staff-list');
            if (datalist) {
                datalist.innerHTML = uniqueStaff.map(name => `<option value="${name}"></option>`).join('');
            }
        }
    } catch (e) {
        console.error("Error fetching staff data:", e);
    }
}

function subscribeMoneyMemos(dateStr) {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    const listContainer = $('#money-memo-list');
    if (!dateStr) return;

    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const q = query(
        collection(db, "money_memos"),
        where("occurredAt", ">=", Timestamp.fromDate(start)),
        where("occurredAt", "<=", Timestamp.fromDate(end)),
        orderBy("occurredAt", "desc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        renderMoneyMemoList(snapshot);
    }, (error) => {
        console.error("Error fetching money memos: ", error);
        if (listContainer) listContainer.innerHTML = '<p class="text-center text-slate-400 py-4">読み込みエラーが発生しました</p>';
    });
}

export function openMoneyMemoModal() {
    const modal = $('#money-memo-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Ensure flex display for centering if needed, or just remove hidden

        // Set defaults
        const dateInput = $('#money-memo-date');
        const timeInput = $('#money-memo-time');
        const reporterInput = $('#money-memo-reporter');
        const machineInput = $('#money-memo-machine');

        if (dateInput) dateInput.value = getTodayDateString();
        if (timeInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        }

        if (reporterInput) {
            const savedName = localStorage.getItem('money_memo_reporter');
            if (savedName) reporterInput.value = savedName;
        }
        if (machineInput) machineInput.value = '';
    }
}

export function closeMoneyMemoModal() {
    const modal = $('#money-memo-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // Reset form
        $('#money-memo-form').reset();
    }
}

export async function saveMoneyMemo() {
    const dateVal = $('#money-memo-date').value;
    const timeVal = $('#money-memo-time').value;
    const reporterName = $('#money-memo-reporter').value;
    const machineVal = $('#money-memo-machine').value;
    const category = $('#money-memo-category').value;
    const amountVal = $('#money-memo-amount').value;
    const description = $('#money-memo-description').value;

    if (!dateVal || !timeVal || !reporterName || !category || !description) {
        alert("必須項目を入力してください（日付、時間、対応者名、トラブル名、内容）");
        return;
    }

    try {
        const occurredAt = new Date(`${dateVal}T${timeVal}`);

        await addDoc(collection(db, "money_memos"), {
            createdAt: serverTimestamp(),
            occurredAt: Timestamp.fromDate(occurredAt),
            reporterName: reporterName,
            machine_number: machineVal || null,
            category: category,
            amount: amountVal ? Number(amountVal) : null,
            description: description
        });

        localStorage.setItem('money_memo_reporter', reporterName);

        alert("保存しました");
        $('#money-memo-form').reset();

        // Reset defaults after save
        $('#money-memo-date').value = getTodayDateString();
        const now = new Date();
        $('#money-memo-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        $('#money-memo-reporter').value = reporterName; // Keep name

    } catch (e) {
        console.error("Error saving money memo: ", e);
        alert("保存に失敗しました");
    }
}

function renderMoneyMemoList(snapshot) {
    const container = $('#money-memo-list');
    if (!container) return;

    if (snapshot.empty) {
        container.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">この日の記録はありません</p>';
        return;
    }

    let html = '<div class="space-y-3">';

    snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.occurredAt ? data.occurredAt.toDate() : new Date();

        const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

        let amountDisplay = '';
        if (data.amount !== null && data.amount !== undefined && data.amount !== '') {
            amountDisplay = `<div class="text-indigo-600 font-bold">¥${Number(data.amount).toLocaleString()}</div>`;
        }

        let machineDisplay = '';
        if (data.machine_number) {
            machineDisplay = `<span class="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">#${data.machine_number}</span>`;
        }

        // Category Badge Color
        let badgeColor = "bg-slate-100 text-slate-500";
        if (data.category === "金フラ") badgeColor = "bg-rose-100 text-rose-600";
        else if (data.category === "e0" || data.category === "e1") badgeColor = "bg-amber-100 text-amber-600";
        else if (data.category === "精算機") badgeColor = "bg-blue-100 text-blue-600";
        else if (data.category === "両替") badgeColor = "bg-emerald-100 text-emerald-600";

        html += `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">${timeStr}</span>
                        ${machineDisplay}
                        <span class="${badgeColor} text-xs font-bold px-2 py-1 rounded-md border border-transparent">${data.category}</span>
                    </div>
                    ${amountDisplay}
                </div>
                <div class="mb-2">
                    <p class="text-sm font-bold text-slate-700 whitespace-pre-wrap">${data.description}</p>
                </div>
                <div class="flex justify-end items-center gap-2 text-xs text-slate-400 font-bold">
                    <span>対応: ${data.reporterName}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
