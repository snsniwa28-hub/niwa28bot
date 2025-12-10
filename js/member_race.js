import { db } from './firebase.js';
import { doc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { MEMBER_TARGET } from './config.js';

let memberData = { counts: {} };
let currentTab = 'early'; // early, late, employee

export function subscribeMemberRace() {
    const d = new Date();
    const docId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            memberData = docSnap.data();
        } else {
            // Initialize if not exists
            memberData = { counts: {}, target: MEMBER_TARGET };
        }
        renderMemberRaceBoard();
    });
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

    const target = MEMBER_TARGET;
    const percentage = Math.min(100, Math.round((total / target) * 100));

    document.getElementById('member-total-count').textContent = total;
    document.getElementById('member-target-count').textContent = target;

    const progBar = document.getElementById('member-progress-bar');
    progBar.style.width = `${percentage}%`;
    document.getElementById('member-achievement-rate').textContent = `${percentage}%`;

    if (percentage >= 100) {
        progBar.className = "bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 h-full rounded-full transition-all duration-1000 ease-out animate-pulse";
        document.getElementById('member-progress-shine').classList.remove('opacity-0');
        document.getElementById('member-progress-shine').classList.add('animate-ping');
    } else {
         progBar.className = "bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-1000 ease-out";
         document.getElementById('member-progress-shine').classList.add('opacity-0');
         document.getElementById('member-progress-shine').classList.remove('animate-ping');
    }

    // 2. Render List
    if (!window.masterStaffList) {
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
        const isActive = count > 0;

        const card = document.createElement('div');
        card.className = `flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`;

        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="${isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'} w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                    ${name.charAt(0)}
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 leading-none mb-1">獲得数</p>
                    <p class="text-lg font-black ${isActive ? 'text-amber-600' : 'text-slate-600'}">${count}</p>
                </div>
            </div>
            <div class="flex flex-col gap-1">
                <button onclick="updateMemberCount('${name}', 1)" class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition shadow-sm">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>
                </button>
                 <button onclick="updateMemberCount('${name}', -1)" class="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50 transition">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4"/></svg>
                </button>
            </div>
        `;

        // Add full name as title
        card.title = name;

        // Name overlay
        const nameOverlay = document.createElement('div');
        nameOverlay.className = "absolute top-0 left-0 w-full h-full opacity-0 hover:opacity-100 bg-white/90 backdrop-blur-sm flex items-center justify-center font-bold text-slate-800 transition-opacity rounded-xl pointer-events-none";
        nameOverlay.textContent = name;
        // Actually, just showing name is better.
        // Let's adjust layout to show name always.

        card.innerHTML = `
             <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-3 overflow-hidden">
                     <div class="${isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'} w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-sm border-2 border-white">
                        ${count}
                    </div>
                    <div class="truncate">
                        <p class="font-bold text-slate-700 text-sm truncate">${name}</p>
                         <p class="text-[10px] font-bold ${isActive ? 'text-amber-500' : 'text-slate-400'}">${isActive ? '獲得あり!' : '未獲得'}</p>
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
    const d = new Date();
    const docId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, "member_acquisition", docId);

    try {
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) {
                const newData = { counts: {}, target: MEMBER_TARGET, lastUpdated: new Date() };
                newData.counts[name] = Math.max(0, delta);
                transaction.set(docRef, newData);
            } else {
                const data = sfDoc.data();
                const current = (data.counts && data.counts[name]) || 0;
                const newCount = Math.max(0, current + delta);

                if (!data.counts) data.counts = {};
                data.counts[name] = newCount;
                data.lastUpdated = new Date();

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
