import { db } from './firebase.js';
import { collection, doc, onSnapshot, getDocs, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { $, getTodayDateString, getYesterdayDateString } from './utils.js';
import { showToast } from './ui.js';
import { parseFile } from './file_parser.js';

let todayOpData = null;
let yesterdayOpData = null;
let monthlyOpData = {};
let editingOpDate = null;
let returnToCalendar = false;
let returnToMachineCalendar = false;
let viewingMachineDate = getTodayDateString(); // State for Machine View

// Dynamic Date Management (Operations)
let currentOpYear = new Date().getFullYear();
let currentOpMonth = new Date().getMonth(); // 0-indexed

// Dynamic Date Management (Machine)
let currentMachineYear = new Date().getFullYear();
let currentMachineMonth = new Date().getMonth(); // 0-indexed

// Auto-calculation logic exposed to global scope
window.calcOpTotal = (time) => {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el && el.value ? parseInt(el.value) : 0;
    };

    const p4 = getVal(`in_4p_${time}`);
    const p1 = getVal(`in_1p_${time}`);
    const s20 = getVal(`in_20s_${time}`);

    const total = p4 + p1 + s20;
    const totalInput = document.getElementById(`in_today_target_${time}`);

    if (totalInput) {
        totalInput.value = total > 0 ? total : '';
    }
};

export function subscribeOperations() {
    const todayStr = getTodayDateString();
    const yesterdayStr = getYesterdayDateString();

    onSnapshot(doc(db, "operations_data", todayStr), (doc) => {
        todayOpData = doc.exists() ? doc.data() : {};
        renderOperationsBoard();
    });
    onSnapshot(doc(db, "operations_data", yesterdayStr), (doc) => {
        yesterdayOpData = doc.exists() ? doc.data() : {};
        renderOperationsBoard();
    });

    // Attach Event Listeners for Date Navigation (Once)
    const editBtn = $('#machine-edit-btn');
    // Removed old calBtn listener

    if(editBtn) editBtn.onclick = () => openMachineDetailsEdit(viewingMachineDate);

    // Operations Modal Listeners
    const opSaveBtn = $('#btn-save-op-data');
    const opCancelBtn = $('#btn-cancel-op-input');

    console.log("Attaching OP Listeners:", opSaveBtn, opCancelBtn); // DEBUG

    if(opSaveBtn) opSaveBtn.onclick = saveOpData;
    if(opCancelBtn) opCancelBtn.onclick = closeOpInput;
}

export function changeMachineViewDate(offset) {
    const d = new Date(viewingMachineDate);
    d.setDate(d.getDate() + offset);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    viewingMachineDate = `${y}-${m}-${day}`;

    updateMachineDateDisplay();
    loadMachineDetailsForDate(viewingMachineDate);
}

export function updateMachineDateDisplay() {
    // Deprecated date display update, removed nav interaction
}

