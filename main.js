import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, onSnapshot, setDoc, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =========================================
   CONFIG (Unified: Garden Yashio Bot)
   ========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyAdxAeBlJkFWAVM1ZWJKhU2urQcmtL0UKo",
    authDomain: "gardenyashiobot.firebaseapp.com",
    projectId: "gardenyashiobot",
    storageBucket: "gardenyashiobot.firebasestorage.app",
    messagingSenderId: "692971442685",
    appId: "1:692971442685:web:ae4a65988ad1716ed84994"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Global State ---
window.masterStaffList = { employees: [], alba_early: [], alba_late: [] };
window.specialTasks = [];
window.isEditing = false;
const EDIT_PASSWORD = "admin";
window.currentDate = '';

// Operations Data State
let todayOpData = null;
let yesterdayOpData = null;
let monthlyOpData = {}; 
let editingOpDate = null; 
let returnToCalendar = false;

// ★ 12月 目標値データ
const TARGET_DATA_DEC = {
    1: { t15: 205, t19: 250 }, 2: { t15: 210, t19: 257 }, 3: { t15: 204, t19: 248 },
    4: { t15: 0, t19: 237 }, 5: { t15: 222, t19: 270 }, 6: { t15: 418, t19: 324 },
    7: { t15: 499, t19: 377 }, 8: { t15: 237, t19: 290 }, 9: { t15: 234, t19: 288 },
    10: { t15: 218, t19: 266 }, 11: { t15: 205, t19: 250 }, 12: { t15: 241, t19: 295 },
    13: { t15: 420, t19: 327 }, 14: { t15: 519, t19: 394 }, 15: { t15: 214, t19: 262 },
    16: { t15: 207, t19: 252 }, 17: { t15: 201, t19: 245 }, 18: { t15: 233, t19: 286 },
    19: { t15: 220, t19: 270 }, 20: { t15: 423, t19: 329 }, 21: { t15: 506, t19: 383 },
    22: { t15: 377, t19: 472 }, 23: { t15: 223, t19: 366 }, 24: { t15: 275, t19: 453 },
    25: { t15: 0, t19: 0 }, 26: { t15: 301, t19: 369 }, 27: { t15: 571, t19: 450 },
    28: { t15: 608, t19: 479 }, 29: { t15: 493, t19: 389 }, 30: { t15: 500, t19: 395 },
    31: { t15: 316, t19: 317 }
};

// --- Task Definitions ---
const TASKS_COMMON = ["朝礼", "個人業務、自由時間", "環境整備・5M", "島上・イーゼル清掃"];
const TASKS_EMPLOYEE = [
    ...TASKS_COMMON,
    "金銭業務", "抽選（準備、片付け）", "外販出し、新聞、岡持", "販促確認、全体確認",
    "P台チェック(社員)", "S台チェック(社員)",
    "立駐（社員）", "施錠・工具箱チェック", "引継ぎ・事務所清掃",
    "金銭回収", "倉庫整理", "カウンター業務"
];
const TASKS_ALBA = [
    ...TASKS_COMMON,
    "カウンター開設準備", 
    "P台チェック(アルバイト)", "S台チェック(アルバイト)",
    "ローラー交換",
    "カウンター業務", "倉庫番(特景)", "立駐（アルバイト）", 
    "飲み残し・フラッグ確認", "島上清掃・カード補充", "倉庫整理"
];
const MANUAL_TASK_LIST = [...new Set([...TASKS_EMPLOYEE, ...TASKS_ALBA])];

// Modal State Management
let pendingModalState = { sectionKey: null, staffIndex: null, taskIndex: null, field: null, selectedValue: null, candidatesType: null };
let pendingDelete = { action: null, targetSection: null, indices: null };

// Default State
const DEFAULT_STAFF = { 
    early: [], late: [], closing_employee: [], closing_alba: [], 
    fixed_money_count: "", fixed_open_warehouse: "", fixed_open_counter: "", 
    fixed_money_collect: "", fixed_warehouses: "", fixed_counters: "" 
};
window.staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));

let authContext = '';
let qscEditMode = false;

// --- Data Variables ---
let allMachines = [], newOpeningData = [], eventMap = new Map(), qscItems = [], currentQscTab = '未実施';
const latestKeywords = ["アズールレーン", "北斗の拳11", "地獄少女7500", "海物語極", "化物語", "プリズムナナ", "バーニングエキスプレス"];

// --- Helper Functions ---
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
window.getTodayDateString = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
window.getYesterdayDateString = () => { const t = new Date(); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };

