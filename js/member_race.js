import { db } from './firebase.js';
import { doc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { MEMBER_TARGET } from './config.js';
import { showPasswordModal, closePasswordModal, showToast } from './ui.js';

let memberData = { counts: {}, global_target: MEMBER_TARGET, individual_targets: {} };
let currentTab = 'early'; // early, late, employee
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let unsubscribe = null;

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
    // We expect window.masterStaffList to be populated or being populated.
    // If it's missing (rare with new logic), we show loading.
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
        const editBtnHtml = `<button onclick="editMemberTarget('${name}')" class="ml-1 w-5 h-5 inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors" title="目標を編集"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg></button>`;

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
    const modal = document.getElementById('member-target-modal');
    document.getElementById('member-target-modal-month').textContent = `${currentYear}年${currentMonth}月`;

    // Fill Global Target
    document.getElementById('member-global-target-input').value = memberData.global_target || MEMBER_TARGET;

    // Generate Staff List
    const listContainer = document.getElementById('member-individual-target-list');
    listContainer.innerHTML = '';

    if (window.masterStaffList) {
        // Merge all lists for editing
        const allStaff = [
            ...(window.masterStaffList.employees || []),
            ...(window.masterStaffList.alba_early || []),
            ...(window.masterStaffList.alba_late || [])
        ];

        // Remove duplicates if any
        const uniqueStaff = [...new Set(allStaff)];

        uniqueStaff.forEach(name => {
            const currentTarget = (memberData.individual_targets && memberData.individual_targets[name]) || 0;
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100";
            div.innerHTML = `
                <span class="text-sm font-bold text-slate-700">${name}</span>
                <input type="number" data-name="${name}" class="member-ind-target-input w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right text-sm font-bold" value="${currentTarget}" min="0">
            `;
            listContainer.appendChild(div);
        });
    }

    modal.classList.remove('hidden');
}

export function closeMemberTargetModal() {
    document.getElementById('member-target-modal').classList.add('hidden');
}

export async function saveMemberTargets() {
    const globalTarget = parseInt(document.getElementById('member-global-target-input').value) || 0;
    const indInputs = document.querySelectorAll('.member-ind-target-input');
    const newIndTargets = {};

    indInputs.forEach(input => {
        const val = parseInt(input.value);
        if (val > 0) {
            newIndTargets[input.dataset.name] = val;
        }
    });

    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        await setDoc(docRef, {
            global_target: globalTarget,
            individual_targets: newIndTargets
        }, { merge: true });

        showToast("目標を保存しました");
        closeMemberTargetModal();
    } catch(e) {
        console.error("Save Target Error:", e);
        alert("保存に失敗しました");
    }
}

export async function editMemberTarget(name) {
    const currentTarget = (memberData.individual_targets && memberData.individual_targets[name]) || 0;
    const input = prompt(`${name}さんの目標数を入力してください (0=目標なし):`, currentTarget);

    if (input === null) return; // Cancelled

    const newTarget = parseInt(input);
    if (isNaN(newTarget) || newTarget < 0) {
        alert("有効な数値を入力してください。");
        return;
    }

    const docId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        // We use setDoc with merge to ensure nested field update works correctly or create if missing
        // Construct the update object strictly for this field to avoid overwriting others if race condition (though transaction is safer, setDoc merge is okay for single field if structure is known)
        // Actually, to update a nested map field "individual_targets.NAME", we need dot notation in update(), or read-modify-write.
        // Let's use setDoc with merge for simplicity as we have the full object structure logic.
        // Wait, setDoc with { merge: true } matches top level. To update nested, we need:
        // { "individual_targets.NAME": val }
        // BUT setDoc doesn't support dot notation for keys in the object passed as first arg in the same way update() does unless we structure it: { individual_targets: { [name]: val } } WITH merge:true.

        const updatePayload = {
            individual_targets: {
                [name]: newTarget
            }
        };

        if (newTarget === 0) {
            // If 0, maybe we want to delete it? But keeping as 0 is fine based on logic.
            // "0=目標なし" implies 0 is stored.
        }

        await setDoc(docRef, updatePayload, { merge: true });
        showToast(`${name}さんの目標を更新しました`);

    } catch(e) {
        console.error("Edit Target Error:", e);
        alert("更新に失敗しました");
    }
}
