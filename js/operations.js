import { db } from './firebase.js';
import { collection, doc, onSnapshot, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { TARGET_DATA_DEC } from './config.js';
import { $, getTodayDateString, getYesterdayDateString } from './utils.js';
import { showToast } from './ui.js';

let todayOpData = null;
let yesterdayOpData = null;
let monthlyOpData = {};
let editingOpDate = null;
let returnToCalendar = false;

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
    const modal = $('#calendar-modal');
    if (!modal) { alert("カレンダー画面が見つかりません"); return; }
    modal.classList.remove('hidden');
    returnToCalendar = false;

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

    // Helper to add listener after html injection
    const clickHandlers = [];

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
    const defaultTarget = TARGET_DATA_DEC[dayNum] || { t15: 0, t19: 0 };

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
    const d = {
        target_total_15: getVal('in_target_15'),
        today_target_total_15: getVal('in_today_target_15'),
        actual_4p_15: getVal('in_4p_15'), actual_1p_15: getVal('in_1p_15'), actual_20s_15: getVal('in_20s_15'),
        target_total_19: getVal('in_target_19'),
        today_target_total_19: getVal('in_today_target_19'),
        actual_4p_19: getVal('in_4p_19'), actual_1p_19: getVal('in_1p_19'), actual_20s_19: getVal('in_20s_19'),
    };
    const sum15 = (d.actual_4p_15||0) + (d.actual_1p_15||0) + (d.actual_20s_15||0);
    const sum19 = (d.actual_4p_19||0) + (d.actual_1p_19||0) + (d.actual_20s_19||0);
    if (sum15 > 0) d.actual_total_15 = sum15;
    if (sum19 > 0) d.actual_total_19 = sum19;

    const targetDate = editingOpDate || getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        closeOpInput();
        showToast("保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
}
