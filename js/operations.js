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

// Dynamic Date Management
let currentOpYear = new Date().getFullYear();
let currentOpMonth = new Date().getMonth(); // 0-indexed

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
}

export function renderOperationsBoard() {
    const container = $('#operationsBoardContainer');
    if (!container) return;

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
    // The field `today_target_total_XX` was previously used as "Daily Target" but is now "Confirmed Actual".
    const calcTotal = (d, time) => {
        if (!d) return null;
        // If "Actual Input" (formerly daily target) exists, use it as the definitive actual.
        if (d[`today_target_total_${time}`] !== undefined && d[`today_target_total_${time}`] !== null && d[`today_target_total_${time}`] !== "") {
            return parseInt(d[`today_target_total_${time}`]);
        }
        // Fallback to breakdowns
        if (d[`actual_total_${time}`]) return d[`actual_total_${time}`];
        const p4 = parseInt(d[`actual_4p_${time}`]) || 0;
        const p1 = parseInt(d[`actual_1p_${time}`]) || 0;
        const s20 = parseInt(d[`actual_20s_${time}`]) || 0;
        return (p4 + p1 + s20) > 0 ? (p4 + p1 + s20) : null;
    };

    const today15 = calcTotal(t, '15');
    const today19 = calcTotal(t, '19');
    const yester15 = calcTotal(y, '15'); // Yesterday 15:00
    const yester19 = calcTotal(y, '19'); // Yesterday 19:00

    // Logic Update: Smart Display - Check if target reached (Target > 0 and Actual >= Target)
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

    // Reset to current month on open if desired, or keep last viewed
    // currentOpYear = new Date().getFullYear();
    // currentOpMonth = new Date().getMonth();

    renderCalendarGrid(); // Render skeletal grid first with current selection

    // Refresh data
    const container = $('#calendar-grid-body');
    if (container) container.innerHTML = '<p class="text-center py-10 text-slate-400">データ読込中...</p>';

    try {
        // Optimization: Fetch all for now as per original code, or refine later.
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

    // Update Header with Month Navigation
    const headerContainer = $('#calendar-modal h3');
    if (headerContainer) {
        headerContainer.innerHTML = `
            <div class="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
                <div class="flex items-center gap-2">
                    <span class="text-lg">📅 稼働実績カレンダー</span>
                </div>

                <div class="flex items-center gap-2">
                    <!-- Navigation -->
                    <div class="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                        <button id="op-prev-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">◀</button>
                        <span class="text-sm font-black text-slate-700 px-2 min-w-[90px] text-center">${currentOpYear}年${currentOpMonth + 1}月</span>
                        <button id="op-next-month" class="px-3 py-1 text-slate-400 hover:text-indigo-600 transition font-bold">▶</button>
                    </div>
                </div>
            </div>
        `;
        // Re-attach listeners
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

    // Helper to add listener after html injection
    const clickHandlers = [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        // Fallback or data from DB
        const actual = monthlyOpData[dateStr] || {};

        // Removed TARGET_DATA_DEC logic
        const baseTarget = { t15:0, t19:0 };

        // Determine effective target
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

    // Attach listeners
    clickHandlers.forEach(h => {
        const el = document.getElementById(h.id);
        if(el) el.onclick = () => openOpInput(h.date);
    });
}

export function openOpInput(dateStr) {
    const calModal = $('#calendar-modal');
    if (calModal && !calModal.classList.contains('hidden')) {
        returnToCalendar = true;
        calModal.classList.add('hidden');
    } else {
        returnToCalendar = false;
    }

    if (!dateStr) dateStr = getTodayDateString();
    editingOpDate = dateStr;

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;
    document.querySelector('#operations-modal h3').innerHTML = `<span class="text-2xl">📝</span> ${displayDate} の稼働入力`;

    let data = {};
    if (dateStr === getTodayDateString()) data = todayOpData || {};
    else if (dateStr === getYesterdayDateString()) data = yesterdayOpData || {};
    else data = monthlyOpData[dateStr] || {};

    const dayNum = parseInt(d);
    // Removed TARGET_DATA_DEC support
    const defaultTarget = { t15: 0, t19: 0 };

    const setVal = (id, val, def) => $(`#${id}`).value = (val !== undefined && val !== null) ? val : def;

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

export function closeOpInput() {
    $('#operations-modal').classList.add('hidden');

    if (returnToCalendar) {
        openMonthlyCalendar();
        returnToCalendar = false;
    }
}

export async function saveOpData() {
    const getVal = (id) => { const v = $(`#${id}`).value; return v ? parseInt(v) : null; };
    const getNum = (id) => { const v = $(`#${id}`).value; return v ? parseInt(v) : 0; };

    // Calculate sums forcibly from breakdown
    const total15 = getNum('in_4p_15') + getNum('in_1p_15') + getNum('in_20s_15');
    const total19 = getNum('in_4p_19') + getNum('in_1p_19') + getNum('in_20s_19');

    const d = {
        target_total_15: getVal('in_target_15'),
        today_target_total_15: total15, // Force overwrite with calculated sum
        actual_total_15: total15,       // Force overwrite with calculated sum
        actual_4p_15: getVal('in_4p_15'),
        actual_1p_15: getVal('in_1p_15'),
        actual_20s_15: getVal('in_20s_15'),

        target_total_19: getVal('in_target_19'),
        today_target_total_19: total19, // Force overwrite with calculated sum
        actual_total_19: total19,       // Force overwrite with calculated sum
        actual_4p_19: getVal('in_4p_19'),
        actual_1p_19: getVal('in_1p_19'),
        actual_20s_19: getVal('in_20s_19'),
    };

    const targetDate = editingOpDate || getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        closeOpInput();
        showToast("保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
}

async function handleOpImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    showToast("AI解析中...", 5000);

    try {
        const { text, images } = await parseFile(file);

        // Send to Gemini
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

        // Clean JSON (remove potential markdown code blocks)
        let jsonStr = data.reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const targets = JSON.parse(jsonStr);

        // Filter by currently viewed month (currentOpYear, currentOpMonth)
        // Note: currentOpMonth is 0-indexed (0=Jan, 11=Dec)
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
            // Batch Write
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
            // Refresh calendar if open
            if (!$('#calendar-modal').classList.contains('hidden')) {
                openMonthlyCalendar();
            }
        }

    } catch (err) {
        console.error(err);
        alert("AI解析エラー: " + err.message);
    }
}