export function renderOperationsBoard() {
    const container = $('#operationsBoardContainer');
    if (!container) return;

    // Ensure Date Nav is visible and updated on first load
    updateMachineDateDisplay();

    // Use default target as 0 since we removed the config
    const defaultTarget = { t15: 0, t19: 0 };

    const t = todayOpData || {};
    const y = yesterdayOpData || {}; // Yesterday's data

    // Targets & Actuals
    const expected15 = (t.target_total_15 !== undefined && t.target_total_15 !== null) ? t.target_total_15 : defaultTarget.t15;
    const daily15 = (t.today_target_total_15 !== undefined && t.today_target_total_15 !== null) ? t.today_target_total_15 : null;
    const effTarget15 = daily15 !== null ? daily15 : expected15;

    const expected19 = (t.target_total_19 !== undefined && t.target_total_19 !== null) ? t.target_total_19 : defaultTarget.t19;
    const daily19 = (t.today_target_total_19 !== undefined && t.today_target_total_19 !== null) ? t.today_target_total_19 : null;
    const effTarget19 = daily19 !== null ? daily19 : expected19;

    // Logic Update: Prioritize "today_target_total_XX" (Actual Input) > "actual_total_XX" (Calculated/Saved)
    const calcTotal = (d, time) => {
        if (!d) return null;
        if (d[`today_target_total_${time}`] !== undefined && d[`today_target_total_${time}`] !== null && d[`today_target_total_${time}`] !== "") {
            return parseInt(d[`today_target_total_${time}`]);
        }
        if (d[`actual_total_${time}`]) return d[`actual_total_${time}`];
        const p4 = parseInt(d[`actual_4p_${time}`]) || 0;
        const p1 = parseInt(d[`actual_1p_${time}`]) || 0;
        const s20 = parseInt(d[`actual_20s_${time}`]) || 0;
        return (p4 + p1 + s20) > 0 ? (p4 + p1 + s20) : null;
    };

    const today15 = calcTotal(t, '15');
    const today19 = calcTotal(t, '19');
    const yester15 = calcTotal(y, '15');
    const yester19 = calcTotal(y, '19');

    const is19Reached = effTarget19 > 0 && today19 !== null && today19 >= effTarget19;
    const is15Reached = effTarget15 > 0 && today15 !== null && today15 >= effTarget15;

    // --- MOBILE LAYOUT (Smart Display) ---
    const mobileHtml = `
    <div class="md:hidden bg-white rounded-3xl border border-slate-100 shadow-lg shadow-indigo-900/5 p-4 sm:p-6 w-full flex flex-col items-center justify-between gap-6 relative overflow-hidden">
        <!-- Header / Actions -->
        <div class="w-full flex justify-end mb-4 gap-2">
             <button id="btn-monthly-cal-mobile" class="bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span>月間推移</span>
            </button>
            <button id="btn-op-input-mobile" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-indigo-200">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                <span>入力</span>
            </button>
        </div>

        <div class="w-full grid grid-cols-2 gap-4 items-end">
            <!-- 1. Yesterday 15:00 -->
            <div class="relative pl-3 border-l-4 border-slate-200">
                <p class="text-[10px] font-bold text-slate-400 mb-1">昨日実績 (15時)</p>
                <div class="flex items-baseline gap-1">
                    <span class="text-xl font-black text-slate-500">${yester15 !== null ? yester15 : '-'}</span>
                    <span class="text-xs font-bold text-slate-400">名</span>
                </div>
            </div>

            <!-- 2. Yesterday 19:00 -->
            <div class="relative pl-3 border-l-4 border-slate-200">
                <p class="text-[10px] font-bold text-slate-400 mb-1">昨日実績 (19時)</p>
                <div class="flex items-baseline gap-1">
                    <span class="text-xl font-black text-slate-600">${yester19 !== null ? yester19 : '-'}</span>
                    <span class="text-xs font-bold text-slate-400">名</span>
                </div>
            </div>

            <!-- 3. Today Target -->
            <div class="relative pl-3 border-l-4 border-indigo-200">
                <p class="text-[10px] font-bold text-indigo-400 mb-1">目標稼働 (19時)</p>
                <div class="flex items-baseline gap-1">
                    <span class="text-2xl font-black text-indigo-900">${effTarget19}</span>
                    <span class="text-xs font-bold text-indigo-300">名</span>
                </div>
            </div>

            <!-- 4. Today 15:00 -->
            <div class="relative pl-3 border-l-4 border-slate-200">
                <p class="text-[10px] font-bold text-slate-400 mb-1">本日 15:00</p>
                <div class="flex items-baseline gap-1">
                    <span class="text-2xl font-black ${is15Reached ? 'text-yellow-500' : 'text-slate-700'}">${today15 !== null ? today15 : '-'}</span>
                    <span class="text-xs font-bold text-slate-400">/ ${effTarget15}</span>
                    ${is15Reached ? '<span class="text-sm ml-1">👑</span>' : ''}
                </div>
            </div>

            <!-- 5. Today 19:00 (Main) -->
            <div class="col-span-2">
                 <div class="flex justify-between items-end mb-1">
                    <p class="text-[10px] font-bold text-slate-400">本日 19:00</p>
                </div>
                <div class="flex items-baseline gap-1 mb-2">
                    <span class="text-4xl font-black ${is19Reached ? 'text-yellow-500' : 'text-slate-800'} tracking-tight leading-none">${today19 !== null ? today19 : '-'}</span>
                    <span class="text-sm font-bold text-slate-400">/ ${effTarget19}</span>
                    ${is19Reached ? '<span class="text-2xl ml-2">👑</span>' : ''}
                </div>
            </div>
        </div>
    </div>
    `;

    // --- PC LAYOUT (Smart Display) ---
    const pcHtml = `
    <div class="hidden md:flex w-full bg-white rounded-3xl border border-slate-100 shadow-lg shadow-indigo-900/5 overflow-hidden min-h-[160px]">
        <!-- Zone A: Yesterday -->
        <div class="w-[25%] bg-slate-50 border-r border-slate-100 p-6 flex flex-col justify-center gap-4">
            <div>
                <span class="text-[10px] font-bold text-slate-400 block mb-1">昨日 15:00</span>
                <span class="text-2xl font-black text-slate-500">${yester15 !== null ? yester15 : '-'} <span class="text-xs font-bold text-slate-400">名</span></span>
            </div>
            <div>
                <span class="text-[10px] font-bold text-slate-400 block mb-1">昨日 19:00</span>
                <span class="text-2xl font-black text-slate-600">${yester19 !== null ? yester19 : '-'} <span class="text-xs font-bold text-slate-400">名</span></span>
            </div>
        </div>

        <!-- Zone B: Today Target -->
        <div id="zone-target-pc" class="w-[25%] bg-indigo-50 border-r border-indigo-100 p-4 flex flex-col justify-center items-center relative group cursor-pointer hover:bg-indigo-100 transition">
             <p class="text-[10px] font-bold text-indigo-400 mb-2 uppercase tracking-widest">Today's Goal</p>
             <div class="flex items-baseline gap-1">
                <span class="text-5xl font-black text-indigo-900 tracking-tight">${effTarget19}</span>
                <span class="text-sm font-bold text-indigo-400">名</span>
             </div>
             <p class="text-[10px] font-bold text-indigo-300 mt-2">目標 (19:00)</p>
             <span class="absolute bottom-3 right-3 text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition font-bold">Click to Edit ✎</span>
        </div>

        <!-- Zone C: Progress (Simplified) -->
        <div class="w-[50%] bg-white p-6 flex flex-col justify-between relative">
            <!-- Header: Actions -->
            <div class="absolute top-4 right-4 flex gap-2">
                 <button id="btn-monthly-cal-pc" class="bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    <span>月間推移</span>
                </button>
                <button id="btn-op-input-pc" class="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-indigo-200">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <span>入力</span>
                </button>
            </div>

            <!-- Stats Row -->
            <div class="flex items-end gap-10 mt-2 h-full justify-start">
                <div>
                    <p class="text-[10px] font-bold text-slate-400 mb-1">現在 (19:00)</p>
                    <div class="flex items-baseline gap-1">
                        <span class="text-4xl font-black ${is19Reached ? 'text-yellow-500' : 'text-slate-800'} leading-none">${today19 !== null ? today19 : '-'}</span>
                        <span class="text-sm font-bold text-slate-400">/ ${effTarget19}</span>
                        ${is19Reached ? '<span class="text-2xl ml-2">👑</span>' : ''}
                    </div>
                </div>
                 <div>
                    <p class="text-[10px] font-bold text-slate-400 mb-1">15:00時点</p>
                     <div class="flex items-baseline gap-1">
                        <span class="text-2xl font-black ${is15Reached ? 'text-yellow-500' : 'text-slate-600'} leading-none">${today15 !== null ? today15 : '-'}</span>
                        <span class="text-xs font-bold text-slate-400">/ ${effTarget15}</span>
                        ${is15Reached ? '<span class="text-lg ml-1">👑</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    container.innerHTML = mobileHtml + pcHtml;

    // --- IMPORT BUTTON (Mobile) ---
    const importBtnMobile = `
        <button onclick="document.getElementById('op-import-file').click()" class="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <span>AI取込</span>
        </button>
    `;

    // --- IMPORT BUTTON (PC) ---
    const importBtnPC = `
        <button onclick="document.getElementById('op-import-file').click()" class="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm">
             <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
             <span>AI取込</span>
        </button>
    `;

    // Inject Import Buttons
    // Mobile: Add to header actions
    const mobileHeaderActions = container.querySelector('.md\\:hidden .flex.justify-end');
    if (mobileHeaderActions) {
         const div = document.createElement('div');
         div.innerHTML = importBtnMobile;
         mobileHeaderActions.insertBefore(div.firstElementChild, mobileHeaderActions.firstElementChild);
    }

    // PC: Add to header actions
    const pcHeaderActions = container.querySelector('.hidden.md\\:flex .absolute.top-4.right-4');
    if (pcHeaderActions) {
         const div = document.createElement('div');
         div.innerHTML = importBtnPC;
         pcHeaderActions.insertBefore(div.firstElementChild, pcHeaderActions.firstElementChild);
    }

    // Hidden File Input for Import
    if (!document.getElementById('op-import-file')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'op-import-file';
        input.accept = '.pdf, .xlsx, .xls';
        input.className = 'hidden';
        input.onchange = handleOpImportFile;
        document.body.appendChild(input);
    }

    // Attach Listeners (Mobile)
    const btnMonthlyMobile = container.querySelector('#btn-monthly-cal-mobile');
    if (btnMonthlyMobile) btnMonthlyMobile.onclick = (e) => { e.stopPropagation(); openMonthlyCalendar(); };

    const btnInputMobile = container.querySelector('#btn-op-input-mobile');
    if (btnInputMobile) btnInputMobile.onclick = (e) => { e.stopPropagation(); openOpInput(); };

    // Attach Listeners (PC)
    const btnMonthlyPC = container.querySelector('#btn-monthly-cal-pc');
    if (btnMonthlyPC) btnMonthlyPC.onclick = (e) => { e.stopPropagation(); openMonthlyCalendar(); };

    const btnInputPC = container.querySelector('#btn-op-input-pc');
    if (btnInputPC) btnInputPC.onclick = (e) => { e.stopPropagation(); openOpInput(); };

    // Zone B click to open input
    const zoneTargetPC = container.querySelector('#zone-target-pc');
    if (zoneTargetPC) zoneTargetPC.onclick = (e) => { e.stopPropagation(); openOpInput(); };

    // Re-Inject Edit Button into Header if needed, but primarily relying on static HTML or initial bind
    // Ensuring the edit button works if re-rendered
    const editBtn = document.getElementById('machine-edit-btn');
    if(editBtn) editBtn.onclick = () => openMachineDetailsEdit(viewingMachineDate);

    loadMachineDetailsForDate(viewingMachineDate);
}

async function loadMachineDetailsForDate(dateStr) {
    try {
        renderMachineDetails([], true);

        let details = [];
        let data = null;

        // 1. Try to get data from cache or fetch
        if (dateStr === getTodayDateString() && todayOpData) {
            data = todayOpData;
        } else if (dateStr === getYesterdayDateString() && yesterdayOpData) {
            data = yesterdayOpData;
        } else {
            const docRef = doc(db, "operations_data", dateStr);
            const snapshot = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(mod => mod.getDoc(docRef));
            if (snapshot.exists()) data = snapshot.data();
        }

        if (data && data.machine_details && data.machine_details.length > 0) {
            // Found direct data
            details = data.machine_details;
        } else {
            // 2. Not found, search backwards
            const prevDetails = await findLatestMachineConfig(dateStr);
            if (prevDetails && prevDetails.length > 0) {
                 const currentDateObj = new Date(dateStr);
                 currentDateObj.setHours(0,0,0,0);

                 // Filter by date validity
                 details = prevDetails.filter(item => {
                    // If no end date is set, it remains valid indefinitely (or until replaced)
                    if (!item.display_end_date) return true;

                    const endDateObj = new Date(item.display_end_date);
                    endDateObj.setHours(0,0,0,0);
                    return currentDateObj <= endDateObj;
                 });
            }
        }

        renderMachineDetails(details || []);

    } catch (e) {
        console.error("Error fetching machine details:", e);
        renderMachineDetails([]);
    }
}

async function findLatestMachineConfig(targetDate) {
    const d = new Date(targetDate);

    for (let i = 1; i <= 7; i++) {
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const searchDate = `${y}-${m}-${day}`;

        if (searchDate === getTodayDateString() && todayOpData && todayOpData.machine_details && todayOpData.machine_details.length > 0) {
            return todayOpData.machine_details;
        }
        if (searchDate === getYesterdayDateString() && yesterdayOpData && yesterdayOpData.machine_details && yesterdayOpData.machine_details.length > 0) {
             return yesterdayOpData.machine_details;
        }

        try {
            const docRef = doc(db, "operations_data", searchDate);
            const snapshot = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(mod => mod.getDoc(docRef));
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.machine_details && data.machine_details.length > 0) {
                    return data.machine_details;
                }
            }
        } catch (e) {
            console.warn("Error searching past config:", e);
        }
    }
    return null;
}

function renderMachineDetails(details, isLoading = false) {
    const container = $('#machine-details-container');
    if (!container) return;

    if (isLoading) {
        container.classList.remove('hidden');
        container.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10 font-bold animate-pulse">データ読み込み中...</p>';
        return;
    }

    if (!details || details.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10 font-bold">データがありません</p>';
        container.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');

    const fragment = document.createDocumentFragment();

    details.forEach(item => {
        const target = item.target ? parseInt(item.target) : 0;
        const actual = item.actual ? parseInt(item.actual) : 0;
        const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
        const isAchieved = target > 0 && actual >= target;

        const barColor = isAchieved ? 'bg-amber-400' : 'bg-indigo-500';
        const cardBorder = isAchieved ? 'border-amber-200' : 'border-slate-100';
        const icon = isAchieved ? '👑' : '📊';

        const card = document.createElement('div');
        card.className = `bg-white rounded-2xl border ${cardBorder} shadow-sm p-4 flex flex-col justify-between`;

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h4 class="font-bold text-slate-700 truncate max-w-[70%] text-sm machine-title"></h4>
                <span class="text-xs font-bold ${isAchieved ? 'text-amber-500' : 'text-slate-400'}">${icon}</span>
            </div>

            <div class="flex justify-between items-end mb-1">
                <span class="text-xs font-bold text-slate-400">Target: ${target}</span>
                <div class="text-right">
                    <span class="text-xl font-black ${isAchieved ? 'text-amber-500' : 'text-slate-800'}">${actual}</span>
                    <span class="text-[10px] text-slate-400">/ ${target}台</span>
                </div>
            </div>

            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="${barColor} h-full rounded-full" style="width: ${Math.min(rate, 100)}%"></div>
            </div>
        `;

        const titleEl = card.querySelector('.machine-title');
        titleEl.textContent = item.name;
        titleEl.title = item.name;

        fragment.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

export function changeOpMonth(offset) {
    currentOpMonth += offset;
    if (currentOpMonth > 11) {
        currentOpMonth = 0;
        currentOpYear++;
    } else if (currentOpMonth < 0) {
        currentOpMonth = 11;
        currentOpYear--;
    }
    renderCalendarGrid();
}

export async function openMonthlyCalendar() {
    const modal = $('#calendar-modal');
    if (!modal) { alert("カレンダー画面が見つかりません"); return; }
    modal.classList.remove('hidden');
    returnToCalendar = false;

    renderCalendarGrid();

    const container = $('#calendar-grid-body');
    if (container) container.innerHTML = '<p class="text-center py-10 text-slate-400">データ読込中...</p>';

    try {
        const snapshot = await getDocs(collection(db, "operations_data"));
        monthlyOpData = {};
        snapshot.forEach(doc => {
            monthlyOpData[doc.id] = doc.data();
        });
        renderCalendarGrid();
    } catch (e) {
        alert("データ読込に失敗しました: " + e.message);
    }
}

export function closeMonthlyCalendar() {
    $('#calendar-modal').classList.add('hidden');
}

function renderCalendarGrid() {
    const container = $('#calendar-grid-body');
    if (!container) return;
    container.innerHTML = '';

    const headerContainer = $('#calendar-modal h3');
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div class="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">📅 稼働実績カレンダー</span>
                </div>

                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button id="op-prev-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">◀</button>
                        <span class="text-sm font-black text-slate-700 px-2 min-w-[90px] text-center">${currentOpYear}年${currentOpMonth + 1}月</span>
                        <button id="op-next-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">▶</button>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => {
            const prev = document.getElementById('op-prev-month');
            const next = document.getElementById('op-next-month');
            if (prev) prev.onclick = (e) => { e.stopPropagation(); changeOpMonth(-1); };
            if (next) next.onclick = (e) => { e.stopPropagation(); changeOpMonth(1); };
        }, 0);
    }


    const year = currentOpYear;
    const month = currentOpMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const headers = ['日','月','火','水','木','金','土'];
    let html = `<div class="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-slate-400">`;
    headers.forEach(h => html += `<div>${h}</div>`);
    html += `</div><div class="grid grid-cols-7 gap-1">`;

    const firstDay = new Date(year, month, 1).getDay();
    for(let i=0; i<firstDay; i++) {
        html += `<div></div>`;
    }

    const clickHandlers = [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const actual = monthlyOpData[dateStr] || {};

        const baseTarget = { t15:0, t19:0 };

        const exp15 = (actual.target_total_15 !== undefined && actual.target_total_15 !== null) ? actual.target_total_15 : baseTarget.t15;
        const effTarget15 = exp15;

        const exp19 = (actual.target_total_19 !== undefined && actual.target_total_19 !== null) ? actual.target_total_19 : baseTarget.t19;
        const effTarget19 = exp19;

        const act15 = actual.actual_total_15 || ((parseInt(actual.actual_4p_15)||0)+(parseInt(actual.actual_1p_15)||0)+(parseInt(actual.actual_20s_15)||0)) || 0;
        const act19 = actual.actual_total_19 || ((parseInt(actual.actual_4p_19)||0)+(parseInt(actual.actual_1p_19)||0)+(parseInt(actual.actual_20s_19)||0)) || 0;

        const is15Done = act15 >= effTarget15 && act15 > 0;
        const is19Done = act19 >= effTarget19 && act19 > 0;
        const bg15 = is15Done ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-50 text-slate-500';
        const bg19 = is19Done ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-50 text-slate-500';

        const divId = `cal-day-${d}`;

        html += `
        <div id="${divId}" class="cursor-pointer hover:bg-slate-50 hover:ring-2 ring-indigo-200 transition border border-slate-100 rounded-lg p-1 bg-white min-h-[80px] flex flex-col justify-between">
            <div class="text-[10px] font-black text-slate-300 text-center">${d}</div>
            <div class="flex flex-col gap-1">
                <div class="${bg15} rounded px-1 py-0.5 text-[9px] text-center">
                    <div class="font-bold">15時</div>
                    <div class="font-black text-[10px]">${act15 > 0 ? act15 : '-'}</div>
                    <div class="text-[8px] opacity-60">/${effTarget15}</div>
                </div>
                <div class="${bg19} rounded px-1 py-0.5 text-[9px] text-center">
                    <div class="font-bold">19時</div>
                    <div class="font-black text-[10px]">${act19 > 0 ? act19 : '-'}</div>
                    <div class="text-[8px] opacity-60">/${effTarget19}</div>
                </div>
            </div>
        </div>`;
        clickHandlers.push({ id: divId, date: dateStr });
    }
    html += `</div>`;
    container.innerHTML = html;

    clickHandlers.forEach(h => {
        const el = document.getElementById(h.id);
        if(el) el.onclick = () => openOpInput(h.date);
    });
}

