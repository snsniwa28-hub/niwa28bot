import { db } from './firebase.js';
import { doc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { MEMBER_TARGET } from './config.js';
import { showPasswordModal, closePasswordModal, showToast, openPopupWindow } from './ui.js';

let memberData = { counts: {}, global_target: MEMBER_TARGET, individual_targets: {} };
let currentTab = 'early'; // early, late, employee
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let unsubscribe = null;

// Expose data to window for popups to access
window.getMemberData = () => memberData;

export function subscribeMemberRace() {
    if (unsubscribe) unsubscribe();

    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    // Update Month Display
    const monthLabel = document.getElementById('member-current-month');
    if (monthLabel) monthLabel.textContent = `${currentYear}年 ${currentMonth}月`;

    unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            memberData = docSnap.data();
            // Ensure defaults
            if (!memberData.counts) memberData.counts = {};
            if (!memberData.individual_targets) memberData.individual_targets = {};
            if (memberData.global_target === undefined) memberData.global_target = MEMBER_TARGET;
        } else {
            // Initialize if not exists
            memberData = {
                counts: {},
                global_target: MEMBER_TARGET,
                individual_targets: {}
            };
        }
        renderMemberRaceBoard();
    });
}

export function changeMemberMonth(delta) {
    let newM = currentMonth + delta;
    let newY = currentYear;
    if (newM > 12) { newM = 1; newY++; }
    else if (newM < 1) { newM = 12; newY--; }

    currentMonth = newM;
    currentYear = newY;
    subscribeMemberRace();
}

export function switchMemberTab(tab) {
    currentTab = tab;

    // Update Tab UI
    ['early', 'late', 'employee'].forEach(t => {
        const btn = document.getElementById(`btn-member-${t}`);
        if(btn) {
            if(t === tab) {
                btn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white shadow-sm text-indigo-600";
            } else {
                btn.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-white transition-all";
            }
        }
    });

    renderMemberRaceBoard();
}