function generateTimeSlots(startTime, endTime, intervalMinutes) {
    const slots = []; let [sH, sM] = startTime.split(':').map(Number); const [eH, eM] = endTime.split(':').map(Number);
    let cur = sH * 60 + sM; const end = eH * 60 + eM;
    while (cur <= end) { slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`); cur += intervalMinutes; }
    return slots;
}
const openTimeSlots = generateTimeSlots('07:00', '10:00', 15);
const openAlbaTimeSlots = generateTimeSlots('09:00', '10:00', 15);
const closeTimeSlots = generateTimeSlots('22:45', '23:30', 15);
const openTimeIndexMap = new Map(); openTimeSlots.forEach((t, i) => openTimeIndexMap.set(t, i));
const closeTimeIndexMap = new Map(); closeTimeSlots.forEach((t, i) => closeTimeIndexMap.set(t, i));

function getTaskColorClass(taskName) {
    if (!taskName) return "free-task";
    const n = taskName;
    if (n.includes("金銭")) return "money-task";
    if (n.includes("抽選") || n.includes("新台") || n.includes("新装")) return "pair-task"; 
    if (n.includes("カウンター") || n.includes("事務") || n.includes("日報")) return "parking-task";
    if (n.includes("朝礼") || n.includes("清掃") || n.includes("環境") || n.includes("外販") || n.includes("新聞") || n.includes("岡持")) return "briefing-task";
    if (n.includes("倉庫") || n.includes("納品")) return "lock-task";
    if (n.includes("チェック") || n.includes("立駐") || n.includes("施錠") || n.includes("確認") || n.includes("巡回") || n.includes("交換")) return "staff-15min-task";
    if (n.includes("個人") || n.includes("自由")) return "free-task";
    return "color-gray";
}

/* =========================================
   CORE FUNCTIONS
   ========================================= */

window.switchView = function(viewName) {
    window.scrollTo(0,0);
    try {
        if (viewName === 'staff') {
            $('#app-customer').classList.add('hidden');
            $('#app-staff').classList.remove('hidden');
            
            // Initialize view safely
            if (typeof window.setupInitialView === 'function') {
                window.setupInitialView();
            }

            if (!window.taskDocRef) {
                window.handleDateChange(window.getTodayDateString());
            }
        } else {
            $('#app-staff').classList.add('hidden');
            $('#app-customer').classList.remove('hidden');
        }
    } catch(e) {
        console.error("Switch View Error:", e);
        // Emergency fallback if needed
    }
};

window.fetchCustomerData = async function() {
    try {
        const [mSnap, nSnap, cSnap] = await Promise.all([
            getDocs(collection(db, "machines")),
            getDocs(collection(db, "newOpening")),
            getDocs(collection(db, "calendar"))
        ]);
        allMachines = mSnap.docs.map(d => d.data()).sort((a, b) => a.name.localeCompare(b.name));
        newOpeningData = nSnap.docs.map(d => d.data());
        eventMap = new Map(cSnap.docs.map(d => d.data()).sort((a, b) => a.date - b.date).map(e => [e.date, e]));
        window.renderToday();
    } catch (e) { $('#todayEventContainer').innerHTML = `<p class="text-rose-500 text-center font-bold">データ読込失敗</p>`; }
};
window.renderToday = function() {
    const today = new Date(); const d = today.getDate(); const m = today.getMonth();
    const ev = eventMap.get(d);
    const html = ev ? `<div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 w-full"><div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60"><div class="flex items-center gap-3"><div class="bg-indigo-600 text-white rounded-xl px-4 py-2 text-center shadow-md shadow-indigo-200"><div class="text-[10px] font-bold opacity-80 tracking-wider">TOPIC</div><div class="text-2xl font-black leading-none">${d}</div></div><div class="font-bold text-indigo-900 text-lg">本日のイベント</div></div><span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">TODAY</span></div><ul class="space-y-3">${ev.p_event?`<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.p_event}</span></li>`:''}${ev.s_event?`<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.s_event}</span></li>`:''}${ev.recommend?`<li class="flex items-start p-2 rounded-lg hover:bg-rose-50 transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 mr-3 shrink-0"></span><span class="text-rose-600 font-bold text-sm leading-relaxed">${ev.recommend}</span></li>`:''}</ul></div>` : `<div class="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 w-full"><div class="text-5xl font-black text-slate-200 mb-3">${d}</div><p class="text-sm font-bold">イベント情報なし</p></div>`;
    $('#todayEventContainer').innerHTML = html; $('#currentDate').textContent = `${today.getFullYear()}.${m + 1}.${d}`;
};

// =========================================
//  OPERATIONS BOARD LOGIC
// =========================================
window.subscribeOperations = function() {
    const todayStr = window.getTodayDateString();
    const yesterdayStr = window.getYesterdayDateString();

    onSnapshot(doc(db, "operations_data", todayStr), (doc) => {
        todayOpData = doc.exists() ? doc.data() : {};
        window.renderOperationsBoard();
    });
    onSnapshot(doc(db, "operations_data", yesterdayStr), (doc) => {
        yesterdayOpData = doc.exists() ? doc.data() : {};
        window.renderOperationsBoard();
    });
};

window.renderOperationsBoard = function() {
    const container = $('#operationsBoardContainer');
    if (!container) return;

    const today = new Date();
    const dayNum = today.getDate();
    const defaultTarget = TARGET_DATA_DEC[dayNum] || { t15: 0, t19: 0 };

    const t = todayOpData || {};
    const y = yesterdayOpData || {};

    const target15 = (t.target_total_15 !== undefined && t.target_total_15 !== null) ? t.target_total_15 : defaultTarget.t15;
    const target19 = (t.target_total_19 !== undefined && t.target_total_19 !== null) ? t.target_total_19 : defaultTarget.t19;

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
                <button onclick="openMonthlyCalendar()" class="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                    📅 月間推移
                </button>
                <button onclick="openOpInput()" class="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
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
                        <div class="text-[10px] font-bold text-slate-400">目標</div>
                        <div class="font-black text-indigo-600">${target15}</div>
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
                        <div class="text-[10px] font-bold text-slate-400">目標</div>
                        <div class="font-black text-indigo-600">${target19}</div>
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
};

// --- Monthly Calendar Logic ---
window.openMonthlyCalendar = async () => {
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
};

window.closeMonthlyCalendar = () => {
    $('#calendar-modal').classList.add('hidden');
};

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

    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const target = TARGET_DATA_DEC[d] || { t15:0, t19:0 };
        const actual = monthlyOpData[dateStr] || {};
        
        const act15 = actual.actual_total_15 || ((parseInt(actual.actual_4p_15)||0)+(parseInt(actual.actual_1p_15)||0)+(parseInt(actual.actual_20s_15)||0)) || 0;
        const act19 = actual.actual_total_19 || ((parseInt(actual.actual_4p_19)||0)+(parseInt(actual.actual_1p_19)||0)+(parseInt(actual.actual_20s_19)||0)) || 0;

        const is15Done = act15 >= target.t15 && act15 > 0;
        const is19Done = act19 >= target.t19 && act19 > 0;
        const bg15 = is15Done ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-50 text-slate-500';
        const bg19 = is19Done ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-50 text-slate-500';

        html += `
        <div onclick="openOpInput('${dateStr}')" class="cursor-pointer hover:bg-slate-50 hover:ring-2 ring-indigo-200 transition border border-slate-100 rounded-lg p-1 bg-white min-h-[80px] flex flex-col justify-between">
            <div class="text-[10px] font-black text-slate-300 text-center">${d}</div>
            <div class="flex flex-col gap-1">
                <div class="${bg15} rounded px-1 py-0.5 text-[9px] text-center">
                    <div class="font-bold">15時</div>
                    <div class="font-black text-[10px]">${act15 > 0 ? act15 : '-'}</div>
                    <div class="text-[8px] opacity-60">/${target.t15}</div>
                </div>
                <div class="${bg19} rounded px-1 py-0.5 text-[9px] text-center">
                    <div class="font-bold">19時</div>
                    <div class="font-black text-[10px]">${act19 > 0 ? act19 : '-'}</div>
                    <div class="text-[8px] opacity-60">/${target.t19}</div>
                </div>
            </div>
        </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// ★ Updated Input Modal Opener
window.openOpInput = (dateStr) => {
    const calModal = $('#calendar-modal');
    if (calModal && !calModal.classList.contains('hidden')) {
        returnToCalendar = true; 
        calModal.classList.add('hidden'); 
    } else {
        returnToCalendar = false;
    }

    if (!dateStr) dateStr = window.getTodayDateString();
    editingOpDate = dateStr; 

    const [y, m, d] = dateStr.split('-');
    const displayDate = `${m}/${d}`;
    document.querySelector('#operations-modal h3').innerHTML = `<span class="text-2xl">📝</span> ${displayDate} の稼働入力`;

    let data = {};
    if (dateStr === window.getTodayDateString()) data = todayOpData || {};
    else if (dateStr === window.getYesterdayDateString()) data = yesterdayOpData || {};
    else data = monthlyOpData[dateStr] || {};

    const dayNum = parseInt(d);
    const defaultTarget = TARGET_DATA_DEC[dayNum] || { t15: 0, t19: 0 };

    const setVal = (id, val, def) => $(`#${id}`).value = (val !== undefined && val !== null) ? val : def;
    
    setVal('in_target_15', data.target_total_15, defaultTarget.t15);
    setVal('in_4p_15', data.actual_4p_15, '');
    setVal('in_1p_15', data.actual_1p_15, '');
    setVal('in_20s_15', data.actual_20s_15, '');
    
    setVal('in_target_19', data.target_total_19, defaultTarget.t19);
    setVal('in_4p_19', data.actual_4p_19, '');
    setVal('in_1p_19', data.actual_1p_19, '');
    setVal('in_20s_19', data.actual_20s_19, '');

    $('#operations-modal').classList.remove('hidden');
};

window.closeOpInput = () => {
    $('#operations-modal').classList.add('hidden');
    
    if (returnToCalendar) {
        window.openMonthlyCalendar();
        returnToCalendar = false;
    }
};