export async function openOpInput(dateStr) {
    const calModal = $('#calendar-modal');
    if (calModal && !calModal.classList.contains('hidden')) {
        returnToCalendar = true;
        calModal.classList.add('hidden');
    } else {
        returnToCalendar = false;
    }

    // Fix: Ensure Machine Modal is hidden
    $('#machine-details-edit-modal').classList.add('hidden');

    if (!dateStr) {
        dateStr = viewingMachineDate || getTodayDateString();
    }
    editingOpDate = dateStr;

    if (viewingMachineDate !== dateStr) {
        viewingMachineDate = dateStr;
        updateMachineDateDisplay();
        loadMachineDetailsForDate(viewingMachineDate);
    }

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;
    document.querySelector('#operations-modal h3').innerHTML = `<span class="text-2xl">📝</span> ${displayDate} の稼働入力`;

    let data = {};

    if (dateStr === getTodayDateString() && todayOpData) data = todayOpData;
    else if (dateStr === getYesterdayDateString() && yesterdayOpData) data = yesterdayOpData;
    else if (monthlyOpData[dateStr]) data = monthlyOpData[dateStr];
    else {
         try {
            const docRef = doc(db, "operations_data", dateStr);
            const snapshot = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(mod => mod.getDoc(docRef));
            if (snapshot.exists()) data = snapshot.data();
        } catch(e) { console.error(e); }
    }

    const defaultTarget = { t15: 0, t19: 0 };

    const setVal = (id, val, def) => {
        const el = $(`#${id}`);
        if(el) el.value = (val !== undefined && val !== null) ? val : def;
    };

    setVal('in_target_15', data.target_total_15, defaultTarget.t15);
    setVal('in_today_target_15', data.today_target_total_15, '');
    setVal('in_4p_15', data.actual_4p_15, '');
    setVal('in_1p_15', data.actual_1p_15, '');
    setVal('in_20s_15', data.actual_20s_15, '');

    setVal('in_target_19', data.target_total_19, defaultTarget.t19);
    setVal('in_today_target_19', data.today_target_total_19, '');
    setVal('in_4p_19', data.actual_4p_19, '');
    setVal('in_1p_19', data.actual_1p_19, '');
    setVal('in_20s_19', data.actual_20s_19, '');

    $('#operations-modal').classList.remove('hidden');
}