export function renderMemberRaceBoard() {
    const container = document.getElementById('member-list-container');
    if (!container) return;

    // 1. Calculate Totals
    let total = 0;
    if (memberData.counts) {
        Object.values(memberData.counts).forEach(c => total += (c || 0));
    }

    const target = memberData.global_target || MEMBER_TARGET;
    const percentage = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

    document.getElementById('member-total-count').textContent = total;
    document.getElementById('member-target-count').textContent = target;

    const progBar = document.getElementById('member-progress-bar');
    progBar.style.width = `${percentage}%`;
    document.getElementById('member-achievement-rate').textContent = `${percentage}%`;

    if (percentage >= 100) {
        progBar.className = "bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 h-full rounded-full transition-all duration-1000 ease-out animate-pulse";
        const shine = document.getElementById('member-progress-shine');
        if(shine) {
             shine.classList.remove('opacity-0');
             shine.classList.add('animate-ping');
        }
    } else {
         progBar.className = "bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-1000 ease-out";
         const shine = document.getElementById('member-progress-shine');
         if(shine) {
             shine.classList.add('opacity-0');
             shine.classList.remove('animate-ping');
         }
    }

    // 2. Render List
    const staffList = window.masterStaffList;
    if (!staffList || (!staffList.employees && !staffList.alba_early)) {
        container.innerHTML = '<p class="text-center text-slate-400 text-xs font-bold col-span-full py-8">スタッフデータ読み込み中...</p>';
        return;
    }

    let list = [];
    if (currentTab === 'early') list = window.masterStaffList.alba_early || [];
    else if (currentTab === 'late') list = window.masterStaffList.alba_late || [];
    else if (currentTab === 'employee') list = window.masterStaffList.employees || [];

    container.innerHTML = '';

    list.forEach(name => {
        const count = (memberData.counts && memberData.counts[name]) || 0;
        const indTarget = (memberData.individual_targets && memberData.individual_targets[name]) || 0;

        // Logic for styling
        const hasTarget = indTarget > 0;
        const isAchieved = hasTarget && count >= indTarget;
        const isActive = count > 0;

        const card = document.createElement('div');

        // Base classes
        let borderClass = 'border-slate-100';
        let bgClass = 'bg-slate-50';
        let shadowClass = '';

        if (isAchieved) {
            borderClass = 'border-yellow-400 border-2';
            bgClass = 'bg-yellow-50';
            shadowClass = 'shadow-md shadow-yellow-100';
        } else if (isActive) {
            borderClass = 'border-amber-200';
            bgClass = 'bg-amber-50';
            shadowClass = 'shadow-sm';
        }

        card.className = `flex items-center justify-between p-3 rounded-xl border transition-all relative ${borderClass} ${bgClass} ${shadowClass}`;

        // Achievement Crown
        const crownHtml = isAchieved ? `<div class="absolute -top-3 -left-2 bg-yellow-400 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md transform -rotate-12 z-10 text-lg">👑</div>` : '';

        // Target Text
        const displayTarget = hasTarget ? indTarget : '未定';
        const targetHtml = `<span onclick="editMemberTarget('${name}')" class="cursor-pointer hover:text-indigo-500 hover:underline decoration-dotted ml-1" title="目標を変更">/ ${displayTarget}</span>`;
        // UI Improvement: Icon + Text button
        const editBtnHtml = `<button onclick="editMemberTarget('${name}')" class="ml-2 inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg px-2 py-1 transition-colors group" title="目標を編集"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg><span class="text-xs font-bold ml-1 group-hover:text-indigo-600">目標</span></button>`;

        card.innerHTML = `
            ${crownHtml}
            <div class="flex items-center justify-between w-full pl-2">
                <div class="flex items-center gap-3 overflow-hidden">
                     <div class="${isAchieved ? 'bg-yellow-500 text-white' : (isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500')} w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm border-2 border-white">
                        ${count}
                    </div>
                    <div class="truncate">
                        <p class="font-bold text-slate-700 text-sm truncate">${name}</p>
                        <p class="text-[10px] font-bold ${isAchieved ? 'text-yellow-600' : (isActive ? 'text-amber-500' : 'text-slate-400')}">
                           獲得: ${count}${targetHtml}${editBtnHtml}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-1 ml-2">
                    <button onclick="updateMemberCount('${name}', 1)" class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition shadow-sm active:scale-95">＋</button>
                    <button onclick="updateMemberCount('${name}', -1)" class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition active:scale-95">－</button>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

export async function updateMemberCount(name, delta) {
    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) {
                const newData = {
                    counts: {},
                    global_target: MEMBER_TARGET,
                    individual_targets: {},
                    lastUpdated: new Date()
                };
                newData.counts[name] = Math.max(0, delta);
                transaction.set(docRef, newData);
            } else {
                const data = sfDoc.data();
                const current = (data.counts && data.counts[name]) || 0;
                const newCount = Math.max(0, current + delta);

                transaction.update(docRef, {
                    [`counts.${name}`]: newCount,
                    lastUpdated: new Date()
                });
            }
        });
    } catch (e) {
        console.error("Member Update Error:", e);
        alert("更新に失敗しました。");
    }
}

// --- Admin Settings ---
export function openMemberSettings() {
    showPasswordModal('member_admin');
}

export function showMemberTargetModal() {
    // Generate the list items HTML string for the popup
    let listItemsHtml = '';
    if (window.masterStaffList) {
        const allStaff = [
            ...(window.masterStaffList.employees || []),
            ...(window.masterStaffList.alba_early || []),
            ...(window.masterStaffList.alba_late || [])
        ];
        const uniqueStaff = [...new Set(allStaff)];

        uniqueStaff.forEach(name => {
            const currentTarget = (memberData.individual_targets && memberData.individual_targets[name]) || 0;
            listItemsHtml += `
                <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span class="text-sm font-bold text-slate-700">${name}</span>
                    <input type="number" data-name="${name}" class="member-ind-target-input w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value="${currentTarget}" min="0">
                </div>
            `;
        });
    }

    const html = `
        <div class="flex flex-col h-full bg-white">
            <div class="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-slate-800">目標設定 <span class="text-xs text-slate-400 ml-2">${currentYear}年${currentMonth}月</span></h3>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                <div class="mb-6">
                    <label class="block text-xs font-bold text-slate-500 mb-2">店舗全体目標 (件)</label>
                    <input type="number" id="member-global-target-input" value="${memberData.global_target || MEMBER_TARGET}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-xs font-bold text-slate-500">個人目標設定</label>
                        <span class="text-[10px] text-slate-400">※0は目標なし</span>
                    </div>
                    <div id="member-individual-target-list" class="space-y-2">
                        ${listItemsHtml}
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <button id="btn-save-member-targets" class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">設定を保存する</button>
            </div>
        </div>
        <script>
            document.getElementById('btn-save-member-targets').onclick = function() {
                const globalTarget = document.getElementById('member-global-target-input').value;
                const indInputs = document.querySelectorAll('.member-ind-target-input');
                const targets = {};
                indInputs.forEach(inp => {
                    if(inp.value > 0) targets[inp.dataset.name] = inp.value;
                });

                window.opener.UI_saveMemberTargets(globalTarget, targets, window);
            };
        </script>
    `;

    openPopupWindow('目標設定', html, 500, 700);
}

// Global handler for the popup to call
window.UI_saveMemberTargets = async function(globalTarget, individualTargets, popupWin) {
    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        await setDoc(docRef, {
            global_target: parseInt(globalTarget) || 0,
            individual_targets: individualTargets
        }, { merge: true });

        showToast("目標を保存しました");
        if(popupWin) popupWin.close();
    } catch(e) {
        console.error("Save Target Error:", e);
        alert("保存に失敗しました");
    }
};

export function closeMemberTargetModal() {
    // Deprecated for DOM, handled by popup close.
}

export function saveMemberTargets() {
    // Deprecated for DOM usage
}

// --- Dynamic Modal for Single User Target Editing ---

export function editMemberTarget(name) {
    window.currentEditingMember = name;
    const currentTarget = (memberData.individual_targets && memberData.individual_targets[name]) || 0;

    const html = `
        <div class="flex flex-col h-full items-center justify-center p-6">
            <h3 class="text-lg font-bold text-slate-800 mb-4">${name}さんの目標設定</h3>
            <div class="w-full mb-6">
                <label class="block text-xs font-bold text-slate-500 mb-1">個人目標数 (0=目標なし)</label>
                <input type="number" id="editMemberTargetInput" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-2xl font-black text-slate-700 text-center focus:ring-2 focus:ring-indigo-500 outline-none" min="0" value="${currentTarget}">
            </div>
            <div class="flex gap-3 w-full">
                <button onclick="window.close()" class="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">キャンセル</button>
                <button id="btn-save-single" class="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">保存</button>
            </div>
        </div>
        <script>
            const input = document.getElementById('editMemberTargetInput');
            setTimeout(() => input.select(), 100);

            document.getElementById('btn-save-single').onclick = function() {
                window.opener.UI_saveSingleMemberTarget('${name}', input.value, window);
            };

            input.onkeydown = (e) => {
                if(e.key === 'Enter') document.getElementById('btn-save-single').click();
            };
        </script>
    `;

    openPopupWindow(`${name} - 目標設定`, html, 400, 350);
}

window.UI_saveSingleMemberTarget = async function(name, value, popupWin) {
    const newTarget = parseInt(value);
    if (isNaN(newTarget) || newTarget < 0) {
        alert("有効な数値を入力してください。");
        return;
    }

    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        const updatePayload = {
            individual_targets: {
                [name]: newTarget
            }
        };

        await setDoc(docRef, updatePayload, { merge: true });
        showToast(`${name}さんの目標を更新しました`);
        if(popupWin) popupWin.close();

    } catch(e) {
        console.error("Edit Target Error:", e);
        alert("更新に失敗しました");
    }
};