window.saveOpData = async () => {
    const getVal = (id) => { const v = $(`#${id}`).value; return v ? parseInt(v) : null; };
    const d = {
        target_total_15: getVal('in_target_15'), actual_4p_15: getVal('in_4p_15'), actual_1p_15: getVal('in_1p_15'), actual_20s_15: getVal('in_20s_15'),
        target_total_19: getVal('in_target_19'), actual_4p_19: getVal('in_4p_19'), actual_1p_19: getVal('in_1p_19'), actual_20s_19: getVal('in_20s_19'),
    };
    const sum15 = (d.actual_4p_15||0) + (d.actual_1p_15||0) + (d.actual_20s_15||0);
    const sum19 = (d.actual_4p_19||0) + (d.actual_1p_19||0) + (d.actual_20s_19||0);
    if (sum15 > 0) d.actual_total_15 = sum15;
    if (sum19 > 0) d.actual_total_19 = sum19;

    const targetDate = editingOpDate || window.getTodayDateString();

    try {
        await setDoc(doc(db, "operations_data", targetDate), d, { merge: true });
        window.closeOpInput();
        window.showToast("保存しました！");
    } catch (e) { alert("保存失敗: " + e.message); }
};


window.openNewOpening = function() {
    const c = $('#newOpeningInfo'); c.innerHTML = "";
    if (!newOpeningData || !newOpeningData.length) { c.innerHTML = "<p class='text-center text-slate-400 py-10'>データなし</p>"; $('#newOpeningModal').classList.remove("hidden"); return; }
    
    const lat=[], oth=[]; 
    const validData = newOpeningData.filter(d => d && d.name);
    validData.forEach(m => (latestKeywords.some(k=>m.name.includes(k))?lat:oth).push(m));
    
    const createList = (list, title) => {
        if(!list.length) return;
        const section = document.createElement("div");
        section.innerHTML = `<h3 class="font-bold text-lg mb-2 border-b pb-1">${title}</h3>`;
        const ul = document.createElement("ul"); 
        ul.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8";
        
        list.sort((a,b)=>b.count-a.count).forEach(item => {
            const li = document.createElement("li"); 
            li.className = "bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm cursor-pointer hover:bg-slate-50 transition";
            
            const norm = (s) => (s||"").replace(/\s+/g, '').toLowerCase();
            const targetName = norm(item.name);
            const matched = allMachines.find(m => m && m.name && (norm(m.name).includes(targetName) || targetName.includes(norm(m.name))));
            const hasDetail = matched && matched.salesPitch;

            li.innerHTML = `<div class="flex flex-col overflow-hidden mr-2 pointer-events-none"><span class="font-bold text-slate-700 truncate text-sm sm:text-base">${item.name}</span>${hasDetail?`<span class="text-xs text-indigo-500 font-bold mt-1">✨ 詳細あり</span>`:`<span class="text-xs text-slate-400 font-medium mt-1">情報なし</span>`}</div><span class="text-xs font-black bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shrink-0 pointer-events-none">${item.count}台</span>`;
            
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                if(hasDetail) {
                    try {
                        $('#detailName').textContent = matched.name; 
                        $('#detailPitch').textContent = matched.salesPitch || "情報なし"; 
                        const f=(i,l)=>{
                            $(i).innerHTML="";
                            const list = Array.isArray(l) ? l : [l || "情報なし"];
                            list.forEach(t=>$(i).innerHTML+=`<li class="flex items-start"><span class="mr-2 mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span><span>${t}</span></li>`);
                        }; 
                        f("#detailPros", matched.pros); 
                        f("#detailCons", matched.cons); 
                        $('#machineDetailModal').classList.remove("hidden");
                    } catch(err) {
                        alert("データ表示中にエラーが発生しました。");
                    }
                } else {
                    alert(`「${item.name}」の詳細データは見つかりませんでした。\n管理者に機種データの登録を確認してください。`);
                }
            });
            ul.appendChild(li);
        });
        section.appendChild(ul);
        c.appendChild(section);
    };
    createList(lat, "✨ 最新導入"); createList(oth, "🔄 その他");
    $('#newOpeningModal').classList.remove("hidden");
};

window.subscribeQSC = function() { onSnapshot(collection(db, "qsc_items"), (s) => { qscItems = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.no - b.no); const u = qscItems.filter(i => i.status === "未実施").length; $('#qscUnfinishedCount').textContent = u > 0 ? `残り ${u} 件` : `完了`; if(!$('#qscModal').classList.contains("hidden")) window.renderQSCList(); }); };
window.renderQSCList = function() {
    const c = $('#qscListContainer'); c.innerHTML = "";
    const f = qscItems.filter(item => currentQscTab === '未実施' ? item.status === "未実施" : item.status === "完了");
    if (f.length === 0) { c.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold">項目はありません</div>`; return; }
    const g = {}; f.forEach(item => { if(!g[item.area]) g[item.area] = []; g[item.area].push(item); });
    for(const [area, items] of Object.entries(g)) {
        const h = document.createElement("div"); h.className = "text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2 first:mt-0"; h.textContent = area; c.appendChild(h);
        items.forEach(item => {
            const d = document.createElement("div"); d.className = `bg-white p-4 rounded-xl border ${item.status === '完了' ? 'border-slate-100 opacity-60' : 'border-slate-200'} shadow-sm flex items-center gap-4`;
            if (qscEditMode) { d.innerHTML = `<div class="flex-1"><p class="text-sm font-bold text-slate-700">${item.content}</p></div><button onclick="deleteQscItem('${item.id}')" class="p-2 bg-rose-50 text-rose-500 rounded-full">×</button>`; } 
            else { const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "qsc-checkbox shrink-0 mt-0.5"; cb.checked = item.status === "完了"; cb.onchange = async () => { try { await updateDoc(doc(db, "qsc_items", item.id), { status: cb.checked ? "完了" : "未実施" }); } catch(e) { cb.checked = !cb.checked; } }; d.innerHTML = `<div class="flex-1"><p class="text-sm font-bold text-slate-700 ${item.status === '完了' ? 'line-through text-slate-400' : ''}">${item.content}</p></div>`; d.insertBefore(cb, d.firstChild); }
            c.appendChild(d);
        });
    }
};
window.addQscItem = async function() { const n=$('#newQscNo').value, a=$('#newQscArea').value, c=$('#newQscContent').value; if(!n||!a||!c)return; await addDoc(collection(db, "qsc_items"), { no: Number(n), area:a, content:c, status: "未実施" }); $('#newQscNo').value=''; $('#newQscContent').value=''; };
window.deleteQscItem = async function(id) { if(confirm("削除しますか？")) await deleteDoc(doc(db, "qsc_items", id)); };


// --- Staff App Logic ---
let unsubscribeFromTasks = null;
window.taskDocRef = null;

const staffRef = doc(db, 'masters', 'staff_data');
const taskDefRef = doc(db, 'masters', 'task_data'); 

window.fetchMasterData = function() {
    onSnapshot(staffRef, (s) => { if(s.exists()) window.masterStaffList = s.data(); });
    onSnapshot(taskDefRef, (s) => { if(s.exists()) { window.specialTasks = s.data().list || []; if(window.refreshCurrentView) window.refreshCurrentView(); } });
};

window.handleDateChange = function(dateString) {
    if (!dateString) dateString = window.getTodayDateString();
    window.currentDate = dateString;
    const picker = $('#date-picker'); if(picker) picker.value = dateString;
    
    window.taskDocRef = doc(db, 'task_assignments', dateString);
    
    if (unsubscribeFromTasks) unsubscribeFromTasks();
    unsubscribeFromTasks = onSnapshot(window.taskDocRef, (docSnap) => {
        if (docSnap.exists()) { 
            const data = docSnap.data();
            window.staffList = {
                early: data.early || [],
                late: data.late || [],
                closing_employee: data.closing_employee || [],
                closing_alba: data.closing_alba || [],
                fixed_money_count: data.fixed_money_count || "",
                fixed_open_warehouse: data.fixed_open_warehouse || "",
                fixed_open_counter: data.fixed_open_counter || "",
                fixed_money_collect: data.fixed_money_collect || "",
                fixed_warehouses: data.fixed_warehouses || "",
                fixed_counters: data.fixed_counters || ""
            };
        } else { 
            window.staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF)); 
        }
        window.refreshCurrentView();
    });
};

