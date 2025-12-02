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

// ★追加: 手動選択用のタスクリスト（これがないと手動追加で候補が出ない）
const MANUAL_TASK_LIST = [
    "金銭業務", "倉庫番(特景)", "カウンター開設準備", "朝礼", "抽選（準備、片付け）",
    "外販出し、新聞、岡持", "販促確認、全体確認、時差島台電落とし", "P台チェック(社員)",
    "P台チェック(アルバイト)", "S台チェック", "ローラー交換", "環境整備・5M", "島上・イーゼル清掃",
    "個人業務、自由時間", "金銭回収", "倉庫整理", "カウンター業務",
    "立駐（社員）", "立駐（アルバイト）", "施錠・工具箱チェック", "引継ぎ・事務所清掃",
    "飲み残し・フラッグ確認", "島上清掃・カード補充"
];

// Default State
const DEFAULT_STAFF = { 
    early: [], 
    late: [], 
    closing_employee: [], 
    closing_alba: [], 
    fixed_money_count: "", 
    fixed_open_warehouse: "", 
    fixed_open_counter: "", 
    fixed_money_collect: "", 
    fixed_warehouses: "", 
    fixed_counters: "" 
};
window.staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));

let deleteInfo = { type: null, sectionKey: null, staffIndex: null, taskIndex: null };
let authContext = '';
let qscEditMode = false;

// --- Data Variables ---
let allMachines = [], newOpeningData = [], eventMap = new Map(), qscItems = [], currentQscTab = '未実施';
const latestKeywords = ["アズールレーン", "北斗の拳11", "地獄少女7500", "海物語極", "化物語", "プリズムナナ", "バーニングエキスプレス"];

// --- Helper Functions ---
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
window.getTodayDateString = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };

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

// ペンキ屋さん（色分け）
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
    if (viewName === 'staff') {
        $('#app-customer').classList.add('hidden');
        $('#app-staff').classList.remove('hidden');
        if (!window.taskDocRef) {
            window.setupInitialView();
            window.handleDateChange(window.getTodayDateString());
        }
    } else {
        $('#app-staff').classList.add('hidden');
        $('#app-customer').classList.remove('hidden');
    }
};

// --- Customer App Logic ---
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
const staffRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'masters', 'staff_data');
const taskDefRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'masters', 'task_data');

window.fetchMasterData = function() {
    onSnapshot(staffRef, (s) => { if(s.exists()) window.masterStaffList = s.data(); });
    onSnapshot(taskDefRef, (s) => { if(s.exists()) { window.specialTasks = s.data().list || []; if(window.refreshCurrentView) window.refreshCurrentView(); } });
};

