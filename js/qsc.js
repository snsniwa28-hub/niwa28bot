import { db } from './firebase.js';
import { collection, doc, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { $ } from './utils.js';
import { showPasswordModal } from './ui.js';

let qscItems = [];
let currentQscTab = '未実施';
let qscEditMode = false;

export function subscribeQSC() {
    onSnapshot(collection(db, "qsc_items"), (s) => {
        qscItems = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.no - b.no);
        const u = qscItems.filter(i => i.status === "未実施").length;
        const countEl = $('#qscUnfinishedCount');
        if(countEl) countEl.textContent = u > 0 ? `残り ${u} 件` : `完了`;

        if(!$('#qscModal').classList.contains("hidden")) renderQSCList();
    });
}

export function renderQSCList() {
    const c = $('#qscListContainer');
    if(!c) return;
    c.innerHTML = "";

    const f = qscItems.filter(item => currentQscTab === '未実施' ? item.status === "未実施" : item.status === "完了");

    if (f.length === 0) {
        c.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold">項目はありません</div>`;
        return;
    }

    const g = {};
    f.forEach(item => { if(!g[item.area]) g[item.area] = []; g[item.area].push(item); });

    for(const [area, items] of Object.entries(g)) {
        const h = document.createElement("div");
        h.className = "text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2 first:mt-0";
        h.textContent = area;
        c.appendChild(h);

        items.forEach(item => {
            const d = document.createElement("div");
            d.className = `bg-white p-4 rounded-xl border ${item.status === '完了' ? 'border-slate-100 opacity-60' : 'border-slate-200'} shadow-sm flex items-center gap-4`;

            if (qscEditMode) {
                d.innerHTML = `<div class="flex-1"><p class="text-sm font-bold text-slate-700">${item.no}. ${item.content}</p></div><button class="p-2 bg-rose-50 text-rose-500 rounded-full btn-delete-qsc">×</button>`;
                d.querySelector('.btn-delete-qsc').onclick = () => deleteQscItem(item.id);
            } else {
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "qsc-checkbox shrink-0 mt-0.5";
                cb.checked = item.status === "完了";
                cb.onchange = async () => {
                    try {
                        await updateDoc(doc(db, "qsc_items", item.id), { status: cb.checked ? "完了" : "未実施" });
                    } catch(e) {
                        cb.checked = !cb.checked;
                    }
                };
                d.innerHTML = `<div class="flex-1"><p class="text-sm font-bold text-slate-700 ${item.status === '完了' ? 'line-through text-slate-400' : ''}">${item.no}. ${item.content}</p></div>`;
                d.insertBefore(cb, d.firstChild);
            }
            c.appendChild(d);
        });
    }
}

export async function addQscItem() {
    const n = $('#newQscNo').value;
    const a = $('#newQscArea').value;
    const c = $('#newQscContent').value;

    if(!n||!a||!c) return;

    await addDoc(collection(db, "qsc_items"), { no: Number(n), area:a, content:c, status: "未実施" });
    $('#newQscNo').value='';
    $('#newQscContent').value='';
}

export async function deleteQscItem(id) {
    if(confirm("削除しますか？")) {
        await deleteDoc(doc(db, "qsc_items", id));
    }
}

export function toggleQscEditMode() {
    if (qscEditMode) {
        qscEditMode = false;
        $('#qscEditButton').textContent = "⚙️ 管理";
        $('#qscAddForm').classList.add('hidden');
        renderQSCList();
    } else {
        showPasswordModal('qsc');
    }
}

export function activateQscEditMode() {
    qscEditMode = true;
    $('#qscEditButton').textContent = "✅ 完了";
    $('#qscAddForm').classList.remove('hidden');
    renderQSCList();
}

export function openQSCModal() {
    $('#qscModal').classList.remove('hidden');
    renderQSCList();
}

export function closeQSCModal() {
    $('#qscModal').classList.add('hidden');
}

export function setQscTab(tab) {
    currentQscTab = tab;
    if (tab === '未実施') {
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    } else {
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    }
    renderQSCList();
}