window.refreshCurrentView = function() {
    if($('#app-staff').classList.contains('hidden')) return;
    updateStaffLists();
    generateSummaryView();
    const isOpen = $('#tab-open').classList.contains('bg-white');
    window.showSubTab(isOpen ? 'open' : 'close');
    window.setEditingMode(window.isEditing);
    updateFixedStaffButtons();
};

window.setupInitialView = function() {
    window.setEditingMode(false);
    window.showSubTab('open');
    updateStaffLists();
    generateSummaryView();
    updateFixedStaffButtons();
    const picker = $('#date-picker'); if (picker && !picker.value) picker.value = window.getTodayDateString();
};

window.saveStaffListToFirestore = async function() {
    if (!window.isEditing || !window.taskDocRef) return;
    try { const cleanData = JSON.parse(JSON.stringify(window.staffList, (key, value) => (value === null || value === undefined) ? "" : value)); await setDoc(window.taskDocRef, cleanData); } catch (e) { console.error(e); }
};

// --- UI Switching ---
window.showSubTab = function(tabName) {
    const isOpen = tabName === 'open';
    $('#edit-content-open').classList.toggle('hidden', !isOpen);
    $('#edit-content-close').classList.toggle('hidden', isOpen);
    $('#view-content-open').classList.toggle('hidden', !isOpen);
    $('#view-content-close').classList.toggle('hidden', isOpen);
    
    $('#tab-open').className = isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    $('#tab-close').className = !isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    
    if(window.isEditing) renderEditTimeline(tabName);
};

window.setEditingMode = function(isEdit) {
    window.isEditing = isEdit;
    $('#view-mode-container').classList.toggle('hidden', isEdit);
    $('#edit-mode-container').classList.toggle('hidden', !isEdit);
    const b = $('#edit-mode-button');
    if(b){ b.textContent = isEdit?"閲覧モードに戻る":"管理者編集"; b.className = isEdit?"text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-full shadow-md":"text-xs font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-full"; }
    if(isEdit) {
        const isOpen = $('#tab-open').classList.contains('bg-white');
        renderEditTimeline(isOpen ? 'open' : 'close');
    }
};