export async function openMachineDetailsEdit(dateStr) {
    const machCalModal = $('#machine-calendar-modal');
    if (machCalModal && !machCalModal.classList.contains('hidden')) {
        returnToMachineCalendar = true;
        machCalModal.classList.add('hidden');
    } else {
        returnToMachineCalendar = false;
    }

    // Fix: Ensure Operations Modal is hidden
    $('#operations-modal').classList.add('hidden');

    if (!dateStr) dateStr = viewingMachineDate || getTodayDateString();
    editingOpDate = dateStr;

    if (viewingMachineDate !== dateStr) {
        viewingMachineDate = dateStr;
        updateMachineDateDisplay();
        loadMachineDetailsForDate(viewingMachineDate);
    }

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;
    document.querySelector('#machine-details-edit-modal h3').innerHTML = `<span class="text-2xl">🔥</span> ${displayDate} 注目の新台・重点機種`;

    let data = {};
    if (dateStr === getTodayDateString() && todayOpData) data = todayOpData;
    else if (dateStr === getYesterdayDateString() && yesterdayOpData) data = yesterdayOpData;
    else if (monthlyOpData[dateStr]) data = monthlyOpData[dateStr];
    else {
         try {
            const docRef = doc(db, "operations_data", dateStr);
            const snapshot = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js").then(mod => mod.getDoc(docRef));
            if (snapshot.exists()) data = snapshot.data();
        } catch(e) { console.error(e); }
    }

    const container = $('#machine-details-edit-container');
    container.innerHTML = '';

    let machineDetails = data.machine_details || [];

    if (machineDetails.length === 0) {
        const prevDetails = await findLatestMachineConfig(dateStr);
        if (prevDetails && prevDetails.length > 0) {
            const currentDateObj = new Date(dateStr);
            currentDateObj.setHours(0,0,0,0);

            machineDetails = prevDetails.filter(item => {
                if (!item.display_end_date) return false;
                const endDateObj = new Date(item.display_end_date);
                endDateObj.setHours(0,0,0,0);
                return currentDateObj <= endDateObj;
            }).map(item => ({
                name: item.name,
                target: item.target,
                display_end_date: item.display_end_date,
                actual: ''
            }));
        }
    }

    if (machineDetails.length > 0) {
        machineDetails.forEach(item => addMachineDetailRow(item.name, item.target, item.actual, item.display_end_date));
    } else {
        addMachineDetailRow();
    }

    const addBtn = $('#btn-add-machine-detail-new');
    if(addBtn) addBtn.onclick = () => addMachineDetailRow();

    const saveBtn = $('#btn-save-machine-details');
    if(saveBtn) saveBtn.onclick = saveMachineDetails;

    const cancelBtn = $('#btn-cancel-machine-details');
    if(cancelBtn) cancelBtn.onclick = closeMachineDetailsEdit;

    $('#machine-details-edit-modal').classList.remove('hidden');
}

