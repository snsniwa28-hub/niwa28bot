import { db } from './firebase.js';
import { collection, doc, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { $ } from './utils.js';
import { showPasswordModal, openPopupWindow } from './ui.js';

let qscItems = [];
let currentQscTab = '未実施';
let qscEditMode = false;
let qscPopupWin = null;

export function subscribeQSC() {
    onSnapshot(collection(db, "qsc_items"), (s) => {
        qscItems = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.no - b.no);
        const u = qscItems.filter(i => i.status === "未実施").length;
        const countEl = $('#qscUnfinishedCount');
        if(countEl) countEl.textContent = u > 0 ? `残り ${u} 件` : `完了`;

        renderQSCList();
    });
}

// Global handlers for Popup interactivity
window.QSC_registerPopup = (win) => {
    qscPopupWin = win;
    renderQSCList(); // Render immediately into the new window
    updateQscPopupUI();
};

window.QSC_setTab = (tab) => {
    setQscTab(tab);
};

window.QSC_addItem = async (n, a, c) => {
    if(!n||!a||!c) return;
    await addDoc(collection(db, "qsc_items"), { no: Number(n), area:a, content:c, status: "未実施" });
    if(qscPopupWin && !qscPopupWin.closed) {
        const d = qscPopupWin.document;
        if(d.getElementById('newQscNo')) d.getElementById('newQscNo').value = '';
        if(d.getElementById('newQscContent')) d.getElementById('newQscContent').value = '';
    }
};

window.UI_saveQscEdit = async function(id, no, area, content, popupWin) {
    if (!no || !area || !content) {
        alert("すべての項目を入力してください");
        return;
    }

    try {
        await updateDoc(doc(db, "qsc_items", id), {
            no: Number(no),
            area: area,
            content: content
        });
        if(popupWin) popupWin.close();
    } catch(e) {
        alert("更新エラー: " + e.message);
    }
};