function renderEditTimeline(tabName) {
    const container = $('#editor-timeline-content');
    if (!container) return;
    const isEarly = tabName === 'open';
    const empList = (isEarly ? window.staffList.early : window.staffList.closing_employee) || [];
    const albaList = (isEarly ? window.staffList.late : window.staffList.closing_alba) || [];
    
    const timeSlots = isEarly ? openTimeSlots : closeTimeSlots;
    const timeMap = isEarly ? openTimeIndexMap : closeTimeIndexMap;
    const allStaff = [...empList, ...albaList];
    
    if(allStaff.length === 0) { container.innerHTML = "<p class='text-xs text-slate-400'>スタッフがいません</p>"; return; }

    let html = `<div class="relative min-w-[800px] border border-slate-200 rounded-lg overflow-hidden bg-white select-none">`;
    html += `<div class="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 sticky top-0 z-10"><div class="w-24 shrink-0 p-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-20">STAFF</div><div class="flex-1 flex">`;
    timeSlots.forEach(t => html += `<div class="flex-1 text-center py-2 border-r border-slate-100">${t}</div>`);
    html += `</div></div>`;

    allStaff.forEach(s => {
        if(!s) return; 
        html += `<div class="flex border-b border-slate-100 h-12"><div class="w-24 shrink-0 p-2 border-r border-slate-200 text-xs font-bold text-slate-700 flex items-center bg-white sticky left-0 z-10 truncate">${s.name}</div><div class="flex-1 flex relative">`;
        timeSlots.forEach(() => html += `<div class="flex-1 border-r border-slate-50"></div>`); 
        (s.tasks || []).forEach(t => {
            if(!t.start || !t.end) return;
            const startI = timeMap.get(t.start); const endI = timeMap.get(t.end);
            if(startI === undefined || endI === undefined) return;
            const widthPct = (endI - startI) / timeSlots.length * 100;
            const leftPct = startI / timeSlots.length * 100;
            const taskClass = getTaskColorClass(t.task);
            html += `<div class="absolute top-1 bottom-1 rounded-md text-[10px] font-bold text-slate-700 flex items-center justify-center overflow-hidden shadow-sm border border-white/20 ${taskClass}" style="left: ${leftPct}%; width: ${widthPct}%;"><span class="truncate px-1">${t.task}</span></div>`;
        });
        html += `</div></div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// =========================================
//  CARD UI GENERATION
// =========================================
function updateStaffLists() { 
    populate('#staff-list-open-early','early'); populate('#staff-list-open-late','late'); 
    populate('#staff-list-close-employee','closing_employee'); populate('#staff-list-close-alba','closing_alba'); 
}

function populate(id, sk) {
    const c = $(id); if(!c) return; c.innerHTML = '';
    const list = window.staffList[sk] || [];
    
    list.forEach((s, si) => {
        if (!s) return; 
        if(!s.tasks) s.tasks = []; 
        if(s.tasks.length === 0) s.tasks.push({start:'',end:'',task:'',remarks:''});
        s.tasks.sort((a,b) => (a.start||'99').localeCompare(b.start||'99'));
        
        const card = document.createElement('div');
        card.className = "staff-card";

        let headerHtml = `<div class="staff-card-header"><span class="staff-name">${s.name}</span>`;
        headerHtml += `<button onclick="confirmDeleteRequest('staff', '${sk}', ${si})" class="text-slate-300 hover:text-rose-500 font-bold px-2">×</button></div>`;
        
        let bodyHtml = `<div class="staff-card-body">`;
        s.tasks.forEach((t, ti) => {
            const isFixed = t.remarks === '（固定）';
            const delBtn = isFixed ? '' : `<button onclick="confirmDeleteRequest('task', '${sk}', ${si}, ${ti})" class="task-delete-btn">×</button>`;
            
            bodyHtml += `<div class="task-edit-row">`;
            bodyHtml += `${delBtn}`;
            
            bodyHtml += `<div class="time-group">`;
            bodyHtml += `<button class="time-btn ${t.start ? '' : 'empty'}" onclick="${!isFixed ? `openTimeSelect('${sk}',${si},${ti},'start')` : ''}" ${isFixed?'disabled':''}>${t.start || '--:--'}</button>`;
            bodyHtml += `<span class="text-slate-300 text-xs">～</span>`;
            bodyHtml += `<button class="time-btn ${t.end ? '' : 'empty'}" onclick="${!isFixed ? `openTimeSelect('${sk}',${si},${ti},'end')` : ''}" ${isFixed?'disabled':''}>${t.end || '--:--'}</button>`;
            bodyHtml += `</div>`;

            const taskColor = getTaskColorClass(t.task);
            const taskLabel = t.task || 'タスクを選択...';
            bodyHtml += `<button class="task-select-btn ${t.task ? taskColor : 'placeholder'}" onclick="${!isFixed ? `openTaskSelect('${sk}',${si},${ti})` : ''}" ${isFixed?'disabled':''}><span>${taskLabel}</span><span class="text-xs opacity-50">▼</span></button>`;
            
            bodyHtml += `<input class="remarks-input" placeholder="備考" value="${t.remarks||''}" onchange="updateRemark('${sk}',${si},${ti},this.value)" ${isFixed?'readonly':''}>`;
            
            bodyHtml += `</div>`; 
        });

        bodyHtml += `<button onclick="addTask('${sk}',${si})" class="w-full py-2 text-xs font-bold text-slate-400 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:text-indigo-500 transition">+ タスク追加</button>`;
        bodyHtml += `</div>`; 

        card.innerHTML = headerHtml + bodyHtml;
        c.appendChild(card);
    });
}

function generateSummaryView() {
    const r=(id,l,sl)=>{
        try {
            const containerDesktop = $(`#${id}-desktop`);
            const containerMobile = $(`#${id}-mobile`);
            if (!containerDesktop || !containerMobile) return;

            const t=[]; (l||[]).forEach(s=>{if(s){ (s.tasks||[]).forEach(x=>{if(x.task)t.push({...x,name:s.name});}); }}); 
            const n=[...new Set((l||[]).filter(s=>s).map(s=>s.name))].sort(); 
            
            containerDesktop.innerHTML=createTable(t,n,sl); 
            containerMobile.innerHTML=createList(t,n);
        } catch(e) { console.error("Summary Render Error", e); }
    };
    r('summary-open-employee-container',window.staffList.early,openTimeSlots); r('summary-open-alba-container',window.staffList.late,openAlbaTimeSlots); r('summary-close-employee-container',window.staffList.closing_employee,closeTimeSlots); r('summary-close-alba-container',window.staffList.closing_alba,closeTimeSlots);
}
function createTable(t,n,s){
    if(n.length===0)return '<p class="p-4 text-center text-slate-400 text-xs">スタッフなし</p>';
    let h=`<div class="timeline-container"><table class="timeline-table"><thead><tr><th>STAFF</th>${s.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>`;
    const m=new Map(s.map((x,i)=>[x,i]));
    n.forEach(name=>{
        h+=`<tr><th>${name}</th>`; const st=t.filter(x=>x.name===name).sort((a,b)=>a.start.localeCompare(b.start));
        let idx=0; while(idx<s.length){
            const slot=s[idx], task=st.find(x=>x.start===slot);
            if(task){
                const start=m.get(task.start), end=m.get(task.end); let span=1;
                if(end!==undefined&&end>start) span=end-start;
                const taskClass = getTaskColorClass(task.task);
                h+=`<td colspan="${span}"><div class="task-bar ${taskClass}" onclick="showRemarksModal('${task.task}','${task.start}-${task.end}','${task.remarks||''}')">${task.task}</div></td>`; idx+=span;
            }else{h+='<td></td>'; idx++;}
        } h+='</tr>';
    }); return h+'</tbody></table></div>';
}
function createList(t,n){
    if(n.length===0)return'<p class="text-center text-slate-400 text-xs">なし</p>';
    let h='<div class="space-y-4">'; n.forEach(name=>{
        const st=t.filter(x=>x.name===name).sort((a,b)=>a.start.localeCompare(b.start));
        h+=`<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div class="bg-slate-50 px-4 py-2 font-bold text-slate-700 border-b border-slate-100 flex justify-between"><span>${name}</span><span class="text-xs bg-white px-2 py-1 rounded border">${st.length}</span></div><div class="p-2 space-y-2">`;
        st.forEach(x=>{ 
            const taskClass = getTaskColorClass(x.task);
            h+=`<div class="task-bar relative top-0 left-0 w-full h-auto block p-2 ${taskClass}"><div class="flex justify-between"><span>${x.task}</span><span class="opacity-70 text-xs">${x.start}-${x.end}</span></div>${x.remarks?`<div class="text-xs mt-1 border-t border-black/10 pt-1">${x.remarks}</div>`:''}</div>`; 
        });
        h+='</div></div>';
    }); return h+'</div>';
}

// --- Modals & Input ---
window.showRemarksModal=(t,m,r)=>{$('#remarks-modal-task').textContent=t;$('#remarks-modal-time').textContent=m;$('#remarks-modal-text').textContent=r||"備考なし";$('#remarks-modal').classList.remove('hidden');};
window.closeRemarksModal=()=>$('#remarks-modal').classList.add('hidden');
window.closeSelectModal = () => $('#select-modal').classList.add('hidden');

// =========================================
//  NEW DELETE CONFIRMATION LOGIC
// =========================================
window.confirmDeleteRequest = (action, sectionKey, idx1, idx2) => {
    pendingDelete = { action: action, targetSection: sectionKey, indices: [idx1, idx2] };
    const msg = action === 'task' ? "このタスクを削除しますか？" : "このスタッフをリストから削除しますか？";
    openDeleteModal(msg);
};

window.openBulkDeleteMenu = () => {
    $('#bulk-delete-modal').classList.remove('hidden');
};
window.closeBulkDeleteModal = () => {
    $('#bulk-delete-modal').classList.add('hidden');
};

window.requestBulkDelete = (action, target) => {
    pendingDelete = { action: action, targetSection: target, indices: null };
    window.closeBulkDeleteModal();
    let msg = "";
    if (action === 'bulk_tasks') msg = (target === 'open' ? "【早番】" : "【遅番】") + "の全タスクをクリアしますか？\n(スタッフは残ります)";
    else if (action === 'bulk_staff') msg = (target === 'open' ? "【早番】" : "【遅番】") + "の人員リストを空にしますか？";
    else if (action === 'reset_all') msg = "【警告】\nこの日の全データを完全に削除しますか？\nこの操作は取り消せません。";
    
    openDeleteModal(msg);
};

