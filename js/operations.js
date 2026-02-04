import { db } from './firebase.js';
import { collection, doc, onSnapshot, getDocs, setDoc, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
let importTargetType = null; // '15' or '19'

// Dynamic Date Management (Machine)
let currentMachineYear = new Date().getFullYear();
let currentMachineMonth = new Date().getMonth(); // 0-indexed

// Auto-calculation logic
export const calcOpTotal = (time) => {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el && el.value ? parseInt(el.value) : 0;
    };

    const p4 = getVal(`in_4p_${time}`);
    const p1 = getVal(`in_1p_${time}`);
    const s20 = getVal(`in_20s_${time}`);

    const total = p4 + p1 + s20;
    const totalInput = document.getElementById(`in_actual_total_${time}`);

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
    const calBtn = $('#machine-calendar-btn');

    if(editBtn) editBtn.onclick = () => openMachineDetailsEdit(viewingMachineDate);
    if(calBtn) calBtn.onclick = openMachineCalendar;

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

    const t = todayOpData || {};
    const y = yesterdayOpData || {};

    // 全体目標・実績の取得ロジック（修正）
    const calcTotal = (d, time) => {
        if (!d) return null;
        // 実績を優先して取得
        if (d[`actual_total_${time}`]) return parseInt(d[`actual_total_${time}`]);

        // 内訳から計算
        const p4 = parseInt(d[`actual_4p_${time}`]) || 0;
        const p1 = parseInt(d[`actual_1p_${time}`]) || 0;
        const s20 = parseInt(d[`actual_20s_${time}`]) || 0;
        const sum = p4 + p1 + s20;
        return sum > 0 ? sum : null;
    };

    const today15 = calcTotal(t, '15');
    const today19 = calcTotal(t, '19');
    const yester15 = calcTotal(y, '15');
    const yester19 = calcTotal(y, '19');

    const target15 = t.today_target_total_15 || t.target_total_15 || 0;
    const target19 = t.today_target_total_19 || t.target_total_19 || 0;

    const is19Reached = target19 > 0 && today19 !== null && today19 >= target19;
    const is15Reached = target15 > 0 && today15 !== null && today15 >= target15;

    // --- 内訳表示用ヘルパー関数 ---
    const renderBreakdown = (time) => {
        const p4 = t[`actual_4p_${time}`] || 0;
        const p1 = t[`actual_1p_${time}`] || 0;
        const s20 = t[`actual_20s_${time}`] || 0;

        const tp4 = t[`target_4p_${time}`]; // 目標
        const tp1 = t[`target_1p_${time}`];
        const ts20 = t[`target_20s_${time}`];

        // 目標がどれか一つでも設定されていれば詳細表示モード
        if (!tp4 && !tp1 && !ts20) return '';

        const item = (label, act, tgt) => {
            const isDone = tgt && act >= tgt;
            const style = isDone ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200';
            return `
                <div class="flex flex-col items-center justify-center p-1.5 rounded-lg border ${style} flex-1">
                    <span class="text-[9px] font-bold opacity-70">${label}</span>
                    <div class="flex items-baseline gap-0.5">
                        <span class="text-xs font-black">${act}</span>
                        ${tgt ? `<span class="text-[9px] opacity-60">/${tgt}</span>` : ''}
                    </div>
                </div>
            `;
        };

        return `
            <div class="flex gap-2 w-full mt-3">
                ${item('4円P', p4, tp4)}
                ${item('1円P', p1, tp1)}
                ${item('20円S', s20, ts20)}
            </div>
        `;
    };

    // --- HTML生成 (Mobile & PC 共通化してシンプルに) ---
    const html = `
    <div class="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-indigo-900/5 overflow-hidden">
        <div class="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">

            <div class="flex-1 p-4 sm:p-6">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-400">🕒 15:00 稼働</span>
                    ${is15Reached ? '<span class="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">達成!</span>' : ''}
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-4xl font-black ${is15Reached ? 'text-amber-500' : 'text-slate-700'}">${today15 !== null ? today15 : '-'}</span>
                    <span class="text-sm font-bold text-slate-400">/ ${target15}</span>
                </div>
                ${renderBreakdown('15')}
            </div>

            <div class="flex-1 p-4 sm:p-6 bg-indigo-50/30">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-indigo-400">🌙 19:00 稼働</span>
                    ${is19Reached ? '<span class="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Target Clear!</span>' : ''}
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-5xl font-black ${is19Reached ? 'text-indigo-600' : 'text-slate-800'} tracking-tight">${today19 !== null ? today19 : '-'}</span>
                    <span class="text-lg font-bold text-slate-400">/ ${target19}</span>
                </div>
                ${renderBreakdown('19')}
            </div>
        </div>

        <div class="bg-slate-50 p-3 flex justify-end gap-2 border-t border-slate-100">
             <button id="btn-monthly-cal" class="bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">
                📅 月間推移
            </button>
            <button id="btn-op-input" class="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-200 flex items-center gap-1">
                ✏️ 入力
            </button>
        </div>
    </div>
    `;

    container.innerHTML = html;

    // イベントリスナー設定
    const btnCal = document.getElementById('btn-monthly-cal');
    if (btnCal) btnCal.onclick = (e) => { e.stopPropagation(); openMonthlyCalendar(); };
    const btnInput = document.getElementById('btn-op-input');
    if (btnInput) btnInput.onclick = (e) => { e.stopPropagation(); openOpInput(); };
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
                    <button id="btn-ai-import-menu" class="ml-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-200">
                        <span>🤖</span> AI読込
                    </button>
                    <input type="file" id="op-import-file-input" accept="image/*, .pdf, .xlsx, .xls" class="hidden">
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

            const btnAi = document.getElementById('btn-ai-import-menu');
            if (btnAi) btnAi.onclick = (e) => { e.stopPropagation(); showImportSelectModal(); };

            const fileInput = document.getElementById('op-import-file-input');
            if (fileInput) fileInput.onchange = handleOpImportFile;
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

    if (!dateStr) { dateStr = getTodayDateString(); }
    editingOpDate = dateStr;

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;

    // モーダルのタイトル更新 (要素が存在することを確認)
    const modalTitle = document.querySelector('#operations-modal h3');
    if(modalTitle) modalTitle.innerHTML = `<span class="text-2xl">📝</span> ${displayDate} の稼働入力`;

    let data = {};
    if (dateStr === getTodayDateString() && todayOpData) data = todayOpData;
    else if (dateStr === getYesterdayDateString() && yesterdayOpData) data = yesterdayOpData;
    else if (monthlyOpData[dateStr]) data = monthlyOpData[dateStr];
    else {
         try {
            const docRef = doc(db, "operations_data", dateStr);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) data = snapshot.data();
        } catch(e) { console.error(e); }
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    // 既存項目
    setVal('in_today_target_15', data.today_target_total_15 || data.target_total_15);
    setVal('in_actual_total_15', data.actual_total_15);
    setVal('in_4p_15', data.actual_4p_15);
    setVal('in_1p_15', data.actual_1p_15);
    setVal('in_20s_15', data.actual_20s_15);

    setVal('in_today_target_19', data.today_target_total_19 || data.target_total_19);
    setVal('in_actual_total_19', data.actual_total_19);
    setVal('in_4p_19', data.actual_4p_19);
    setVal('in_1p_19', data.actual_1p_19);
    setVal('in_20s_19', data.actual_20s_19);

    // ★追加: 内訳目標
    setVal('in_target_4p_15', data.target_4p_15);
    setVal('in_target_1p_15', data.target_1p_15);
    setVal('in_target_20s_15', data.target_20s_15);

    setVal('in_target_4p_19', data.target_4p_19);
    setVal('in_target_1p_19', data.target_1p_19);
    setVal('in_target_20s_19', data.target_20s_19);

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
    const getVal = (id) => { const el = document.getElementById(id); return (el && el.value) ? parseInt(el.value) : null; };
    const getNum = (id) => { const el = document.getElementById(id); return (el && el.value) ? parseInt(el.value) : 0; };

    const total15 = getNum('in_4p_15') + getNum('in_1p_15') + getNum('in_20s_15');
    const total19 = getNum('in_4p_19') + getNum('in_1p_19') + getNum('in_20s_19');

    const d = {
        // 15時データ
        today_target_total_15: getVal('in_today_target_15'),
        actual_total_15: total15,
        actual_4p_15: getVal('in_4p_15'),
        actual_1p_15: getVal('in_1p_15'),
        actual_20s_15: getVal('in_20s_15'),
        // ★追加: 15時内訳目標
        target_4p_15: getVal('in_target_4p_15'),
        target_1p_15: getVal('in_target_1p_15'),
        target_20s_15: getVal('in_target_20s_15'),

        // 19時データ
        today_target_total_19: getVal('in_today_target_19'),
        actual_total_19: total19,
        actual_4p_19: getVal('in_4p_19'),
        actual_1p_19: getVal('in_1p_19'),
        actual_20s_19: getVal('in_20s_19'),
        // ★追加: 19時内訳目標
        target_4p_19: getVal('in_target_4p_19'),
        target_1p_19: getVal('in_target_1p_19'),
        target_20s_19: getVal('in_target_20s_19'),
    };

    const targetDate = editingOpDate || getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        closeOpInput();
        showToast("稼働実績を保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
}

function showImportSelectModal() {
    if (document.getElementById('import-select-modal')) {
        document.getElementById('import-select-modal').classList.remove('hidden');
        return;
    }

    const html = `
    <div id="import-select-modal" class="modal-overlay" style="z-index: 200;">
        <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col">
            <h3 class="font-bold text-slate-800 text-lg mb-4">読み込むデータを選択</h3>
            <div class="flex flex-col gap-3 mb-6">
                <button id="btn-import-15" class="py-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition flex flex-col items-center gap-1">
                    <span class="text-xl">🕒 15時 (全体目標)</span>
                    <span class="text-xs opacity-70">午後3時の店舗全体稼働目標</span>
                </button>
                <button id="btn-import-19" class="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl transition flex flex-col items-center gap-1">
                    <span class="text-xl">🌙 19時 (全体目標)</span>
                    <span class="text-xs opacity-70">午後7時の店舗全体稼働目標</span>
                </button>
            </div>
            <button id="btn-import-cancel" class="py-3 text-slate-400 font-bold rounded-xl hover:bg-slate-50 transition">キャンセル</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    const closeModal = () => document.getElementById('import-select-modal').classList.add('hidden');

    document.getElementById('btn-import-cancel').onclick = closeModal;

    document.getElementById('btn-import-15').onclick = () => {
        importTargetType = '15';
        closeModal();
        $('#op-import-file-input').click();
    };

    document.getElementById('btn-import-19').onclick = () => {
        importTargetType = '19';
        closeModal();
        $('#op-import-file-input').click();
    };
}

async function handleOpImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = ''; // Reset input

    if (!importTargetType) {
        alert("読込モードが選択されていません。");
        return;
    }

    const targetLabel = importTargetType === '15' ? '15時目標' : '19時目標';
    showToast(`AI解析中 (${targetLabel})...`, 5000);

    try {
        const { text, images } = await parseFile(file);

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: text,
                contextImages: images ? images.slice(0, 5) : [],
                mode: 'extraction',
                targetType: importTargetType
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

        // Show toast instead of confirm to streamline process as per instructions ("抽出結果は確認画面を挟まず、即座にFirestoreへ保存する")
        const batch = writeBatch(db);

        filteredTargets.forEach(([date, val]) => {
            const updateData = {};
            // The prompt will return { "YYYY-MM-DD": number }
            // So val is the number directly.

            // Check if val is an object (legacy format) or number (new format)
            // But we will enforce the new prompt to return simple key-value or we handle it here.
            // If the user instructions say "Output: JSON only. Format { 'YYYY-MM-DD': number }",
            // then val is the number.

            let numVal = 0;
            if (typeof val === 'number') {
                numVal = val;
            } else if (typeof val === 'object' && val !== null) {
                // If AI returns object { t15: ... } despite instructions, handle gracefully?
                // The prompt is strict, but let's be safe.
                // Actually, I'll assume the prompt follows instructions.
                // But wait, I haven't updated the prompt yet.
                // I will ensure the prompt returns simple number mapping.
                // However, to be robust:
                if (importTargetType === '15' && val.t15) numVal = val.t15;
                else if (importTargetType === '19' && val.t19) numVal = val.t19;
                else numVal = 0; // Fallback or skip
            }

            // If we got a simple number from the new specific prompt:
            if (typeof val === 'number' || typeof val === 'string') {
                 numVal = parseInt(val);
            }

            if (numVal > 0) {
                if (importTargetType === '15') updateData.target_total_15 = numVal;
                if (importTargetType === '19') updateData.target_total_19 = numVal;

                const ref = doc(db, "operations_data", date);
                batch.set(ref, updateData, { merge: true });
            }
        });

        await batch.commit();
        showToast(`${targetLabel}を ${count}件 更新しました！`);

        if (!$('#calendar-modal').classList.contains('hidden')) {
            openMonthlyCalendar();
        }

    } catch (err) {
        console.error(err);
        alert("AI解析エラー: " + err.message);
    }
}
