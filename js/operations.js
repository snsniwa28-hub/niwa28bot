import { db } from './firebase.js';
import { collection, doc, onSnapshot, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { TARGET_DATA_DEC } from './config.js';
import { $, getTodayDateString, getYesterdayDateString } from './utils.js';
import { showToast, openPopupWindow } from './ui.js';

let todayOpData = null;
let yesterdayOpData = null;
let monthlyOpData = {};
let editingOpDate = null;
let returnToCalendar = false;
let opInputPopup = null;
let opCalendarPopup = null;

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

    const today = new Date();
    const dayNum = today.getDate();
    const defaultTarget = TARGET_DATA_DEC[dayNum] || { t15: 0, t19: 0 };

    const t = todayOpData || {};
    const y = yesterdayOpData || {};

    const expected15 = (t.target_total_15 !== undefined && t.target_total_15 !== null) ? t.target_total_15 : defaultTarget.t15;
    const daily15 = (t.today_target_total_15 !== undefined && t.today_target_total_15 !== null) ? t.today_target_total_15 : null;
    const target15_display = daily15 ?
        `<div class="flex flex-col leading-none">
            <span class="font-black text-indigo-600 text-lg">${daily15}</span>
            <span class="text-xs text-slate-400 line-through decoration-slate-300 decoration-1">${expected15}</span>
         </div>` :
        `<div class="font-black text-indigo-600">${expected15}</div>`;
    const target15_label = daily15 ? '当日/予想' : '目標';

    const expected19 = (t.target_total_19 !== undefined && t.target_total_19 !== null) ? t.target_total_19 : defaultTarget.t19;
    const daily19 = (t.today_target_total_19 !== undefined && t.today_target_total_19 !== null) ? t.today_target_total_19 : null;
    const target19_display = daily19 ?
        `<div class="flex flex-col leading-none">
            <span class="font-black text-indigo-600 text-lg">${daily19}</span>
            <span class="text-xs text-slate-400 line-through decoration-slate-300 decoration-1">${expected19}</span>
         </div>` :
        `<div class="font-black text-indigo-600">${expected19}</div>`;
    const target19_label = daily19 ? '当日/予想' : '目標';

    const calcTotal = (d, time) => {
        if (!d) return null;
        if (d[`actual_total_${time}`]) return d[`actual_total_${time}`];
        const p4 = parseInt(d[`actual_4p_${time}`]) || 0;
        const p1 = parseInt(d[`actual_1p_${time}`]) || 0;
        const s20 = parseInt(d[`actual_20s_${time}`]) || 0;
        return (p4 + p1 + s20) > 0 ? (p4 + p1 + s20) : null;
    };

    const today15 = calcTotal(t, '15');
    const today19 = calcTotal(t, '19');
    const yest15 = calcTotal(y, '15');
    const yest19 = calcTotal(y, '19');

    const num = (n) => (n || n === 0) ? `${n}名` : '<span class="text-slate-300">-</span>';

    let html = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 w-full">
        <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span class="text-xl">📊</span> 稼働実績ボード
            </h3>
            <div class="flex gap-2">
                <button id="btn-monthly-cal" class="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                    📅 月間推移
                </button>
                <button id="btn-op-input" class="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
                    ✏️ 入力
                </button>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 relative overflow-hidden">
                <div class="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">15:00</div>
                <div class="text-4xl font-black text-slate-800 mb-3 tracking-tight">${num(today15)}</div>
                <div class="flex justify-between items-center bg-white rounded-lg p-2 border border-slate-100">
                    <div class="text-center w-1/2 border-r border-slate-100">
                        <div class="text-[10px] font-bold text-slate-400">${target15_label}</div>
                        ${target15_display}
                    </div>
                    <div class="text-center w-1/2">
                        <div class="text-[10px] font-bold text-slate-400">前日</div>
                        <div class="font-black text-slate-500">${num(yest15).replace('名','')}</div>
                    </div>
                </div>
            </div>
            <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 relative overflow-hidden">
                <div class="text-xs font-black text-slate-400 mb-1 uppercase tracking-widest">19:00</div>
                <div class="text-4xl font-black text-slate-800 mb-3 tracking-tight">${num(today19)}</div>
                <div class="flex justify-between items-center bg-white rounded-lg p-2 border border-slate-100">
                    <div class="text-center w-1/2 border-r border-slate-100">
                        <div class="text-[10px] font-bold text-slate-400">${target19_label}</div>
                        ${target19_display}
                    </div>
                    <div class="text-center w-1/2">
                        <div class="text-[10px] font-bold text-slate-400">前日</div>
                        <div class="font-black text-slate-500">${num(yest19).replace('名','')}</div>
                    </div>
                </div>
            </div>
        </div>

        <details class="group">
            <summary class="flex justify-between items-center font-bold text-xs text-slate-500 cursor-pointer bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition select-none">
                <span>詳細を見る (4円 / 1円 / 20円)</span>
                <span class="transition group-open:rotate-180">▼</span>
            </summary>
            <div class="mt-3 text-sm space-y-3 px-1 animate-fade-in">
                <div class="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span class="font-bold text-blue-600">4円パチンコ</span>
                    <div class="flex gap-4">
                        <span class="font-mono font-bold text-slate-700">15時: ${num(t.actual_4p_15)}</span>
                        <span class="font-mono font-bold text-slate-700">19時: ${num(t.actual_4p_19)}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span class="font-bold text-yellow-600">1円パチンコ</span>
                    <div class="flex gap-4">
                        <span class="font-mono font-bold text-slate-700">15時: ${num(t.actual_1p_15)}</span>
                        <span class="font-mono font-bold text-slate-700">19時: ${num(t.actual_1p_19)}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span class="font-bold text-emerald-600">20円スロット</span>
                    <div class="flex gap-4">
                        <span class="font-mono font-bold text-slate-700">15時: ${num(t.actual_20s_15)}</span>
                        <span class="font-mono font-bold text-slate-700">19時: ${num(t.actual_20s_19)}</span>
                    </div>
                </div>
            </div>
        </details>
    </div>
    `;
    container.innerHTML = html;

    // Add event listeners (replacing inline onclicks)
    const btnMonthly = container.querySelector('#btn-monthly-cal');
    if (btnMonthly) btnMonthly.onclick = openMonthlyCalendar;

    const btnInput = container.querySelector('#btn-op-input');
    if (btnInput) btnInput.onclick = () => openOpInput();
}

export async function openMonthlyCalendar() {
    if (opCalendarPopup && !opCalendarPopup.closed) {
        opCalendarPopup.focus();
        return;
    }

    // Set flag
    returnToCalendar = false;

    const html = `
    <div class="flex flex-col h-full bg-white">
        <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0 p-6">
            <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                <span class="text-2xl">📅</span> 12月 月間稼働推移
            </h3>
        </div>

        <div id="calendar-grid-body" class="flex-1 overflow-y-auto px-6 pb-6">
            <p class="text-center py-10 text-slate-400">データ読込中...</p>
        </div>
    </div>
    <script>
        window.opener.UI_loadMonthlyData(window);
    </script>
    `;

    opCalendarPopup = openPopupWindow('月間稼働推移', html, 900, 700);
}

// Handler called by calendar popup to load data
window.UI_loadMonthlyData = async function(popupWin) {
    try {
        const snapshot = await getDocs(collection(db, "operations_data"));
        monthlyOpData = {};
        snapshot.forEach(doc => {
            monthlyOpData[doc.id] = doc.data();
        });
        renderCalendarGrid(popupWin);
    } catch (e) {
        if(popupWin && !popupWin.closed) popupWin.alert("データ読込に失敗しました: " + e.message);
    }
};

export function closeMonthlyCalendar() {
    if(opCalendarPopup) opCalendarPopup.close();
}

function renderCalendarGrid(popupWin) {
    if (!popupWin || popupWin.closed) return;
    const container = popupWin.document.getElementById('calendar-grid-body');
    if (!container) return;

    container.innerHTML = '';

    const year = 2025;
    const month = 11; // Dec
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const headers = ['日','月','火','水','木','金','土'];
    let html = `<div class="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-slate-400">`;
    headers.forEach(h => html += `<div>${h}</div>`);
    html += `</div><div class="grid grid-cols-7 gap-1">`;

    const firstDay = new Date(year, month, 1).getDay();
    for(let i=0; i<firstDay; i++) {
        html += `<div></div>`;
    }

    // Prepare data for click handlers
    const clickData = [];

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const target = TARGET_DATA_DEC[d] || { t15:0, t19:0 };
        const actual = monthlyOpData[dateStr] || {};

        // Determine effective target
        const exp15 = (actual.target_total_15 !== undefined && actual.target_total_15 !== null) ? actual.target_total_15 : target.t15;
        const daily15 = actual.today_target_total_15;
        const effTarget15 = (daily15 !== undefined && daily15 !== null) ? daily15 : exp15;

        const exp19 = (actual.target_total_19 !== undefined && actual.target_total_19 !== null) ? actual.target_total_19 : target.t19;
        const daily19 = actual.today_target_total_19;
        const effTarget19 = (daily19 !== undefined && daily19 !== null) ? daily19 : exp19;

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
        clickData.push({ id: divId, date: dateStr });
    }
    html += `</div>`;
    container.innerHTML = html;

    // Attach listeners
    clickData.forEach(h => {
        const el = popupWin.document.getElementById(h.id);
        if(el) {
            el.onclick = () => {
                // Open Input Popup from Calendar Popup
                openOpInput(h.date, true);
            };
        }
    });
}

export function openOpInput(dateStr, fromCalendar = false) {
    if (fromCalendar) {
        returnToCalendar = true;
        if(opCalendarPopup) opCalendarPopup.close();
    } else {
        returnToCalendar = false;
    }

    if (!dateStr) dateStr = getTodayDateString();
    editingOpDate = dateStr;

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;

    let data = {};
    if (dateStr === getTodayDateString()) data = todayOpData || {};
    else if (dateStr === getYesterdayDateString()) data = yesterdayOpData || {};
    else data = monthlyOpData[dateStr] || {};

    const dayNum = parseInt(d);
    const defaultTarget = TARGET_DATA_DEC[dayNum] || { t15: 0, t19: 0 };

    const val = (v, def) => (v !== undefined && v !== null) ? v : def;

    // Prepare HTML with values pre-filled (easier than injecting script to populate)
    // Note: We need to use `value="${val}"`

    const html = `
    <div class="flex flex-col h-full bg-white p-6">
        <h3 class="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
            <span class="text-2xl">📝</span> ${displayDate} の稼働入力
        </h3>

        <div class="space-y-6 flex-1 overflow-y-auto px-1">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div class="text-sm font-bold text-indigo-600 mb-3 flex items-center gap-2">
                    <span class="w-2 h-4 bg-indigo-500 rounded-full"></span> 15:00 の数値
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-slate-500 mb-1">予想目標</label>
                        <input type="number" id="in_target_15" value="${val(data.target_total_15, defaultTarget.t15)}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="目標">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-indigo-600 mb-1">当日目標</label>
                        <input type="number" id="in_today_target_15" value="${val(data.today_target_total_15, '')}" class="w-full bg-white border-2 border-indigo-200 focus:border-indigo-500 rounded p-2 text-sm font-bold" placeholder="当日決定">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-blue-500 mb-1">4円パチンコ</label>
                        <input type="number" id="in_4p_15" value="${val(data.actual_4p_15, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-yellow-600 mb-1">1円パチンコ</label>
                        <input type="number" id="in_1p_15" value="${val(data.actual_1p_15, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-emerald-600 mb-1">20円スロット</label>
                        <input type="number" id="in_20s_15" value="${val(data.actual_20s_15, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                </div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div class="text-sm font-bold text-purple-600 mb-3 flex items-center gap-2">
                    <span class="w-2 h-4 bg-purple-500 rounded-full"></span> 19:00 の数値
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-slate-500 mb-1">予想目標</label>
                        <input type="number" id="in_target_19" value="${val(data.target_total_19, defaultTarget.t19)}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="目標">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-indigo-600 mb-1">当日目標</label>
                        <input type="number" id="in_today_target_19" value="${val(data.today_target_total_19, '')}" class="w-full bg-white border-2 border-indigo-200 focus:border-indigo-500 rounded p-2 text-sm font-bold" placeholder="当日決定">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-blue-500 mb-1">4円パチンコ</label>
                        <input type="number" id="in_4p_19" value="${val(data.actual_4p_19, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-yellow-600 mb-1">1円パチンコ</label>
                        <input type="number" id="in_1p_19" value="${val(data.actual_1p_19, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                    <div class="op-input-group">
                        <label class="block text-xs font-bold text-emerald-600 mb-1">20円スロット</label>
                        <input type="number" id="in_20s_19" value="${val(data.actual_20s_19, '')}" class="w-full bg-white border border-slate-200 rounded p-2 text-sm font-bold" placeholder="0">
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-6 flex gap-3">
            <button onclick="window.close()" class="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">キャンセル</button>
            <button id="btn-save-op" class="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700">保存する</button>
        </div>
    </div>
    <script>
        document.getElementById('btn-save-op').onclick = function() {
            const data = {
                target_total_15: document.getElementById('in_target_15').value,
                today_target_total_15: document.getElementById('in_today_target_15').value,
                actual_4p_15: document.getElementById('in_4p_15').value,
                actual_1p_15: document.getElementById('in_1p_15').value,
                actual_20s_15: document.getElementById('in_20s_15').value,
                target_total_19: document.getElementById('in_target_19').value,
                today_target_total_19: document.getElementById('in_today_target_19').value,
                actual_4p_19: document.getElementById('in_4p_19').value,
                actual_1p_19: document.getElementById('in_1p_19').value,
                actual_20s_19: document.getElementById('in_20s_19').value
            };
            window.opener.UI_saveOpData(data, window);
        };
    </script>
    `;

    opInputPopup = openPopupWindow('稼働入力', html, 500, 700);
}

// Handler called by popup
window.UI_saveOpData = async function(rawData, popupWin) {
    const getVal = (v) => v ? parseInt(v) : null;

    const d = {
        target_total_15: getVal(rawData.target_total_15),
        today_target_total_15: getVal(rawData.today_target_total_15),
        actual_4p_15: getVal(rawData.actual_4p_15),
        actual_1p_15: getVal(rawData.actual_1p_15),
        actual_20s_15: getVal(rawData.actual_20s_15),
        target_total_19: getVal(rawData.target_total_19),
        today_target_total_19: getVal(rawData.today_target_total_19),
        actual_4p_19: getVal(rawData.actual_4p_19),
        actual_1p_19: getVal(rawData.actual_1p_19),
        actual_20s_19: getVal(rawData.actual_20s_19),
    };

    const sum15 = (d.actual_4p_15||0) + (d.actual_1p_15||0) + (d.actual_20s_15||0);
    const sum19 = (d.actual_4p_19||0) + (d.actual_1p_19||0) + (d.actual_20s_19||0);
    if (sum15 > 0) d.actual_total_15 = sum15;
    if (sum19 > 0) d.actual_total_19 = sum19;

    const targetDate = editingOpDate || getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        if(popupWin) popupWin.close();

        showToast("保存しました！");

        if (returnToCalendar) {
            openMonthlyCalendar();
        }
    } catch (e) {
        if(popupWin) popupWin.alert("保存失敗: " + e.message);
    }
};

export function closeOpInput() {
    if(opInputPopup) opInputPopup.close();

    if (returnToCalendar) {
        openMonthlyCalendar();
        returnToCalendar = false;
    }
}

export async function saveOpData() {
    // Deprecated DOM version
}