function openDeleteModal(msg) {
    $('#delete-modal-message').innerText = msg;
    $('#delete-modal').classList.remove('hidden');
}
window.cancelDelete = () => {
    $('#delete-modal').classList.add('hidden');
    pendingDelete = {};
};
window.confirmDelete = async () => {
    const p = pendingDelete;
    $('#delete-modal').classList.add('hidden');
    if (!p.action) return;

    if (p.action === 'task') {
        const [sIdx, tIdx] = p.indices;
        window.staffList[p.targetSection][sIdx].tasks.splice(tIdx, 1);
    } else if (p.action === 'staff') {
        const [sIdx] = p.indices;
        const name = window.staffList[p.targetSection][sIdx].name;
        window.staffList[p.targetSection].splice(sIdx, 1);
        // Clear fixed binding if matched
        ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(fk=>{if(window.staffList[fk]===name)window.staffList[fk]="";});
    } else if (p.action === 'bulk_tasks') {
        const targets = p.targetSection === 'open' ? ['early', 'late'] : ['closing_employee', 'closing_alba'];
        targets.forEach(k => {
             if(window.staffList[k]) window.staffList[k].forEach(s => s.tasks = []);
        });
    } else if (p.action === 'bulk_staff') {
        const targets = p.targetSection === 'open' ? ['early', 'late'] : ['closing_employee', 'closing_alba'];
        targets.forEach(k => {
             window.staffList[k] = [];
        });
        // Clear relevant fixed
        const fixedKeys = p.targetSection === 'open' 
            ? ['fixed_money_count','fixed_open_warehouse','fixed_open_counter'] 
            : ['fixed_money_collect','fixed_warehouses','fixed_counters'];
        fixedKeys.forEach(k => window.staffList[k] = "");
    } else if (p.action === 'reset_all') {
        ['early', 'late', 'closing_employee', 'closing_alba'].forEach(key => window.staffList[key] = []);
        ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(k => window.staffList[k] = "");
    }

    await window.saveStaffListToFirestore();
    window.refreshCurrentView();
    pendingDelete = {};
};


// =========================================
//  NEW MODAL LOGIC (Select & Confirm)
// =========================================

function initModal(title) {
    $('#select-modal-title').textContent = title;
    $('#select-modal-body').innerHTML = '';
    $('#select-confirm-btn').disabled = true;
    $('#select-modal').classList.remove('hidden');
    pendingModalState.selectedValue = null;
}
window.selectOption = (value, element) => {
    $$('.select-modal-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    pendingModalState.selectedValue = value;
    $('#select-confirm-btn').disabled = false;
};
window.confirmSelection = () => {
    const s = pendingModalState;
    if (s.selectedValue === null) return; 

    if (s.field === 'fixed_staff') {
        window.setFixed(s.sectionKey, s.selectedValue, s.candidatesType); 
    } else {
        window.staffList[s.sectionKey][s.staffIndex].tasks[s.taskIndex][s.field] = s.selectedValue;
        window.saveStaffListToFirestore();
        window.refreshCurrentView();
    }
    $('#select-modal').classList.add('hidden');
};

window.openTimeSelect = (k, s, t, f) => {
    pendingModalState = { sectionKey: k, staffIndex: s, taskIndex: t, field: f };
    initModal("時間選択");
    const isO = $('#tab-open').classList.contains('bg-white');
    const slots = isO ? openTimeSlots : closeTimeSlots;
    const mb = $('#select-modal-body');
    slots.forEach(tm => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = tm;
        div.onclick = () => window.selectOption(tm, div);
        mb.appendChild(div);
    });
};

window.openTaskSelect = (k, s, t) => {
    pendingModalState = { sectionKey: k, staffIndex: s, taskIndex: t, field: 'task' };
    initModal("タスク選択");
    const isEmployeeSection = (k === 'early' || k === 'closing_employee');
    const defaultList = isEmployeeSection ? TASKS_EMPLOYEE : TASKS_ALBA;
    renderTaskOptions(defaultList, true);
};

function renderTaskOptions(list, showExpandButton) {
    const mb = $('#select-modal-body');
    mb.innerHTML = '';
    list.forEach(taskName => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = taskName;
        const colorClass = getTaskColorClass(taskName);
        div.innerHTML = `<div class="flex items-center gap-3"><span class="w-3 h-3 rounded-full border border-slate-200 ${colorClass.replace('task-bar', '')}"></span><span>${taskName}</span></div>`;
        div.onclick = () => window.selectOption(taskName, div);
        mb.appendChild(div);
    });
    if (showExpandButton) {
        const btn = document.createElement('button');
        btn.className = "w-full py-3 mt-4 text-xs font-bold text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-100";
        btn.textContent = "すべてのタスクを表示";
        btn.onclick = () => renderTaskOptions(MANUAL_TASK_LIST, false);
        mb.appendChild(btn);
    }
}

window.openFixedStaffSelect = (k, type, title) => {
    if(!window.isEditing) return;
    pendingModalState = { sectionKey: k, field: 'fixed_staff', candidatesType: type };
    initModal(title);
    const candidates = (type.includes('early')||type.includes('open')) 
        ? [...window.masterStaffList.employees, ...window.masterStaffList.alba_early] 
        : [...window.masterStaffList.employees, ...window.masterStaffList.alba_late];
    const mb = $('#select-modal-body');
    const noneDiv = document.createElement('div');
    noneDiv.className = "select-modal-option text-slate-400";
    noneDiv.textContent = "指定なし";
    noneDiv.onclick = () => { window.selectOption("", noneDiv); };
    mb.appendChild(noneDiv);
    candidates.sort().forEach(n => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = n;
        div.onclick = () => window.selectOption(n, div);
        mb.appendChild(div);
    });
};

window.setFixed = (k, n, type) => {
    window.staffList[k]=n;
    if(n){
        const isEmp = window.masterStaffList.employees.includes(n);
        let lKey = '';
        
        // ★ 属性判定で正しいリストキーを設定
        if (['fixed_money_count', 'fixed_open_warehouse', 'fixed_open_counter'].includes(k)) {
            lKey = isEmp ? 'early' : 'late';
        } else {
            lKey = isEmp ? 'closing_employee' : 'closing_alba';
        }

        // ★ リスト移動処理
        let p = window.staffList[lKey].find(s => s && s.name === n);
        if (!p) {
            const wrongKey = (lKey === 'early') ? 'late' : (lKey === 'late') ? 'early' :
                             (lKey === 'closing_employee') ? 'closing_alba' : 'closing_employee';
            
            const wrongIndex = window.staffList[wrongKey].findIndex(s => s && s.name === n);
            if (wrongIndex !== -1) {
                p = window.staffList[wrongKey][wrongIndex];
                window.staffList[wrongKey].splice(wrongIndex, 1);
                window.staffList[lKey].push(p);
            } else {
                p = { name: n, tasks: [] };
                window.staffList[lKey].push(p);
            }
        }

        // ★ 固定タスクの定義
        // 金銭: 07:00-08:15 金銭 -> 09:00-09:15 朝礼 -> 09:15-09:45 S台 -> 09:45-10:00 全体
        // 倉庫: 09:00-09:15 朝礼 -> 09:15-10:00 倉庫
        // カウンター: 09:00-09:15 朝礼 -> 09:15-09:45 開設 -> 09:45-10:00 全体
        const defs={
            'fixed_money_count': [
                {t:'金銭業務',s:'07:00',e:'08:15'},
                {t:'朝礼',s:'09:00',e:'09:15'},
                {t:'S台チェック(社員)',s:'09:15',e:'09:45'},
                {t:'全体確認',s:'09:45',e:'10:00'}
            ],
            'fixed_open_warehouse': [
                {t:'朝礼',s:'09:00',e:'09:15'},
                {t:'倉庫番(特景)',s:'09:15',e:'10:00'}
            ],
            'fixed_open_counter': [
                {t:'朝礼',s:'09:00',e:'09:15'},
                {t:'カウンター開設準備',s:'09:15',e:'09:45'},
                {t:'全体確認',s:'09:45',e:'10:00'}
            ],
            // 遅番は既存のまま
            'fixed_money_collect': [{t:'金銭回収',s:'22:45',e:'23:15'}],
            'fixed_warehouses': [{t:'倉庫整理',s:'22:45',e:'23:15'}],
            'fixed_counters': [{t:'カウンター業務',s:'22:45',e:'23:00'}]
        };

        const tasksToAdd = defs[k];
        if(tasksToAdd){ 
            p.tasks = p.tasks.filter(t => t.remarks !== '（固定）');
            tasksToAdd.forEach(task => {
                p.tasks.push({ start: task.s, end: task.e, task: task.t, remarks: '（固定）' });
            });
            p.tasks.sort((a,b)=>a.start.localeCompare(b.start)); 
        }
    }
    updateFixedStaffButtons(); 
    window.saveStaffListToFirestore(); 
    window.refreshCurrentView(); 
};