window.handleDateChange = function(dateString) {
    if (!dateString) dateString = window.getTodayDateString();
    window.currentDate = dateString;
    const picker = $('#date-picker'); if(picker) picker.value = dateString;
    window.taskDocRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'task_assignments', dateString);
    if (unsubscribeFromTasks) unsubscribeFromTasks();
    unsubscribeFromTasks = onSnapshot(window.taskDocRef, (docSnap) => {
        if (docSnap.exists()) { window.staffList = { ...window.staffList, ...docSnap.data() }; } 
        else { window.staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF)); }
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
    const empList = isEarly ? window.staffList.early : window.staffList.closing_employee;
    const albaList = isEarly ? window.staffList.late : window.staffList.closing_alba;
    const timeSlots = isEarly ? openTimeSlots : closeTimeSlots;
    const timeMap = isEarly ? openTimeIndexMap : closeTimeIndexMap;
    const allStaff = [...empList, ...albaList];
    
    if(allStaff.length === 0) { container.innerHTML = "<p class='text-xs text-slate-400'>スタッフがいません</p>"; return; }

    let html = `<div class="relative min-w-[800px] border border-slate-200 rounded-lg overflow-hidden bg-white select-none">`;
    html += `<div class="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 sticky top-0 z-10"><div class="w-24 shrink-0 p-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-20">STAFF</div><div class="flex-1 flex">`;
    timeSlots.forEach(t => html += `<div class="flex-1 text-center py-2 border-r border-slate-100">${t}</div>`);
    html += `</div></div>`;

    allStaff.forEach(s => {
        html += `<div class="flex border-b border-slate-100 h-12"><div class="w-24 shrink-0 p-2 border-r border-slate-200 text-xs font-bold text-slate-700 flex items-center bg-white sticky left-0 z-10 truncate">${s.name}</div><div class="flex-1 flex relative">`;
        timeSlots.forEach(() => html += `<div class="flex-1 border-r border-slate-50"></div>`); 
        s.tasks.forEach(t => {
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

// --- UI UPDATE & LISTS ---
function updateStaffLists() { 
    populate('#staff-list-open-early','early'); populate('#staff-list-open-late','late'); 
    populate('#staff-list-close-employee','closing_employee'); populate('#staff-list-close-alba','closing_alba'); 
}
function populate(id, sk) {
    const c = $(id); if(!c) return; c.innerHTML = '';
    window.staffList[sk].forEach((s, si) => {
        if(s.tasks.length === 0) s.tasks.push({start:'',end:'',task:'',remarks:''});
        s.tasks.sort((a,b) => (a.start||'99').localeCompare(b.start||'99'));
        
        s.tasks.forEach((t, ti) => {
            const f = t.remarks === '（固定）';
            const delBtn = f ? '' : `<button onclick="delTask('${sk}',${si},${ti})" class="text-rose-500 w-6 h-6 hover:bg-rose-50 rounded">×</button>`;
            const addBtn = `<button onclick="addTask('${sk}',${si})" class="text-slate-400 w-6 h-6 hover:bg-slate-100 rounded">＋</button>`;
            const btn = (ti > 0 || s.tasks.length > 1) ? delBtn : addBtn;
            
            let html = `<tr class="edit-row border-b border-slate-100 last:border-0">`;
            html += `<td class="py-2 px-2">${ti===0 ? `<div class="flex items-center justify-between font-bold text-sm text-slate-700">${s.name} <button onclick="delStaff('${sk}',${si})" class="text-slate-300 hover:text-rose-500 ml-2">×</button></div>` : ''}</td>`;
            html += `<td class="p-1"><button class="custom-select-button w-full text-xs ${t.start?'':'placeholder'}" onclick="${!f?`openTimeSelect('${sk}',${si},${ti},'start')`:''}" ${f?'disabled':''}>${t.start||'開始'}</button></td>`;
            html += `<td class="p-1"><button class="custom-select-button w-full text-xs ${t.end?'':'placeholder'}" onclick="${!f?`openTimeSelect('${sk}',${si},${ti},'end')`:''}" ${f?'disabled':''}>${t.end||'終了'}</button></td>`;
            html += `<td class="p-1"><button class="custom-select-button w-full text-xs ${t.task?'':'placeholder'}" onclick="${!f?`openTaskSelect('${sk}',${si},${ti})`:''}" ${f?'disabled':''}>${t.task||'タスク'}</button></td>`;
            html += `<td class="p-1"><input class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs" value="${t.remarks||''}" onchange="updateRemark('${sk}',${si},${ti},this.value)" ${f?'readonly':''}></td>`;
            html += `<td class="p-1 text-center">${btn}</td></tr>`;
            c.innerHTML += html;
        });
    });
}
function generateSummaryView() {
    const r=(id,l,sl)=>{ const t=[]; l.forEach(s=>s.tasks.forEach(x=>{if(x.task&&!x.task.includes("FREE"))t.push({...x,name:s.name});})); const n=[...new Set(l.map(s=>s.name))].sort(); $(`#${id}-desktop`).innerHTML=createTable(t,n,sl); $(`#${id}-mobile`).innerHTML=createList(t,n); };
    r('summary-open-employee-container',window.staffList.early,openTimeSlots); r('summary-open-alba-container',window.staffList.late,openAlbaTimeSlots); r('summary-close-employee-container',window.staffList.closing_employee,closeTimeSlots); r('summary-close-alba-container',window.staffList.closing_alba,closeTimeSlots);
}

// --- Modals & Input ---
window.showRemarksModal=(t,m,r)=>{$('#remarks-modal-task').textContent=t;$('#remarks-modal-time').textContent=m;$('#remarks-modal-text').textContent=r||"備考なし";$('#remarks-modal').classList.remove('hidden');};
window.closeRemarksModal=()=>$('#remarks-modal').classList.add('hidden');
window.closeSelectModal = () => $('#select-modal').classList.add('hidden');

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
    
    // Enterキー対応
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

window.openFixedStaffSelect = (k, type) => { if(!window.isEditing)return; const c=(type.includes('early')||type.includes('open'))?[...window.masterStaffList.employees,...window.masterStaffList.alba_early]:[...window.masterStaffList.employees,...window.masterStaffList.alba_late]; const mb=$('#select-modal-body'); mb.innerHTML=`<div class="select-modal-option text-slate-400" onclick="setFixed('${k}','','${type}')">指定なし</div>`; c.sort().forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="setFixed('${k}','${n}','${type}')">${n}</div>`); $('#select-modal-title').textContent="担当者選択"; $('#select-modal').classList.remove('hidden'); };
window.setFixed = (k, n, type) => {
    window.staffList[k]=n;
    if(n){
        const isEmp = window.masterStaffList.employees.includes(n);
        let lKey = '';
        if(type.includes('early')) lKey='early'; else if(type.includes('open')) lKey=isEmp?'early':'late'; else lKey=isEmp?'closing_employee':'closing_alba';
        let p = window.staffList[lKey].find(s=>s.name===n);
        if(!p){ p={name:n, tasks:[]}; window.staffList[lKey].push(p); }
        const defs={
            'fixed_money_count':{t:'金銭業務',s:'07:00',e:'08:15'},
            'fixed_open_warehouse':{t:'倉庫番(特景)',s:'09:15',e:'09:45'},
            'fixed_open_counter':{t:'カウンター開設準備',s:'09:15',e:'10:00'}, 
            'fixed_money_collect':{t:'金銭回収',s:'22:45',e:'23:15'},
            'fixed_warehouses':{t:'倉庫整理',s:'22:45',e:'23:15'},
            'fixed_counters':{t:'カウンター業務',s:'22:45',e:'23:00'}
        };
        const d=defs[k];
        if(d){ 
            p.tasks=p.tasks.filter(t=>t.remarks!=='（固定）'&&t.task!==d.t); 
            p.tasks.push({start:d.s,end:d.e,task:d.t,remarks:'（固定）'}); 
            p.tasks.sort((a,b)=>a.start.localeCompare(b.start)); 
        }
    }
    updateFixedStaffButtons(); window.saveStaffListToFirestore(); window.refreshCurrentView(); $('#select-modal').classList.add('hidden');
};
function updateFixedStaffButtons() { 
    const map = {
        'fixed_money_count': 'fixed-money_count-btn',
        'fixed_open_warehouse': 'fixed_open_warehouse-btn',
        'fixed_open_counter': 'fixed-open_counter-btn', 
        'fixed_money_collect': 'fixed-money_collect-btn',
        'fixed_warehouses': 'fixed-warehouses-btn',
        'fixed_counters': 'fixed-counters-btn'
    };
    Object.keys(map).forEach(k => {
        const btnId = map[k];
        const span = $(`#${btnId} span`);
        if (span) span.textContent = window.staffList[k] || "選択してください";
    });
}

window.openTimeSelect=(k,s,t,f)=>{ const isO=$('#tab-open').classList.contains('bg-white'), slots=isO?openTimeSlots:closeTimeSlots; const mb=$('#select-modal-body'); mb.innerHTML=''; slots.forEach(tm=>mb.innerHTML+=`<div class="select-modal-option" onclick="upd('${k}',${s},${t},'${f}','${tm}');$('#select-modal').classList.add('hidden')">${tm}</div>`); $('#select-modal-title').textContent="時間"; $('#select-modal').classList.remove('hidden'); };

// ★修正: 手動タスク選択で MANUAL_TASK_LIST を使うように変更
window.openTaskSelect=(k,s,t)=>{ 
    const mb=$('#select-modal-body'); 
    mb.innerHTML=''; 
    MANUAL_TASK_LIST.forEach(taskName => {
        mb.innerHTML+=`<div class="select-modal-option" onclick="upd('${k}',${s},${t},'task','${taskName}');$('#select-modal').classList.add('hidden')">${taskName}</div>`;
    });
    $('#select-modal-title').textContent="タスク"; 
    $('#select-modal').classList.remove('hidden'); 
};

window.openStaffSelect=(k,mt)=>{ const c=window.masterStaffList[mt], ex=window.staffList[k].map(s=>s.name); const mb=$('#select-modal-body'); mb.innerHTML=''; c.filter(n=>!ex.includes(n)).forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="addS('${k}','${n}')">${n}</div>`); $('#select-modal-title').textContent="スタッフ追加"; $('#select-modal').classList.remove('hidden'); };

window.upd=(k,s,t,f,v)=>{ window.staffList[k][s].tasks[t][f]=v; window.saveStaffListToFirestore(); window.refreshCurrentView(); };
window.updateRemark=(k,s,t,v)=>{ window.staffList[k][s].tasks[t].remarks=v; window.saveStaffListToFirestore(); };
window.addTask=(k,s)=>{ window.staffList[k][s].tasks.push({start:'',end:'',task:'',remarks:''}); window.saveStaffListToFirestore(); window.refreshCurrentView(); };
window.delTask=(k,s,t)=>{ if(confirm("削除？")){ window.staffList[k][s].tasks.splice(t,1); window.saveStaffListToFirestore(); window.refreshCurrentView(); } };
window.delStaff=(k,s)=>{ if(confirm("スタッフ削除？")){ const n=window.staffList[k][s].name; window.staffList[k].splice(s,1); ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(fk=>{if(window.staffList[fk]===n)window.staffList[fk]="";}); window.saveStaffListToFirestore(); window.refreshCurrentView(); } };
window.addS=(k,n)=>{ window.staffList[k].push({name:n,tasks:[{start:'',end:'',task:'',remarks:''}]}); window.saveStaffListToFirestore(); window.refreshCurrentView(); $('#select-modal').classList.add('hidden'); };

// Auto Assign Logic
const timeToMin = (t) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const checkOverlap = (tasks, sTime, eTime) => {
    if(!tasks) return false;
    const s = timeToMin(sTime), e = timeToMin(eTime);
    return tasks.some(t => { const ts = timeToMin(t.start), te = timeToMin(t.end); return (ts < e && te > s); });
};
const assign = (staff, task, start, end, remarks = "") => {
    if (!staff || !checkOverlap(staff.tasks, start, end)) {
        if(!staff.tasks) staff.tasks = [];
        staff.tasks.push({ start, end, task, remarks });
        staff.tasks.sort((a, b) => a.start.localeCompare(b.start));
        return true;
    }
    return false;
};

// ★修正: 外販・販促確認などを「7時から」＆「社員限定」に変更！
window.autoAssignTasks = async (sec, listType) => {
    try {
        const isOpen = listType === 'open';
        const empKey = isOpen ? 'early' : 'closing_employee';
        const albaKey = isOpen ? 'late' : 'closing_alba';
        
        const employees = window.staffList[empKey] || [];
        const albas = window.staffList[albaKey] || [];
        const allStaff = [...employees, ...albas];

        allStaff.forEach(s => { 
            if(s.tasks) s.tasks = s.tasks.filter(t => t.remarks === '（固定）'); 
            else s.tasks = [];
        });

        const fixedMap = {
            money: window.staffList.fixed_money_count,
            warehouse: window.staffList.fixed_open_warehouse,
            counterOpen: window.staffList.fixed_open_counter,
            collect: window.staffList.fixed_money_collect,
            warehouseClose: window.staffList.fixed_warehouses,
            counterClose: window.staffList.fixed_counters
        };
        const fixedNames = Object.values(fixedMap).filter(Boolean);

        if (isOpen) {
            // ① カウンター開設準備
            if (!fixedMap.counterOpen) {
                const candidate = albas.find(s => !fixedNames.includes(s.name) && !checkOverlap(s.tasks, '09:15', '10:00'));
                if (candidate) assign(candidate, 'カウンター開設準備', '09:15', '10:00');
            }
            
            // ② 抽選 (9:15-10:00)
            let lotteryCount = 0;
            // ★変更: 抽選も社員にやらせるなら employees ループに変更（現状は全体確認などと被るのでallStaffのまま優先度高で処理）
            // 要望では「これ全部社員の時間から」とのことなので、抽選も社員優先にしますか？
            // いったん指示通り「外販・販促」などは7:00から振ります。
            // 抽選は9:15開始固定。
            for (const s of employees) { // ★社員限定に変更
                if (lotteryCount >= 2) break;
                if (fixedNames.includes(s.name)) continue;
                if (assign(s, "抽選（準備、片付け）", '09:15', '10:00')) lotteryCount++;
            }

            // ③ 朝礼
            allStaff.forEach(s => {
                if (!checkOverlap(s.tasks, '09:00', '09:15')) assign(s, '朝礼', '09:00', '09:15');
            });

            // ④ 早番社員タスク (7:00から割り振り開始！)
            const earlyEmpTasks = ["外販出し、新聞、岡持", "販促確認、全体確認、時差島台電落とし"];
            const postMorningTasks = ["P台チェック(社員)"]; // 9:15以降

            // 7:00 ~ (外販など)
            earlyEmpTasks.forEach(taskName => {
                for (const s of employees) {
                    if (fixedNames.includes(s.name)) continue;
                    
                    let assigned = false;
                    for (let i = 0; i < openTimeSlots.length - 1; i++) {
                        const st = openTimeSlots[i];
                        const et = openTimeSlots[i+1];
                        
                        // 朝礼(9:00)と抽選(9:15-10:00)は避ける
                        // 9:00以降は朝礼があるので、それ以前のスロットを優先
                        // 単純に空きがあれば埋める
                        if (st === '09:00') continue; 
                        
                        if (assign(s, taskName, st, et)) {
                            assigned = true;
                            break; 
                        }
                    }
                    if (assigned) break; 
                }
            });

            // 9:15 ~ (P台チェック社員)
            postMorningTasks.forEach(taskName => {
                for (const s of employees) {
                    if (fixedNames.includes(s.name)) continue;
                    
                    let assigned = false;
                    // 9:15 のインデックスからスタート
                    // 9:15 is index 9 in generateTimeSlots('07:00', '10:00', 15)
                    // 07:00(0), 15(1), 30(2), 45(3), 08:00(4), 15(5), 30(6), 45(7), 09:00(8), 09:15(9)
                    for (let i = 9; i < openTimeSlots.length - 1; i++) {
                        const st = openTimeSlots[i];
                        const et = openTimeSlots[i+1];
                        if (assign(s, taskName, st, et)) {
                            assigned = true;
                            break;
                        }
                    }
                    if (assigned) break;
                }
            });

            // ⑤ 早番アルバイト
            const albaTasks = ["P台チェック(アルバイト)", "S台チェック", "ローラー交換", "環境整備・5M"];
            for (const taskName of albaTasks) {
                for (const s of albas) {
                    if (fixedNames.includes(s.name)) continue;
                    // バイトは9:15から
                    if (assign(s, taskName, '09:15', '09:30')) break;
                    if (assign(s, taskName, '09:30', '09:45')) break;
                    if (assign(s, taskName, '09:45', '10:00')) break;
                }
            }
            // ⑥ 清掃 (空き埋め)
            albas.forEach(s => {
                if (fixedNames.includes(s.name)) return;
                [['09:15','09:30'], ['09:30','09:45'], ['09:45','10:00']].forEach(([st, et]) => {
                    if (!checkOverlap(s.tasks, st, et)) assign(s, '島上・イーゼル清掃', st, et);
                });
            });

        } else {
            // CLOSE Logic (Same)
            let pEmp = null, pAlba = null;
            for (const e of employees) {
                if (!fixedNames.includes(e.name) && !checkOverlap(e.tasks, '22:45', '23:00')) { pEmp = e; break; }
            }
            for (const a of albas) {
                if (!fixedNames.includes(a.name) && !checkOverlap(a.tasks, '22:45', '23:00')) { pAlba = a; break; }
            }
            if (pEmp && pAlba) {
                assign(pEmp, '立駐（社員）', '22:45', '23:00');
                assign(pAlba, '立駐（アルバイト）', '22:45', '23:00');
                fixedNames.push(pEmp.name, pAlba.name);
            }
            const closeEmpTasks = ['施錠・工具箱チェック', '引継ぎ・事務所清掃'];
            closeEmpTasks.forEach(taskName => {
                for (const s of employees) {
                    if (fixedNames.includes(s.name)) continue;
                    if (assign(s, taskName, '22:45', '23:00')) break;
                }
            });
            const closeAlbaTasks = ['飲み残し・フラッグ確認', '島上清掃・カード補充'];
            closeAlbaTasks.forEach(taskName => {
                for (const s of albas) {
                    if (fixedNames.includes(s.name)) continue;
                    if (assign(s, taskName, '22:45', '23:00')) break;
                }
            });
            if (!fixedMap.collect) {
                const c = employees.find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '金銭回収', '22:45', '23:15');
            }
            if (!fixedMap.warehouseClose) {
                const c = allStaff.find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '倉庫整理', '22:45', '23:15');
            }
        }

        const slots = isOpen ? openTimeSlots : closeTimeSlots;
        allStaff.forEach(s => {
            const isEmployee = employees.includes(s);
            for (let i = 0; i < slots.length - 1; i++) {
                const st = slots[i]; const et = slots[i+1];
                // 9時前の制限: 社員or固定担当ならOK、バイトはNG
                if (isOpen && st < '09:00') {
                    const isFixed = fixedNames.includes(s.name);
                    if (!isFixed && !isEmployee) continue; 
                }
                if (!checkOverlap(s.tasks, st, et)) assign(s, '個人業務、自由時間', st, et);
            }
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
    $('#calendarToggleButton').onclick=()=>{
        const f=$('#fullCalendarContainer'), t=$('#todayEventContainer'), b=$('#calendarToggleButton');
        f.classList.toggle('hidden'); t.classList.toggle('hidden'); b.textContent=f.classList.contains('hidden')?"全体を見る":"戻る";
        if(!f.classList.contains('hidden')) {
            const g=$('#calendarGrid'); g.innerHTML=["日","月","火","水","木","金","土"].map(d=>`<div class="text-xs text-slate-300 text-center py-2">${d}</div>`).join("") + "<div></div>".repeat(6);
            const days = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
            for(let i=1; i<=days; i++) {
                const ev = eventMap.get(i); const btn = document.createElement("button"); btn.className = `calendar-day ${ev&&(ev.p_event||ev.s_event)?'has-event':''}`; btn.textContent = i;
                if (i === new Date().getDate()) btn.classList.add('is-today');
                btn.onclick = () => { $$(".calendar-day").forEach(x=>x.classList.remove("is-selected")); btn.classList.add("is-selected"); $('#selectedEventDetails').innerHTML = ev ? `<div class="w-full text-left"><div class="text-indigo-600 font-black mb-1">${i}日</div><ul class="space-y-1 text-sm">${ev.p_event?`<li>${ev.p_event}</li>`:''}${ev.s_event?`<li>${ev.s_event}</li>`:''}</ul></div>` : "情報なし"; };
                g.appendChild(btn);
            }
        }
    };
    $('#edit-mode-button').onclick=()=>window.showPasswordModal('admin');
    if(window.location.hash === '#staff') window.switchView('staff');
});