export function renderQSCList() {
    // 1. Update Main Window Count (always)
    const u = qscItems.filter(i => i.status === "未実施").length;
    const countEl = $('#qscUnfinishedCount');
    if(countEl) countEl.textContent = u > 0 ? `残り ${u} 件` : `完了`;

    // 2. If Popup is Open, Render List There
    if (qscPopupWin && !qscPopupWin.closed) {
        const c = qscPopupWin.document.getElementById('qscListContainer');
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
            const h = qscPopupWin.document.createElement("div");
            h.className = "text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2 first:mt-0";
            h.textContent = area;
            c.appendChild(h);

            items.forEach(item => {
                const d = qscPopupWin.document.createElement("div");
                d.className = `bg-white p-4 rounded-xl border ${item.status === '完了' ? 'border-slate-100 opacity-60' : 'border-slate-200'} shadow-sm flex items-center gap-4`;

                if (qscEditMode) {
                    d.innerHTML = `
                        <div class="flex-1">
                            <p class="text-sm font-bold text-slate-700">${item.no}. ${item.content}</p>
                        </div>
                        <div class="flex gap-2">
                            <button class="p-2 bg-slate-100 text-slate-500 rounded-full btn-edit-qsc hover:bg-slate-200 transition">✎</button>
                            <button class="p-2 bg-rose-50 text-rose-500 rounded-full btn-delete-qsc hover:bg-rose-100 transition">×</button>
                        </div>
                    `;
                    // Attach listeners using closure since we are in main window scope logic
                    d.querySelector('.btn-edit-qsc').onclick = () => editQscItem(item);
                    d.querySelector('.btn-delete-qsc').onclick = () => deleteQscItem(item.id);
                } else {
                    const cb = qscPopupWin.document.createElement("input");
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
}

function updateQscPopupUI() {
    if (!qscPopupWin || qscPopupWin.closed) return;

    const doc = qscPopupWin.document;

    // Tab Styles
    if (currentQscTab === '未実施') {
        if(doc.getElementById('qscTabUnfinished')) doc.getElementById('qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        if(doc.getElementById('qscTabFinished')) doc.getElementById('qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    } else {
        if(doc.getElementById('qscTabFinished')) doc.getElementById('qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        if(doc.getElementById('qscTabUnfinished')) doc.getElementById('qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    }

    // Edit Button & Form
    const btn = doc.getElementById('qscEditButton');
    const form = doc.getElementById('qscAddForm');

    if (btn && form) {
        if (qscEditMode) {
            btn.textContent = "✅ 完了";
            form.classList.remove('hidden');
        } else {
            btn.textContent = "⚙️ 管理";
            form.classList.add('hidden');
        }
    }
}

export async function addQscItem() {
    // Deprecated DOM version
}

export function editQscItem(item) {
    const html = `
        <div class="flex flex-col h-full justify-center p-6 bg-white">
            <h3 class="text-lg font-bold text-slate-800 mb-4">QSC項目編集</h3>

            <div class="space-y-4 mb-6">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">No. (表示順)</label>
                    <input type="number" id="qscEditNo" value="${item.no}" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">エリア</label>
                    <input type="text" id="qscEditArea" value="${item.area}" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">内容</label>
                    <textarea id="qscEditContent" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">${item.content}</textarea>
                </div>
            </div>

            <div class="flex gap-3">
                <button onclick="window.close()" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">キャンセル</button>
                <button id="btn-save-qsc" class="flex-1 py-2.5 rounded-xl font-bold text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">保存する</button>
            </div>

            <script>
                document.getElementById('btn-save-qsc').onclick = function() {
                    const no = document.getElementById('qscEditNo').value;
                    const area = document.getElementById('qscEditArea').value;
                    const content = document.getElementById('qscEditContent').value;

                    window.opener.UI_saveQscEdit('${item.id}', no, area, content, window);
                };
            </script>
        </div>
    `;

    openPopupWindow('QSC項目編集', html, 400, 500);
}


export function closeQscEditModal() {
   // Deprecated
}

export async function saveQscEdit() {
   // Deprecated
}

export async function deleteQscItem(id) {
    if(confirm("削除しますか？")) {
        await deleteDoc(doc(db, "qsc_items", id));
    }
}

export function toggleQscEditMode() {
    if (qscEditMode) {
        qscEditMode = false;
        renderQSCList();
        updateQscPopupUI();
    } else {
        showPasswordModal('qsc');
    }
}

export function activateQscEditMode() {
    qscEditMode = true;
    renderQSCList();
    updateQscPopupUI();
}

export function openQSCModal() {
    const html = `
        <div class="flex flex-col h-full bg-white">
            <div class="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div class="flex items-center gap-2">
                    <h3 class="font-bold text-xl text-slate-800">QSC チェックリスト</h3>
                    <div class="flex bg-slate-100 p-1 rounded-lg">
                        <button id="qscTabUnfinished" class="px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm">未実施</button>
                        <button id="qscTabFinished" class="px-3 py-1 text-xs font-bold rounded-md text-slate-400">完了済</button>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="qscEditButton" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition">⚙️ 管理</button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
                <div id="qscAddForm" class="hidden mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <h4 class="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-widest">新規項目</h4>
                    <div class="flex flex-col gap-2">
                        <div class="grid grid-cols-3 gap-2">
                            <input type="number" id="newQscNo" placeholder="No." class="border border-slate-200 rounded p-2 text-sm" min="1">
                            <input type="text" id="newQscArea" placeholder="エリア" class="col-span-2 border border-slate-200 rounded p-2 text-sm">
                        </div>
                        <input type="text" id="newQscContent" placeholder="内容" class="border border-slate-200 rounded p-2 text-sm">
                        <button id="btnAddQsc" class="bg-indigo-600 text-white font-bold text-sm py-2 rounded-lg">追加</button>
                    </div>
                </div>

                <div id="qscListContainer" class="space-y-3">
                    <div class="text-center py-10 text-slate-400 font-bold">読み込み中...</div>
                </div>
            </div>
            <div class="p-3 bg-white border-t border-slate-100 text-center">
                <p class="text-xs text-slate-400 font-bold">チェックを入れると全員に反映されます</p>
            </div>
        </div>
        <script>
            window.opener.QSC_registerPopup(window);

            document.getElementById('qscTabUnfinished').onclick = () => window.opener.QSC_setTab('未実施');
            document.getElementById('qscTabFinished').onclick = () => window.opener.QSC_setTab('完了');
            document.getElementById('qscEditButton').onclick = () => window.opener.toggleQscEditMode();
            document.getElementById('btnAddQsc').onclick = () => {
                const n = document.getElementById('newQscNo').value;
                const a = document.getElementById('newQscArea').value;
                const c = document.getElementById('newQscContent').value;
                window.opener.QSC_addItem(n, a, c);
            };
        </script>
    `;

    openPopupWindow('QSC Checks', html, 600, 800);
}

export function closeQSCModal() {
    if(qscPopupWin) qscPopupWin.close();
}

export function setQscTab(tab) {
    currentQscTab = tab;
    renderQSCList();
    updateQscPopupUI();
}