// ★ UPDATE: Label + Name Display Logic
function updateFixedStaffButtons() { 
    const map = {
        'fixed_money_count': { id: 'fixed-money_count-btn', label: '金銭業務' },
        'fixed_open_warehouse': { id: 'fixed_open_warehouse-btn', label: '倉庫番 (特景)' },
        'fixed_open_counter': { id: 'fixed-open_counter-btn', label: 'カウンター開設' }, 
        'fixed_money_collect': { id: 'fixed-money_collect-btn', label: '金銭回収' },
        'fixed_warehouses': { id: 'fixed-warehouses-btn', label: '倉庫整理' },
        'fixed_counters': { id: 'fixed-counters-btn', label: 'カウンター' }
    };
    Object.keys(map).forEach(k => {
        const item = map[k];
        const btn = $(`#${item.id}`);
        const staffName = window.staffList[k] || "未選択";
        if (btn) {
            btn.innerHTML = `<span class="block text-[10px] text-indigo-400 font-extrabold mb-0.5 tracking-wider">${item.label}</span><span class="block text-sm font-bold text-slate-700">${staffName}</span>`;
        }
    });
}

window.updateRemark=(k,s,t,v)=>{ window.staffList[k][s].tasks[t].remarks=v; window.saveStaffListToFirestore(); };
window.addTask=(k,s)=>{ window.staffList[k][s].tasks.push({start:'',end:'',task:'',remarks:''}); window.saveStaffListToFirestore(); window.refreshCurrentView(); };
window.addS=(k,n)=>{ window.staffList[k].push({name:n,tasks:[{start:'',end:'',task:'',remarks:''}]}); window.saveStaffListToFirestore(); window.refreshCurrentView(); $('#select-modal').classList.add('hidden'); };

window.showPasswordModal = (ctx) => { 
    if(window.isEditing && ctx==='admin'){ 
        window.setEditingMode(false); 
        return; 
    } 
    authContext=ctx; 
    $('#password-modal').classList.remove('hidden'); 
    $('#password-input').value=""; 
    $('#password-error').classList.add('hidden'); 
    $('#password-input').focus(); 
    
    const input = $('#password-input');
    input.onkeydown = (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            window.checkPassword();
        }
    };
};
window.closePasswordModal = () => $('#password-modal').classList.add('hidden');