export function closeMachineDetailsEdit() {
    $('#machine-details-edit-modal').classList.add('hidden');

    if (returnToMachineCalendar) {
        openMachineCalendar();
        returnToMachineCalendar = false;
    }
}

export function closeOpInput() {
    console.log("Closing OP Input"); // DEBUG
    const el = $('#operations-modal');
    console.log("Modal Element:", el);
    el.classList.add('hidden');
    console.log("Classes:", el.className);

    if (returnToCalendar) {
        openMonthlyCalendar();
        returnToCalendar = false;
    }
}

// --- Machine Calendar Logic ---

export function changeMachineMonth(offset) {
    currentMachineMonth += offset;
    if (currentMachineMonth > 11) {
        currentMachineMonth = 0;
        currentMachineYear++;
    } else if (currentMachineMonth < 0) {
        currentMachineMonth = 11;
        currentMachineYear--;
    }
    renderMachineCalendarGrid();
}

export async function openMachineCalendar() {
    const modal = $('#machine-calendar-modal');
    if (!modal) { alert("注目機種カレンダー画面が見つかりません"); return; }
    modal.classList.remove('hidden');
    returnToMachineCalendar = false;

    renderMachineCalendarGrid();

    const container = $('#machine-calendar-grid-body');
    if (container) container.innerHTML = '<p class="text-center py-10 text-slate-400">データ読込中...</p>';

    try {
        // Shared data source with Ops Calendar
        if (Object.keys(monthlyOpData).length === 0) {
            const snapshot = await getDocs(collection(db, "operations_data"));
            monthlyOpData = {};
            snapshot.forEach(doc => {
                monthlyOpData[doc.id] = doc.data();
            });
        }
        renderMachineCalendarGrid();
    } catch (e) {
        alert("データ読込に失敗しました: " + e.message);
    }

    const closeBtn = $('#btn-close-machine-calendar');
    if(closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
}

function renderMachineCalendarGrid() {
    const container = $('#machine-calendar-grid-body');
    if (!container) return;
    container.innerHTML = '';

    const year = currentMachineYear;
    const month = currentMachineMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const headerContainer = $('#machine-calendar-modal h3');
    if (headerContainer) {
         headerContainer.innerHTML = `
            <div class="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">📅 注目機種カレンダー</span>
                </div>
                <div class="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                    <button id="mach-prev-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">◀</button>
                    <span class="text-sm font-black text-slate-700 px-2 min-w-[90px] text-center">${year}年${month + 1}月</span>
                    <button id="mach-next-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">▶</button>
                </div>
            </div>
        `;
        setTimeout(() => {
            const prev = document.getElementById('mach-prev-month');
            const next = document.getElementById('mach-next-month');
            if (prev) prev.onclick = (e) => { e.stopPropagation(); changeMachineMonth(-1); };
            if (next) next.onclick = (e) => { e.stopPropagation(); changeMachineMonth(1); };
        }, 0);
    }

    const headers = ['日','月','火','水','木','金','土'];
    let html = `<div class="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-slate-400">`;
    headers.forEach(h => html += `<div>${h}</div>`);
    html += `</div><div class="grid grid-cols-7 gap-1">`;

    const firstDay = new Date(year, month, 1).getDay();
    for(let i=0; i<firstDay; i++) {
        html += `<div></div>`;
    }

    const clickHandlers = [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const data = monthlyOpData[dateStr] || {};
        const details = data.machine_details || [];
        const hasData = details.length > 0;

        let content = '';
        if(hasData) {
            // Display first 2 items
            const limit = 2;
            details.slice(0, limit).forEach(item => {
                 content += `<span class="block text-[9px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded mb-0.5 font-bold truncate">${item.name}</span>`;
            });
            if (details.length > limit) {
                content += `<span class="block text-[8px] text-slate-400 font-bold">+${details.length - limit}件</span>`;
            }
        } else {
             content = `<span class="text-[9px] text-slate-300">-</span>`;
        }

        const divId = `mach-cal-day-${d}`;
        html += `
        <div id="${divId}" class="cursor-pointer hover:bg-slate-50 hover:ring-2 ring-indigo-200 transition border border-slate-100 rounded-lg p-1 bg-white min-h-[80px] flex flex-col justify-start">
            <div class="text-[10px] font-black text-slate-300 mb-1">${d}</div>
            <div class="w-full overflow-hidden">
                ${content}
            </div>
        </div>`;
        clickHandlers.push({ id: divId, date: dateStr });
    }
    html += `</div>`;
    container.innerHTML = html;

    clickHandlers.forEach(h => {
        const el = document.getElementById(h.id);
        if(el) el.onclick = () => openMachineDetailsEdit(h.date);
    });
}

export async function saveMachineDetails() {
    const machineRows = document.querySelectorAll('#machine-details-edit-container .machine-detail-row');
    const machineDetails = [];
    machineRows.forEach(row => {
        const name = row.querySelector('.machine-name').value.trim();
        const target = row.querySelector('.machine-target').value;
        const actual = row.querySelector('.machine-actual').value;
        const endDate = row.querySelector('.machine-end-date').value;

        if (name) {
            machineDetails.push({
                name: name,
                target: target ? parseInt(target) : null,
                actual: actual ? parseInt(actual) : null,
                display_end_date: endDate || null
            });
        }
    });

    const targetDate = editingOpDate || getTodayDateString();
    try {
        await setDoc(doc(db, "operations_data", targetDate), { machine_details: machineDetails }, { merge: true });
        closeMachineDetailsEdit();
        showToast("機種情報を保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
}

function addMachineDetailRow(name = '', target = '', actual = '', endDate = '') {
    const container = $('#machine-details-edit-container');
    if (!container) return;

    const div = document.createElement('div');
    // Responsive Grid: 2 columns on mobile, 10 columns on desktop
    div.className = 'grid grid-cols-2 sm:grid-cols-10 gap-x-3 gap-y-3 sm:gap-2 items-start sm:items-center machine-detail-row border-b border-slate-100 pb-4 sm:pb-2 mb-2';

    div.innerHTML = `
        <!-- Name: Full width on mobile (2/2), 30% on PC (3/10) -->
        <div class="col-span-2 sm:col-span-3">
            <label class="block text-[10px] text-slate-400 font-bold mb-0.5">機種名</label>
            <input type="text" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 sm:py-1.5 text-xs font-bold focus:border-indigo-500 outline-none machine-name" placeholder="機種名">
        </div>

        <!-- Target: Half width on mobile (1/2), 20% on PC (2/10) -->
        <div class="col-span-1 sm:col-span-2">
            <label class="block text-[10px] text-slate-400 font-bold mb-0.5">目標</label>
            <input type="number" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 sm:py-1.5 text-xs font-bold focus:border-indigo-500 outline-none machine-target" placeholder="目標">
        </div>

        <!-- Actual: Half width on mobile (1/2), 20% on PC (2/10) -->
        <!-- Note: Moved up for better mobile layout flow (Target & Actual side-by-side) -->
        <div class="col-span-1 sm:col-span-2">
            <label class="block text-[10px] text-indigo-300 font-bold mb-0.5">実績</label>
            <input type="number" class="w-full bg-white border border-indigo-200 rounded px-2 py-2 sm:py-1.5 text-xs font-bold focus:border-indigo-500 outline-none machine-actual" placeholder="実績">
        </div>

        <!-- End Date: Full width on mobile (2/2), 30% on PC (3/10) -->
        <div class="col-span-2 sm:col-span-3 flex gap-1 items-end">
             <div class="flex-1">
                <label class="block text-[10px] text-slate-400 font-bold mb-0.5">表示終了日</label>
                <input type="date" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-2 sm:py-1.5 text-[10px] font-bold focus:border-indigo-500 outline-none machine-end-date">
             </div>
             <button class="text-rose-400 hover:text-rose-600 px-2 py-2 sm:py-1 h-[34px] sm:h-auto flex items-center justify-center bg-rose-50 sm:bg-transparent rounded-lg sm:rounded-none" onclick="this.parentElement.parentElement.remove()">
                <svg class="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span class="hidden sm:inline">✕</span>
             </button>
        </div>
    `;

    div.querySelector('.machine-name').value = name;
    div.querySelector('.machine-target').value = target;
    div.querySelector('.machine-actual').value = actual;
    div.querySelector('.machine-end-date').value = endDate;

    container.appendChild(div);
}

export async function saveOpData() {
    const getVal = (id) => { const v = $(`#${id}`).value; return v ? parseInt(v) : null; };
    const getNum = (id) => { const v = $(`#${id}`).value; return v ? parseInt(v) : 0; };

    const total15 = getNum('in_4p_15') + getNum('in_1p_15') + getNum('in_20s_15');
    const total19 = getNum('in_4p_19') + getNum('in_1p_19') + getNum('in_20s_19');

    const d = {
        target_total_15: getVal('in_target_15'),
        today_target_total_15: total15,
        actual_total_15: total15,
        actual_4p_15: getVal('in_4p_15'),
        actual_1p_15: getVal('in_1p_15'),
        actual_20s_15: getVal('in_20s_15'),

        target_total_19: getVal('in_target_19'),
        today_target_total_19: total19,
        actual_total_19: total19,
        actual_4p_19: getVal('in_4p_19'),
        actual_1p_19: getVal('in_1p_19'),
        actual_20s_19: getVal('in_20s_19'),
    };

    const targetDate = editingOpDate || getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        closeOpInput();
        showToast("全体実績を保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
}

async function handleOpImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = '';

    showToast("AI解析中...", 5000);

    try {
        const { text, images } = await parseFile(file);

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: text,
                contextImages: images ? images.slice(0, 5) : [],
                mode: 'extraction'
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        let jsonStr = data.reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const targets = JSON.parse(jsonStr);

        const targetMonthPrefix = `${currentOpYear}-${String(currentOpMonth + 1).padStart(2, '0')}`;
        const filteredTargets = Object.entries(targets).filter(([date, val]) => {
            return date.startsWith(targetMonthPrefix);
        });

        const count = filteredTargets.length;
        if (count === 0) {
            alert(`表示中の月 (${currentOpYear}年${currentOpMonth + 1}月) の目標値が見つかりませんでした。\nファイル内の日付とカレンダーの表示月を確認してください。`);
            return;
        }

        if (confirm(`${currentOpYear}年${currentOpMonth + 1}月のデータ ${count}日分を検出しました。\n一括登録しますか？`)) {
            const batch = writeBatch(db);

            filteredTargets.forEach(([date, val]) => {
                const updateData = {};
                if (val.t19 !== undefined) updateData.target_total_19 = val.t19;
                if (val.t15 !== undefined) updateData.target_total_15 = val.t15;

                if (Object.keys(updateData).length > 0) {
                    const ref = doc(db, "operations_data", date);
                    batch.set(ref, updateData, { merge: true });
                }
            });

            await batch.commit();
            showToast(`${count}件の目標を更新しました！`);
            if (!$('#calendar-modal').classList.contains('hidden')) {
                openMonthlyCalendar();
            }
        }

    } catch (err) {
        console.error(err);
        alert("AI解析エラー: " + err.message);
    }
}