window.checkPassword = () => { 
    const input = $('#password-input');
    if(input.value.trim().toLowerCase() === EDIT_PASSWORD){ 
        window.closePasswordModal(); 
        if(authContext==='admin') window.setEditingMode(true); 
        else { qscEditMode=true; $('#qscEditButton').textContent="✅ 完了"; $('#qscAddForm').classList.remove('hidden'); window.renderQSCList(); } 
    } else { 
        $('#password-error').classList.remove('hidden'); 
    } 
};
window.openStaffSelect=(k,mt)=>{ const c=window.masterStaffList[mt], ex=window.staffList[k].filter(s=>s).map(s=>s.name); const mb=$('#select-modal-body'); mb.innerHTML=''; c.filter(n=>!ex.includes(n)).forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="addS('${k}','${n}')">${n}</div>`); $('#select-modal-title').textContent="スタッフ追加"; $('#select-modal').classList.remove('hidden'); };


// =========================================
//  AUTO ASSIGN (ONE BUTTON WRAPPER)
// =========================================
window.showToast = (msg) => {
    const toast = document.createElement('div');
    toast.className = "toast-notification";
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('show'); });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { document.body.removeChild(toast); }, 300);
    }, 2000);
};

window.autoAssignSection = async (section) => {
    await window.autoAssignTasks(null, section);
    window.showToast("自動で割り振りました！");
};

// AUTO ASSIGN CORE
const timeToMin = (t) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const checkOverlap = (tasks, sTime, eTime) => {
    if(!tasks) return false;
    const s = timeToMin(sTime), e = timeToMin(eTime);
    return tasks.some(t => { const ts = timeToMin(t.start), te = timeToMin(t.end); return (ts < e && te > s); });
};
const assign = (staff, task, start, end, remarks = "") => {
    if (!staff) return false;
    if (!staff.tasks) staff.tasks = [];
    if (!checkOverlap(staff.tasks, start, end)) {
        staff.tasks.push({ start, end, task, remarks });
        staff.tasks.sort((a, b) => a.start.localeCompare(b.start));
        return true;
    }
    return false;
};

// ★★★ NEW AUTOMATIC LOGIC ★★★
window.autoAssignTasks = async (sec, listType) => {
    try {
        if (!window.currentDate) window.currentDate = window.getTodayDateString();
        const isOpen = listType === 'open';
        const empKey = isOpen ? 'early' : 'closing_employee';
        const albaKey = isOpen ? 'late' : 'closing_alba';
        
        const employees = (window.staffList[empKey] || []).filter(s => s);
        const albas = (window.staffList[albaKey] || []).filter(s => s);
        const allStaff = [...employees, ...albas];

        // 1. Reset tasks (keep fixed)
        allStaff.forEach(s => { 
            s.tasks = s.tasks.filter(t => t.remarks === '（固定）'); 
        });

        const fixedNames = [
            window.staffList.fixed_money_count,
            window.staffList.fixed_open_warehouse,
            window.staffList.fixed_open_counter,
            window.staffList.fixed_money_collect,
            window.staffList.fixed_warehouses,
            window.staffList.fixed_counters
        ].filter(n => n);

        if (isOpen) {
            // === 社員の割り振り ===
            const freeEmployees = employees.filter(s => !fixedNames.includes(s.name));
            
            // 7時台のリレー割り振り
            const empTasks = [
                { t: "販促確認", s: '07:00', e: '07:30' },
                { t: "外販出し、新聞、岡持", s: '07:30', e: '07:45' },
                { t: "P台チェック(社員)", s: '07:45', e: '08:15' }
            ];

            // 1人ずつ選出して割り当てる
            let empIndex = 0;
            if (freeEmployees.length > 0) {
                empTasks.forEach(task => {
                    // 順番に割り当て（人数が足りなければループ）
                    const staff = freeEmployees[empIndex % freeEmployees.length];
                    assign(staff, task.t, task.s, task.e);
                    empIndex++;
                });
            }

            // 全員共通: 朝礼
            employees.forEach(s => {
                if (!checkOverlap(s.tasks, '09:00', '09:15')) assign(s, '朝礼', '09:00', '09:15');
            });

            // 全員共通: 抽選補助
            freeEmployees.forEach(s => {
                if (!checkOverlap(s.tasks, '09:15', '10:00')) assign(s, '抽選（準備、片付け）', '09:15', '10:00');
            });


            // === アルバイトの割り振り ===
            const freeAlbas = albas.filter(s => !fixedNames.includes(s.name));
            
            // 抽選人数の判定
            let isWeekend = false;
            try {
                const [y, m, d] = window.currentDate.split('-').map(Number);
                const dayObj = new Date(y, m - 1, d);
                const dayNum = dayObj.getDay();
                isWeekend = (dayNum === 0 || dayNum === 6);
            } catch(e) {}
            const lotteryCount = isWeekend ? 3 : 2;

            let albaIdx = 0;

            // ① 抽選班の確保
            for (let i = 0; i < lotteryCount; i++) {
                if (albaIdx < freeAlbas.length) {
                    const s = freeAlbas[albaIdx];
                    assign(s, '朝礼', '09:00', '09:15');
                    assign(s, '抽選（準備、片付け）', '09:15', '10:00');
                    albaIdx++;
                }
            }

            // ② 残りの作業班の割り振り
            // パターン: S台(30) -> ローラー(30) -> 環境(15)+清掃(15) -> 環境(15)+清掃(15)...
            let jobType = 0; // 0:S台, 1:ローラー, 2+:環境+清掃

            while (albaIdx < freeAlbas.length) {
                const s = freeAlbas[albaIdx];
                assign(s, '朝礼', '09:00', '09:15');

                if (jobType === 0) {
                    // S台担当
                    assign(s, 'S台チェック(アルバイト)', '09:15', '09:45');
                    // 9:45以降は空白（バッファ）
                } else if (jobType === 1) {
                    // ローラー担当
                    assign(s, 'ローラー交換', '09:15', '09:45');
                    // 9:45以降は空白
                } else {
                    // 環境＆清掃担当
                    assign(s, '環境整備・5M', '09:15', '09:30');
                    assign(s, '島上・イーゼル清掃', '09:30', '09:45');
                    // 9:45以降は空白
                }

                albaIdx++;
                jobType++;
            }

        } else {
            // === CLOSE LOGIC (既存のまま) ===
            let pEmp = null, pAlba = null;
            const sortedEmps = [...employees].sort((a,b) => a.tasks.length - b.tasks.length);
            const sortedAlbas = [...albas].sort((a,b) => a.tasks.length - b.tasks.length);
            for (const e of sortedEmps) {
                if (!fixedNames.includes(e.name) && !checkOverlap(e.tasks, '23:00', '23:15')) { pEmp = e; break; }
            }
            for (const a of sortedAlbas) {
                if (!fixedNames.includes(a.name) && !checkOverlap(a.tasks, '23:00', '23:15')) { pAlba = a; break; }
            }
            if (pEmp && pAlba) {
                assign(pEmp, '立駐（社員）', '23:00', '23:15');
                assign(pAlba, '立駐（アルバイト）', '23:00', '23:15');
                fixedNames.push(pEmp.name, pAlba.name);
            }
            // 社員タスク
            ['施錠・工具箱チェック'].forEach(t => {
                const sorted = [...employees].sort((a,b) => a.tasks.length - b.tasks.length);
                for (const s of sorted) {
                    if (fixedNames.includes(s.name)) continue;
                    if (assign(s, t, '22:45', '23:00')) break;
                }
            });
            ['引継ぎ・事務所清掃'].forEach(t => {
                const sorted = [...employees].sort((a,b) => a.tasks.length - b.tasks.length);
                for (const s of sorted) {
                    if (fixedNames.includes(s.name)) continue;
                    if (assign(s, t, '23:15', '23:30')) break;
                }
            });
            // バイトタスク
            ['飲み残し・フラッグ確認', '島上清掃・カード補充'].forEach(t => {
                const sorted = [...albas].sort((a,b) => a.tasks.length - b.tasks.length);
                for (const s of sorted) {
                    if (fixedNames.includes(s.name)) continue;
                    if (assign(s, t, '22:45', '23:00')) break;
                    if (assign(s, t, '23:00', '23:15')) break;
                }
            });
            // 固定漏れ
            if (!window.staffList.fixed_money_collect) {
                const c = employees.sort((a,b)=>a.tasks.length-b.tasks.length).find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '金銭回収', '22:45', '23:15');
            }
            if (!window.staffList.fixed_warehouses) {
                const c = allStaff.sort((a,b)=>a.tasks.length-b.tasks.length).find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '倉庫整理', '22:45', '23:15');
            }
        }

        // === Fill Free Time (隙間埋め) ===
        const slots = isOpen ? openTimeSlots : closeTimeSlots;
        allStaff.forEach(s => {
            // ★重要: マスタで社員判定
            const isEmployee = window.masterStaffList.employees.includes(s.name);
            
            for (let i = 0; i < slots.length - 1; i++) {
                const st = slots[i]; const et = slots[i+1];
                if (isOpen && st < '09:00') {
                    // ★ 9時前は「社員以外」は絶対に埋めない（固定タスク持ちバイトも含む）
                    if (!isEmployee) continue; 
                }
                if (!checkOverlap(s.tasks, st, et)) assign(s, '個人業務、自由時間', st, et);
            }
            // マージ処理
            s.tasks.sort((a, b) => a.start.localeCompare(b.start));
            const merged = [];
            s.tasks.forEach(t => {
                if (merged.length === 0) { merged.push(t); return; }
                const last = merged[merged.length - 1];
                if (last.task === t.task && last.task === '個人業務、自由時間' && last.end === t.start) {
                    last.end = t.end;
                } else { merged.push(t); }
            });
            s.tasks = merged;
        });

        window.saveStaffListToFirestore();
        window.refreshCurrentView();
    } catch(e) {
        console.error(e);
        alert("割り振り処理中にエラーが発生しました: " + e.message);
    }
};

window.addEventListener("DOMContentLoaded", () => {
    window.fetchCustomerData(); window.subscribeQSC(); window.fetchMasterData();
    window.subscribeOperations(); 
    $('#qscEditButton').onclick=()=>{ if(qscEditMode){qscEditMode=false;$('#qscEditButton').textContent="⚙️ 管理";$('#qscAddForm').classList.add('hidden');window.renderQSCList();}else{window.showPasswordModal('qsc');} };
    $('#newOpeningButton').onclick=window.openNewOpening;
    $('#closeNewOpeningModal').onclick=()=>$('#newOpeningModal').classList.add('hidden');
    $('#closeDetailModal').onclick=()=>$('#machineDetailModal').classList.add('hidden');
    $('#openQSCButton').onclick=()=>{ $('#qscModal').classList.remove('hidden'); window.renderQSCList(); };
    $('#closeQscModal').onclick=()=>$('#qscModal').classList.add('hidden');
    $('#qscTabUnfinished').onclick = () => {
        currentQscTab = '未実施';
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
        window.renderQSCList();
    };
    $('#qscTabFinished').onclick = () => {
        currentQscTab = '完了';
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
        window.renderQSCList();
    };
    // Removed problematic calendarToggleButton code
    $('#edit-mode-button').onclick=()=>window.showPasswordModal('admin');
    if(window.location.hash === '#staff') window.switchView('staff');
});
