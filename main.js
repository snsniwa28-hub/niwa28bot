import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, onSnapshot, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* =========================================
   CONFIG (完全統合: Garden Yashio Bot)
   ========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyAdxAeBlJkFWAVM1ZWJKhU2urQcmtL0UKo",
    authDomain: "gardenyashiobot.firebaseapp.com",
    projectId: "gardenyashiobot",
    storageBucket: "gardenyashiobot.firebasestorage.app",
    messagingSenderId: "692971442685",
    appId: "1:692971442685:web:ae4a65988ad1716ed84994"
};

// Initialize Firebase (1つに統一)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Global State ---
window.masterStaffList = { employees: [], alba_early: [], alba_late: [] };
window.specialTasks = [];
window.isEditing = false;
const EDIT_PASSWORD = "admin";
window.currentDate = '';
window.staffList = { 
    early: [], late: [], closing_employee: [], closing_alba: [], 
    fixed_money_count: "", fixed_open_warehouse: "", 
    fixed_open_counter: "", // ★ 修正: 早番カウンター固定担当者キーを追加
    fixed_money_collect: "", fixed_warehouses: "", fixed_counters: "" 
};
let deleteInfo = { type: null, sectionKey: null, staffIndex: null, taskIndex: null };
let authContext = '';

// --- Data Variables ---
let allMachines = [], newOpeningData = [], eventMap = new Map(), qscItems = [], currentQscTab = '未実施', qscEditMode = false;

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
const openAlbaTimeIndexMap = new Map(); openAlbaTimeSlots.forEach((t, i) => openAlbaTimeIndexMap.set(t, i));
const closeTimeIndexMap = new Map(); closeTimeSlots.forEach((t, i) => closeTimeIndexMap.set(t, i));


/* =========================================
   CORE FUNCTIONS
   ========================================= */

// 1. View Switcher
window.switchView = function(viewName) {
    window.scrollTo(0,0);
    if (viewName === 'staff') {
        document.getElementById('app-customer').classList.add('hidden');
        document.getElementById('app-staff').classList.remove('hidden');
        if (!window.taskDocRef) {
            window.setupInitialView();
            window.handleDateChange(window.getTodayDateString());
        }
    } else {
        document.getElementById('app-staff').classList.add('hidden');
        document.getElementById('app-customer').classList.remove('hidden');
    }
};

// 2. Customer App Logic
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
    } catch (e) {
        console.error("Fetch Error:", e);
        document.getElementById("todayEventContainer").innerHTML = `<p class="text-rose-500 text-center font-bold">データの読み込みに失敗しました</p>`;
    }
};

window.renderToday = function() {
    const today = new Date();
    const d = today.getDate();
    const m = today.getMonth();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const ev = eventMap.get(d);
    
    const html = ev ? 
        `<div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 w-full"><div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60"><div class="flex items-center gap-3"><div class="bg-indigo-600 text-white rounded-xl px-4 py-2 text-center shadow-md shadow-indigo-200"><div class="text-[10px] font-bold opacity-80 tracking-wider">${monthNames[m]}</div><div class="text-2xl font-black leading-none">${d}</div></div><div class="font-bold text-indigo-900 text-lg">本日のイベント情報</div></div><span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">TODAY</span></div><ul class="space-y-3">${ev.p_event ? `<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.p_event}</span></li>` : ''}${ev.s_event ? `<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.s_event}</span></li>` : ''}${ev.recommend ? `<li class="flex items-start p-2 rounded-lg hover:bg-rose-50 transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 mr-3 shrink-0"></span><span class="text-rose-600 font-bold text-sm leading-relaxed">${ev.recommend}</span></li>` : ''}</ul></div>` 
        : `<div class="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 w-full"><div class="text-5xl font-black text-slate-200 mb-3">${d}</div><p class="text-sm font-bold">特別なイベント情報はありません</p></div>`;
    document.getElementById("todayEventContainer").innerHTML = html;
    document.getElementById("currentDate").textContent = `${today.getFullYear()}.${m + 1}.${d}`;
};

window.openNewOpening = function() {
    const container = document.getElementById("newOpeningInfo");
    container.innerHTML = "";
    if (newOpeningData.length === 0) {
        container.innerHTML = "<p class='text-center text-slate-400 py-10'>データがありません</p>";
        document.getElementById("newOpeningModal").classList.remove("hidden");
        return;
    }
    const ul = document.createElement("ul");
    ul.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8";
    newOpeningData.sort((a,b)=>b.count-a.count).forEach(item => {
        const li = document.createElement("li");
        li.className = "bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm";
        const matched = allMachines.find(m => m.name === item.name || m.name.includes(item.name));
        li.innerHTML = `<div class="flex flex-col overflow-hidden mr-2"><span class="font-bold text-slate-700 truncate text-sm sm:text-base">${item.name}</span>${matched&&matched.salesPitch?`<span class="text-xs text-slate-400 font-medium mt-1">詳細あり</span>`:''}</div><span class="text-xs font-black bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shrink-0">${item.count}台</span>`;
        if(matched && matched.salesPitch) {
            li.style.cursor = "pointer";
            li.onclick = () => {
                document.getElementById("detailName").textContent = matched.name;
                document.getElementById("detailPitch").textContent = matched.salesPitch || "情報なし";
                const f=(i,l)=>{document.querySelector(i).innerHTML="";(l||["情報なし"]).forEach(t=>document.querySelector(i).innerHTML+=`<li class="flex items-start"><span class="mr-2 mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span><span>${t}</span></li>`);};
                f("#detailPros", matched.pros); f("#detailCons", matched.cons);
                document.getElementById("machineDetailModal").classList.remove("hidden");
            };
        }
        ul.appendChild(li);
    });
    container.appendChild(ul);
    document.getElementById("newOpeningModal").classList.remove("hidden");
};

// QSC Logic
window.subscribeQSC = function() {
    onSnapshot(collection(db, "qsc_items"), (snapshot) => {
        qscItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.no - b.no);
        const unfinishedCount = qscItems.filter(i => i.status === "未実施").length;
        document.getElementById("qscUnfinishedCount").textContent = unfinishedCount > 0 ? `残り ${unfinishedCount} 件` : `完了`;
        if(!document.getElementById("qscModal").classList.contains("hidden")) window.renderQSCList();
    });
};

window.renderQSCList = function() {
    const container = document.getElementById("qscListContainer");
    container.innerHTML = "";
    const filteredItems = qscItems.filter(item => currentQscTab === '未実施' ? item.status === "未実施" : item.status === "完了");
    if (filteredItems.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold">項目はありません</div>`; return; }
    const grouped = {};
    filteredItems.forEach(item => { if(!grouped[item.area]) grouped[item.area] = []; grouped[item.area].push(item); });
    for(const [area, items] of Object.entries(grouped)) {
        const header = document.createElement("div");
        header.className = "text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2 first:mt-0";
        header.textContent = area;
        container.appendChild(header);
        items.forEach(item => {
            const div = document.createElement("div");
            div.className = `bg-white p-4 rounded-xl border ${item.status === '完了' ? 'border-slate-100 opacity-60' : 'border-slate-200'} shadow-sm flex items-center gap-4`;
            if (qscEditMode) {
                div.innerHTML = `<div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="text-xs font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">No.${item.no}</span></div><p class="text-sm font-bold text-slate-700 leading-snug">${item.content}</p></div><button onclick="deleteQscItem('${item.id}')" class="p-2 bg-rose-50 text-rose-500 rounded-full">×</button>`;
            } else {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "qsc-checkbox shrink-0 mt-0.5";
                checkbox.checked = item.status === "完了";
                checkbox.onchange = async () => { try { await updateDoc(doc(db, "qsc_items", item.id), { status: checkbox.checked ? "完了" : "未実施" }); } catch(e) { checkbox.checked = !checkbox.checked; } };
                div.innerHTML = `<div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="text-xs font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">No.${item.no}</span>${item.status === '完了' ? '<span class="text-xs font-bold text-green-600">DONE</span>' : ''}</div><p class="text-sm font-bold text-slate-700 leading-snug ${item.status === '完了' ? 'line-through text-slate-400' : ''}">${item.content}</p></div>`;
                div.insertBefore(checkbox, div.firstChild);
            }
            container.appendChild(div);
        });
    }
};

window.addQscItem = async function() {
    const no = document.getElementById('newQscNo').value;
    const area = document.getElementById('newQscArea').value;
    const content = document.getElementById('newQscContent').value;
    if(!no || !area || !content) return alert("項目を入力してください");
    await addDoc(collection(db, "qsc_items"), { no: Number(no), area, content, status: "未実施" });
    document.getElementById('newQscNo').value = ''; document.getElementById('newQscContent').value = '';
};
window.deleteQscItem = async function(id) { if(confirm("削除しますか？")) await deleteDoc(doc(db, "qsc_items", id)); };

// 3. Staff App Logic (Unified DB: gardenyashiobot)
let unsubscribeFromTasks = null;
window.taskDocRef = null;
const staffRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'masters', 'staff_data');
const taskDefRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'masters', 'task_data');

window.fetchMasterData = async function() {
    onSnapshot(staffRef, (s) => { if(s.exists()) { window.masterStaffList = s.data(); if(!document.getElementById("master-modal").classList.contains('hidden')) window.renderMasterStaffLists(); } });
    onSnapshot(taskDefRef, (s) => { if(s.exists()) { window.specialTasks = s.data().list || []; if(!document.getElementById("master-modal").classList.contains('hidden')) window.renderMasterTaskList(); if(window.refreshCurrentView) window.refreshCurrentView(); } });
};

window.handleDateChange = function(dateString) {
    if (!dateString) dateString = window.getTodayDateString();
    window.currentDate = dateString;
    const picker = document.getElementById('date-picker'); if(picker) picker.value = dateString;
    window.taskDocRef = doc(db, 'artifacts', firebaseConfig.projectId, 'public', 'data', 'task_assignments', dateString);
    if (unsubscribeFromTasks) unsubscribeFromTasks();
    unsubscribeFromTasks = onSnapshot(window.taskDocRef, (docSnap) => {
        if (docSnap.exists()) { window.staffList = { ...window.staffList, ...docSnap.data() }; } 
        else { 
            // ★ 修正: fixed_open_counter を初期値に追加
            window.staffList = { 
                early: [], late: [], closing_employee: [], closing_alba: [], 
                fixed_money_count: "", fixed_open_warehouse: "", 
                fixed_open_counter: "", // ★ 追加
                fixed_money_collect: "", fixed_warehouses: "", fixed_counters: "" 
            }; 
        }
        if(window.refreshCurrentView) window.refreshCurrentView();
    });
};

window.refreshCurrentView = function() {
    if(document.getElementById('app-staff').classList.contains('hidden')) return;
    updateStaffLists(); generateSummaryView();
    const isOpen = document.getElementById('tab-open').classList.contains('bg-white');
    showSubTab(isOpen ? 'open' : 'close'); setEditingMode(window.isEditing); updateFixedStaffButtons();
};

window.setupInitialView = function() {
    setEditingMode(false); showSubTab('open'); updateStaffLists(); generateSummaryView(); updateFixedStaffButtons();
    const picker = document.getElementById('date-picker'); if (!picker.value) picker.value = window.getTodayDateString();
};

window.saveStaffListToFirestore = async function() {
    if (!window.isEditing || !window.taskDocRef) return;
    try { const cleanData = JSON.parse(JSON.stringify(window.staffList, (key, value) => (value === null || value === undefined) ? "" : value)); await setDoc(window.taskDocRef, cleanData); } catch (e) { console.error(e); }
};

window.showSubTab = function(tabName) {
    const isOpen = tabName === 'open';
    document.getElementById('edit-content-open').classList.toggle('hidden', !isOpen);
    document.getElementById('edit-content-close').classList.toggle('hidden', isOpen);
    document.getElementById('view-content-open').classList.toggle('hidden', !isOpen);
    document.getElementById('view-content-close').classList.toggle('hidden', isOpen);
    document.getElementById('tab-open').className = isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    document.getElementById('tab-close').className = !isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold transition-all bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
};

window.setEditingMode = function(isEdit) {
    window.isEditing = isEdit;
    document.getElementById('view-mode-container').classList.toggle('hidden', isEdit);
    document.getElementById('edit-mode-container').classList.toggle('hidden', !isEdit);
    const b = document.getElementById('edit-mode-button'); const m = document.getElementById('master-settings-button');
    if(b){ b.textContent = isEdit?"閲覧モードに戻る":"管理者編集"; b.className = isEdit?"text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-full shadow-md":"text-xs font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-full"; }
    if(m){ m.classList.toggle('hidden', !isEdit); }
};

window.showPasswordModal = (context) => { 
    if(window.isEditing && context === 'admin'){ setEditingMode(false); return; }
    authContext = context;
    document.getElementById('password-modal').classList.remove('hidden'); 
    document.getElementById('password-input').value=""; 
    document.getElementById('password-error').classList.add('hidden'); 
    document.getElementById('password-input').focus(); 
};
window.closePasswordModal = () => document.getElementById('password-modal').classList.add('hidden');
window.checkPassword = () => { 
    if(document.getElementById('password-input').value === EDIT_PASSWORD) { 
        closePasswordModal(); 
        if(authContext === 'admin') {
            setEditingMode(true);
        } else if(authContext === 'qsc') {
            qscEditMode = true; 
            document.getElementById("qscEditButton").textContent = "✅ 完了"; 
            document.getElementById("qscAddForm").classList.remove("hidden"); 
            window.renderQSCList();
        }
    } else { 
        document.getElementById('password-error').classList.remove('hidden'); 
    } 
};

window.openFixedStaffSelect = (k, lk, t) => { 
    if(!window.isEditing)return; 
    const c = (lk.includes('early')||lk.includes('open')) ? [...window.masterStaffList.employees, ...window.masterStaffList.alba_early] : [...window.masterStaffList.employees, ...window.masterStaffList.alba_late];
    const mb=document.getElementById('select-modal-body'); mb.innerHTML=`<div class="select-modal-option text-slate-400" onclick="selectFixedStaff('${k}','')">指定なし</div>`; 
    c.sort().forEach(n=>{mb.innerHTML+=`<div class="select-modal-option ${n===window.staffList[k]?'selected':''}" onclick="selectFixedStaff('${k}','${n}')">${n}</div>`;});
    document.getElementById('select-modal-title').textContent=t; document.getElementById('select-modal').classList.remove('hidden'); 
};
window.selectFixedStaff = (k, n) => { window.staffList[k]=n; updateFixedStaffButtons(); saveStaffListToFirestore(); document.getElementById('select-modal').classList.add('hidden'); };
function updateFixedStaffButtons() {
    const btns = [
        { id: 'fixed-money_count-btn', k: 'fixed_money_count' }, 
        { id: 'fixed_open_warehouse-btn', k: 'fixed_open_warehouse' }, 
        { id: 'fixed-open_counter-btn', k: 'fixed_open_counter' }, // ★ 修正: 追加
        { id: 'fixed-money_collect-btn', k: 'fixed_money_collect' }, 
        { id: 'fixed-warehouses-btn', k: 'fixed_warehouses' }, 
        { id: 'fixed-counters-btn', k: 'fixed_counters' }
    ];
    btns.forEach(i => { const b = document.getElementById(i.id); if(b) { const s=b.querySelector('span'); if(s)s.textContent=window.staffList[i.k]||"選択してください"; b.classList.toggle('placeholder',!window.staffList[i.k]); }});
}

window.openStaffSelect = (sk, mk) => { 
    if(!window.isEditing)return; const m=window.masterStaffList[mk], c=window.staffList[sk].map(s=>s.name); const mb=document.getElementById('select-modal-body'); mb.innerHTML=''; 
    const o=m.filter(n=>!c.includes(n)); 
    if(o.length===0) mb.innerHTML='<div class="p-4 text-center text-slate-400">候補なし</div>'; else o.forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="selectStaff('${sk}','${n}')">${n}</div>`); 
    document.getElementById('select-modal-title').textContent="スタッフ追加"; document.getElementById('select-modal').classList.remove('hidden'); 
};
window.selectStaff = (sk, n) => { if(!window.staffList[sk].find(s=>s.name===n)){window.staffList[sk].push({name:n,tasks:[{start:"",end:"",task:"",remarks:""}]}); updateStaffLists(); saveStaffListToFirestore();} document.getElementById('select-modal').classList.add('hidden'); };
window.closeSelectModal = () => document.getElementById('select-modal').classList.add('hidden');

window.openTimeSelect = (sk,si,ti,f,ln) => { if(!window.isEditing)return; const l=(ln==='open')?openTimeSlots:closeTimeSlots; const mb=document.getElementById('select-modal-body'); mb.innerHTML=`<div class="select-modal-option text-slate-400" onclick="handleChange('${sk}',${si},${ti},'${f}','');closeSelectModal();updateStaffLists();">--:--</div>`; l.forEach(t=>mb.innerHTML+=`<div class="select-modal-option" onclick="handleChange('${sk}',${si},${ti},'${f}','${t}');closeSelectModal();updateStaffLists();">${t}</div>`); document.getElementById('select-modal-title').textContent="時間選択"; document.getElementById('select-modal').classList.remove('hidden'); };
window.openTaskSelect = (sk,si,ti,ln) => { 
    if(!window.isEditing)return; const availableTasks = window.specialTasks.filter(t => t.type === 'both' || t.type === ln).map(t => t.name);
    const mb=document.getElementById('select-modal-body'); mb.innerHTML=`<div class="select-modal-option text-slate-400" onclick="handleChange('${sk}',${si},${ti},'task','');closeSelectModal();updateStaffLists();">未選択</div>`; 
    availableTasks.forEach(t=>mb.innerHTML+=`<div class="select-modal-option" onclick="handleChange('${sk}',${si},${ti},'task','${t}');closeSelectModal();updateStaffLists();">${t}</div>`); 
    document.getElementById('select-modal-title').textContent="タスク選択"; document.getElementById('select-modal').classList.remove('hidden'); 
};
window.handleChange = (sk,si,ti,f,v) => { window.staffList[sk][si].tasks[ti][f]=v; saveStaffListToFirestore(); };
window.addTask = (sk,si) => { window.staffList[sk][si].tasks.push({start:"",end:"",task:"",remarks:""}); updateStaffLists(); saveStaffListToFirestore(); };
window.showDeleteModal = (t,sk,si,ti) => { deleteInfo={type:t,sectionKey:sk,staffIndex:si,taskIndex:ti}; document.getElementById('delete-modal-message').textContent=t==='staff'?`「${window.staffList[sk][si].name}」さんを削除？`:"タスクを削除？"; document.getElementById('delete-modal').classList.remove('hidden'); };
window.cancelDelete = () => document.getElementById('delete-modal').classList.add('hidden');
window.confirmDelete = () => { const {type,sectionKey,staffIndex,taskIndex}=deleteInfo; if(type==='staff'){ const n=window.staffList[sectionKey][staffIndex].name; window.staffList[sectionKey].splice(staffIndex,1); ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(k=>{if(window.staffList[k]===n)window.staffList[k]="";}); }else if(window.staffList[sectionKey][staffIndex].tasks.length>1){window.staffList[sectionKey][staffIndex].tasks.splice(taskIndex,1);} window.cancelDelete(); updateStaffLists(); generateSummaryView(); updateFixedStaffButtons(); saveStaffListToFirestore(); };

function updateStaffLists() { populate('staff-list-open-early','early','open'); populate('staff-list-open-late','late','open'); populate('staff-list-close-employee','closing_employee','close'); populate('staff-list-close-alba','closing_alba','close'); }
function populate(id,sk,ln){ const c=document.getElementById(id); if(!c)return; c.innerHTML=''; window.staffList[sk].forEach((s,si)=>{ 
    let h=''; const st=s.tasks.sort((a,b)=>(a.start||'99').localeCompare(b.start||'99')); if(st.length===0)st.push({start:"",end:"",task:"",remarks:""});
    st.forEach((t,ti)=>{
        const f=t.remarks==="（固定）", dis=f?'disabled':'';
        const act=f?`<span class="text-slate-300">×</span>`:`<button onclick="showDeleteModal('task','${sk}',${si},${ti})" class="text-rose-500">×</button>`;
        const btn=(st.length>1||ti>0)?act:`<button onclick="addTask('${sk}',${si})" class="text-slate-600">＋</button>`;
        const cls="custom-select-button text-left w-full truncate " + (t.start?'':'placeholder');
        h+=`<tr class="edit-row ${ti>0?'border-t-0':''}"><td data-label="スタッフ">${ti===0?`<div class="flex items-center gap-2"><span>${s.name}</span><button onclick="showDeleteModal('staff','${sk}',${si})" class="text-slate-300 hover:text-rose-500 ml-2">×</button></div>`:''}</td><td data-label="開始"><button class="${cls}" onclick="${!f?`openTimeSelect('${sk}',${si},${ti},'start','${ln}')`:''}" ${dis}><span>${t.start||'--'}</span></button></td><td data-label="終了"><button class="${cls}" onclick="${!f?`openTimeSelect('${sk}',${si},${ti},'end','${ln}')`:''}" ${dis}><span>${t.end||'--'}</span></button></td><td data-label="タスク"><button class="${cls}" onclick="${!f?`openTaskSelect('${sk}',${si},${ti},'${ln}')`:''}" ${dis}><span>${t.task||'未選択'}</span></button></td><td data-label="備考"><input type="text" class="w-full bg-slate-50 border border-slate-200 rounded p-1 text-sm" value="${t.remarks||''}" onchange="handleChange('${sk}',${si},${ti},'remarks',this.value)" ${f?'readonly':''}></td><td data-label="操作">${btn}</td></tr>`;
    }); c.innerHTML+=h;
});}
function generateSummaryView() {
    const r=(id,l,sl)=>{ 
        const t=[]; 
        l.forEach(s=>s.tasks.forEach(x=>{if(x.task&&!x.task.includes("FREE"))t.push({...x,name:s.name});})); 
        const n=[...new Set(l.map(s=>s.name))].sort(); 
        
        // 閲覧モードのコンテナに表示
        document.getElementById(`${id}-desktop`).innerHTML=createTable(t,n,sl); 
        document.getElementById(`${id}-mobile`).innerHTML=createList(t,n); 
        
        // ★ 修正: 編集モード (Edit Mode) のコンテナにも表示を追加
        const editDesktop = document.getElementById(`edit-${id}-desktop`);
        const editMobile = document.getElementById(`edit-${id}-mobile`);
        if (editDesktop) editDesktop.innerHTML = createTable(t,n,sl);
        if (editMobile) editMobile.innerHTML = createList(t,n);
    };
    
    r('summary-open-employee-container',window.staffList.early,openTimeSlots); 
    r('summary-open-alba-container',window.staffList.late,openAlbaTimeSlots); 
    r('summary-close-employee-container',window.staffList.closing_employee,closeTimeSlots); 
    r('summary-close-alba-container',window.staffList.closing_alba,closeTimeSlots);
}
function createTable(t,n,s){
    if(n.length===0)return '<p class="p-8 text-center text-slate-400">スタッフなし</p>';
    let h=`<div class="timeline-container"><table class="timeline-table"><thead><tr><th>STAFF</th>${s.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>`;
    const m=new Map(); s.forEach((x,i)=>m.set(x,i));
    n.forEach(name=>{
        h+=`<tr><th>${name}</th>`; const st=t.filter(x=>x.name===name).sort((a,b)=>a.start.localeCompare(b.start));
        let idx=0; while(idx<s.length){
            const slot=s[idx], task=st.find(x=>x.start===slot);
            if(task){
                const start=m.get(task.start), end=m.get(task.end); let span=1;
                if(end!==undefined&&end>start) span=end-start;
                const taskConfig = window.specialTasks.find(v=>v.name===task.task) || {class:'free-task'};
                h+=`<td colspan="${span}"><div class="task-bar ${taskConfig.class}" onclick="showRemarksModal('${task.task}','${task.start}-${task.end}','${task.remarks||''}')">${task.task}${task.remarks?'★':''}</div></td>`; idx+=span;
            }else{h+='<td></td>'; idx++;}
        } h+='</tr>';
    }); return h+'</tbody></table></div>';
}
function createList(t,n){
    if(n.length===0)return'<p class="text-center text-slate-400">なし</p>';
    let h='<div class="space-y-4">'; n.forEach(name=>{
        const st=t.filter(x=>x.name===name).sort((a,b)=>a.start.localeCompare(b.start));
        h+=`<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div class="bg-slate-50 px-4 py-2 font-bold text-slate-700 border-b border-slate-100 flex justify-between"><span>${name}</span><span class="text-xs bg-white px-2 py-1 rounded border">${st.length}</div><div class="p-2 space-y-2">`;
        if(st.length===0)h+='<div class="text-center text-xs text-slate-400">タスクなし</div>';
        st.forEach(x=>{ const taskConfig = window.specialTasks.find(v=>v.name===x.task) || {class:'free-task'}; h+=`<div class="task-bar relative top-0 left-0 w-full h-auto block p-2 ${taskConfig.class}"><div class="flex justify-between"><span>${x.task}</span><span class="opacity-70 text-xs">${x.start}-${x.end}</span></div>${x.remarks?`<div class="text-xs mt-1 border-t border-black/10 pt-1">${x.remarks}</div>`:''}</div>`; });
        h+='</div></div>';
    }); return h+'</div>';
}
window.showRemarksModal=(t,m,r)=>{document.getElementById('remarks-modal-task').textContent=t;document.getElementById('remarks-modal-time').textContent=m;document.getElementById('remarks-modal-text').textContent=r||"備考なし";document.getElementById('remarks-modal').classList.remove('hidden');};
window.closeRemarksModal=()=>document.getElementById('remarks-modal').classList.add('hidden');

function calcTime(t,m){let v=0; t.forEach(x=>{const s=m.get(x.start),e=m.get(x.end);if(s!==undefined&&e!==undefined&&e>s)v+=(e-s);}); return v;}
function isOverlap(t,s,e,m){for(const x of t){const S=m.get(x.start),E=m.get(x.end);if(S!==undefined&&E!==undefined&&S<e&&E>s)return true;}return false;}
function findStaff(g,s,e,m){let min=Infinity,tgt=null; const idx=g.map((_,i)=>i).sort(()=>Math.random()-0.5); for(const i of idx){if(isOverlap(g[i].tasks,s,e,m))continue; const v=calcTime(g[i].tasks,m); if(v<min){min=v;tgt={staff:g[i]};}} return tgt;}
function getTaskByName(name) { return window.specialTasks.find(t => t.name === name) || {name:name, slots:1}; }

window.autoAssignTasks = (sec, list) => {
    const emp=window.staffList[sec==='early'?'early':'closing_employee'], alba=window.staffList[sec==='late'?'late':'closing_alba'], all=[...emp,...alba];
    all.forEach(s=>s.tasks=[]);
    
    // =========================================================================================
    // ★ 開店作業 (OPEN) のロジック修正 (カウンター優先、清掃空き時間割り当て) ★
    // =========================================================================================
    if(list==='open'){
        const t_money = getTaskByName("金銭業務"), t_warehouse = getTaskByName("倉庫(開店)"), t_briefing = getTaskByName("朝礼");
        const t_counter = getTaskByName("カウンター開設準備");
        
        // 1. 固定タスクの割り当て
        const m=emp.find(s=>s.name===window.staffList.fixed_money_count); if(m) m.tasks.push({start:'07:00',end:'08:15',task:t_money.name,remarks:'（固定）'});
        const w=all.find(s=>s.name===window.staffList.fixed_open_warehouse); if(w) w.tasks.push({start:'09:15',end:'09:45',task:t_warehouse.name,remarks:'（固定）'});
        const c=all.find(s=>s.name===window.staffList.fixed_open_counter); 
        // ★ カウンター開設準備の固定割り当て (4コマ)
        if(c) c.tasks.push({start:'09:00',end:'10:00',task:t_counter.name,remarks:'（固定）'}); 
        
        const fixedStaffs = new Set([m, w, c].filter(Boolean).map(s => s.name));
        
        // 2. 通常タスクのルール定義
        const rules = [
            // ★ カウンター開設準備を最優先で割り当て（固定担当者なしの場合）- 確実に4コマ確保
            {n:t_counter.name, s:t_counter.slots, g:alba.filter(s=>!fixedStaffs.has(s.name)), c:1}, 
            
            {n:"抽選（準備、片付け）", s:3, g:all.filter(s => !fixedStaffs.has(s.name)), c:2}, 

            {n:"外販出し、新聞、岡持", s:1, g:emp.filter(s=>!fixedStaffs.has(s.name))},
            {n:"販促確認", s:1, g:emp.filter(s=>!fixedStaffs.has(s.name))},
            {n:"全体確認", s:1, g:emp.filter(s=>!fixedStaffs.has(s.name))},
            {n:"P台チェック", s:1, g:alba.filter(s=>!fixedStaffs.has(s.name))},
            {n:"S台チェック(ユニメモ込)", s:1, g:alba.filter(s=>!fixedStaffs.has(s.name))},
            {n:"ローラー交換", s:2, g:alba.filter(s=>!fixedStaffs.has(s.name))},
            {n:"環境整備・5M", s:1, g:alba.filter(s=>!fixedStaffs.has(s.name))},
            {n:"時差島台電落とし", s:1, g:emp.filter(s=>!fixedStaffs.has(s.name))},
        ];
        
        // 朝礼の割り当て
        all.forEach(s=>s.tasks.push({start:'09:00',end:'09:15',task:t_briefing.name,remarks:""}));
        
        // 3. 通常タスクの割り当て実行
        rules.forEach(r=>{ for(let k=0;k<(r.c||1);k++){ for(let i=0; i<openTimeSlots.length-r.s; i++) { const x=findStaff(r.g, i, i+(r.s||1), openTimeIndexMap); if(x) { x.staff.tasks.push({start:openTimeSlots[i],end:openTimeSlots[i+(r.s||1)],task:r.n,remarks:""}); break; } } } });

        // 4. ★ 島上・イーゼル清掃の空き時間割り当て（余裕がある場合のみ）★
        const t_clean = getTaskByName("島上・イーゼル清掃");
        const albaCandidatesClean = alba.filter(s=>!fixedStaffs.has(s.name));
        
        // 09:00-10:00 のスロットを対象に、空いているアルバイト全員に1コマずつ清掃を入れる
        for(let i = 0; i < openAlbaTimeSlots.length - 1; i++) {
            const startSlotIndex = openTimeIndexMap.get(openAlbaTimeSlots[i]); // 全体のインデックスを取得
            const endSlotIndex = startSlotIndex + 1; // 1コマ
            
            // i番目のスロットが空いていて、かつタスク負荷が最も低いアルバイトに割り当てる
            const staffToAssign = findStaff(albaCandidatesClean, startSlotIndex, endSlotIndex, openTimeIndexMap);
            
            if (staffToAssign) {
                 staffToAssign.staff.tasks.push({
                    start: openAlbaTimeSlots[i],
                    end: openAlbaTimeSlots[i + 1],
                    task: t_clean.name,
                    remarks: "余裕時間清掃"
                });
            }
        }

        // 5. 完全に残った空き時間に FREE を割り当て
        fillFree(all,openTimeSlots,openTimeIndexMap,emp);
    } 
    
    // =========================================================================================
    // ★ 閉店作業 (CLOSE) のロジック修正 (立駐ペアリング) ★
    // =========================================================================================
    else {
        const t_col = getTaskByName("金銭回収"), t_ware = getTaskByName("倉庫整理"), t_cnt = getTaskByName("カウンター業務");
        const fix=[{k:'fixed_money_collect',t:t_col,s:'22:45',e:'23:15',g:emp},{k:'fixed_warehouses',t:t_ware,s:'22:45',e:'23:15',g:all},{k:'fixed-counters',t:t_cnt,s:'22:45',e:'23:00',g:all}];
        const as=new Set(); fix.forEach(f=>{const s=f.g.find(p=>p.name===window.staffList[f.k]); if(s){s.tasks.push({start:f.s,end:f.e,task:f.t.name,remarks:'（固定）'}); as.add(s);}});
        
        // 1. ★ 立駐ペア割り当てロジック ★
        const employeeCandidates = emp.filter(s=>!as.has(s));
        const albaCandidates = alba.filter(s=>!as.has(s));
        const t_park_emp = getTaskByName("立駐（社員）");
        const t_park_alba = getTaskByName("立駐（アルバイト）");
        
        for(let i = 0; i < closeTimeSlots.length - 1; i++) {
            const startSlot = i; const endSlot = i + 1; // 1コマタスク
            
            // 1. そのスロットが空いている社員候補を探す
            const availableEmp = findStaff(employeeCandidates, startSlot, endSlot, closeTimeIndexMap);
            
            if (availableEmp) {
                // 2. そのスロットが空いているアルバイト候補を探す
                const availableAlba = findStaff(albaCandidates, startSlot, endSlot, closeTimeIndexMap);
                
                if (availableAlba) {
                    // 3. ペアが見つかったので両方に割り当て
                    const startTime = closeTimeSlots[startSlot];
                    const endTime = closeTimeSlots[endSlot];

                    availableEmp.staff.tasks.push({start:startTime, end:endTime, task:t_park_emp.name, remarks:"ペア立駐"});
                    availableAlba.staff.tasks.push({start:startTime, end:endTime, task:t_park_alba.name, remarks:"ペア立駐"});
                    
                    break; // 最も早いスロットで見つかったら終了
                }
            }
        }
        
        // 2. 通常タスクのルール定義 (立駐は除外)
        const rules = [
            {n:"施錠・工具箱チェック", s:1, g:emp.filter(s=>!as.has(s))}, 
            {n:"引継ぎ・事務所清掃", s:1, g:emp.filter(s=>!as.has(s))}, 
            {n:"飲み残し・フラッグ確認", s:1, g:alba.filter(s=>!as.has(s))}, 
            {n:"島上清掃・カード補充", s:1, g:alba.filter(s=>!as.has(s))},
            // 固定担当者がいない場合のフォールバックルール (既存)
            {n:t_col.name, s:t_col.slots || 2, g:emp.filter(s=>!as.has(s))},
            {n:t_ware.name, s:t_ware.slots || 2, g:all.filter(s=>!as.has(s))},
            {n:t_cnt.name, s:t_cnt.slots || 1, g:all.filter(s=>!as.has(s))}
        ];
        
        rules.forEach(r=>{ for(let k=0;k<(r.c||1);k++){ for(let i=0; i<=closeTimeSlots.length-r.s; i++) { const x=findStaff(r.g, i, i+(r.s||1), closeTimeIndexMap); if(x) { x.staff.tasks.push({start:closeTimeSlots[i],end:closeTimeSlots[i+(r.s||1)],task:r.n,remarks:""}); break; } } } });
        fillFree(all,closeTimeSlots,closeTimeIndexMap,[]);
    }
    updateStaffLists(); generateSummaryView(); saveStaffListToFirestore();
};

window.openMasterModal = () => { document.getElementById('master-modal').classList.remove('hidden'); window.renderMasterStaffLists(); window.renderMasterTaskList(); };
window.closeMasterModal = () => document.getElementById('master-modal').classList.add('hidden');
window.switchMasterTab = (tab) => {
    document.getElementById('master-content-staff').classList.toggle('hidden', tab!=='staff'); document.getElementById('master-content-task').classList.toggle('hidden', tab!=='task');
    document.getElementById('master-tab-staff').className = tab==='staff' ? "flex-1 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50" : "flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:bg-slate-50";
    document.getElementById('master-tab-task').className = tab==='task' ? "flex-1 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50" : "flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:bg-slate-50";
};
window.renderMasterStaffLists = () => {
    ['employees', 'alba_early', 'alba_late'].forEach(key => {
        const list = window.masterStaffList[key] || []; document.querySelector('.count-'+key).textContent = list.length;
        const ul = document.getElementById('master-list-'+key); ul.innerHTML = '';
        list.sort().forEach(name => { ul.innerHTML += `<li class="flex justify-between items-center bg-slate-50 p-2 rounded"><span>${name}</span><button onclick="deleteMasterStaff('${key}', '${name}')" class="text-rose-400 hover:text-rose-600 px-2">×</button></li>`; });
    });
};
window.renderMasterTaskList = () => {
    const tbody = document.getElementById('master-task-list-body'); tbody.innerHTML = '';
    window.specialTasks.forEach(task => {
        tbody.innerHTML += `<tr><td class="px-3 py-2"><div class="w-4 h-4 rounded ${task.class.replace('task-bar ', '')} border border-black/10"></div></td><td class="px-3 py-2 font-bold">${task.name}</td><td class="px-3 py-2 text-xs text-slate-500">${task.slots * 15}分</td><td class="px-3 py-2 text-xs text-slate-500">${task.type === 'both' ? '両方' : (task.type === 'open' ? '開店' : '閉店')}</td><td class="px-3 py-2 text-right"><button onclick="deleteMasterTask('${task.id}')" class="text-rose-500 hover:text-rose-700 font-bold text-xs">削除</button></td></tr>`;
    });
};
window.addMasterStaff = async (key) => { const input = document.getElementById('new-'+key+'-name'); const name = input.value.trim(); if(!name) return; if((window.masterStaffList[key]||[]).includes(name)) return alert("登録済み"); await setDoc(staffRef, { ...window.masterStaffList, [key]: [...(window.masterStaffList[key]||[]), name] }); input.value = ''; };
window.deleteMasterStaff = async (key, name) => { if(!confirm("削除しますか？")) return; await setDoc(staffRef, { ...window.masterStaffList, [key]: (window.masterStaffList[key]||[]).filter(n => n !== name) }); };
window.addMasterTask = async () => {
    const name = document.getElementById('new-task-name').value.trim(); const slots = parseInt(document.getElementById('new-task-slots').value); const color = document.getElementById('new-task-color').value; const type = document.getElementById('new-task-type').value;
    if(!name) return alert("タスク名を入力");
    const newTask = { id: 'TASK_' + Date.now(), name, slots, class: `task-bar ${color}`, type };
    await setDoc(taskDefRef, { list: [...window.specialTasks, newTask] });
    document.getElementById('new-task-name').value = '';
};
window.deleteMasterTask = async (id) => { if(!confirm("削除しますか？")) return; await setDoc(taskDefRef, { list: window.specialTasks.filter(t => t.id !== id) }); };

window.addEventListener("DOMContentLoaded", () => {
    window.fetchCustomerData(); window.subscribeQSC(); window.fetchMasterData();
    document.getElementById("qscTabUnfinished").onclick = () => { currentQscTab = '未実施'; document.getElementById("qscTabUnfinished").className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm transition-all"; document.getElementById("qscTabFinished").className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400 hover:text-slate-600 transition-all"; window.renderQSCList(); };
    document.getElementById("qscTabFinished").onclick = () => { currentQscTab = '完了'; document.getElementById("qscTabFinished").className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-green-600 shadow-sm transition-all"; document.getElementById("qscTabUnfinished").className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400 hover:text-slate-600 transition-all"; window.renderQSCList(); };
    
    document.getElementById("qscEditButton").onclick = () => { 
        if(qscEditMode) { 
            qscEditMode = false; 
            document.getElementById("qscEditButton").textContent = "⚙️ 管理"; 
            document.getElementById("qscAddForm").classList.add("hidden"); 
            window.renderQSCList(); 
        } else { 
            window.showPasswordModal('qsc');
        } 
    };
    
    document.getElementById("edit-mode-button").onclick = () => window.showPasswordModal('admin');
    document.getElementById("newOpeningButton").onclick = window.openNewOpening;
    document.getElementById("closeNewOpeningModal").onclick = () => document.getElementById("newOpeningModal").classList.add("hidden");
    document.getElementById("closeDetailModal").onclick = () => document.getElementById("machineDetailModal").classList.add("hidden");
    document.getElementById("openQSCButton").onclick = () => { document.getElementById("qscModal").classList.remove("hidden"); window.renderQSCList(); };
    document.getElementById("closeQscModal").onclick = () => document.getElementById("qscModal").classList.add("hidden");
    document.getElementById("calendarToggleButton").onclick = () => {
        const full = document.getElementById("fullCalendarContainer"), today = document.getElementById("todayEventContainer"), btn = document.getElementById("calendarToggleButton");
        if (full.classList.contains("hidden")) {
            full.classList.remove("hidden"); today.classList.add("hidden"); btn.textContent = "戻る";
            const grid = document.getElementById("calendarGrid"); grid.innerHTML = ["日","月","火","水","木","金","土"].map(d => `<div class="text-xs text-slate-300 text-center py-2">${d}</div>`).join(""); for(let i=0; i<6; i++) grid.innerHTML += `<div></div>`;
            const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            for(let i=1; i<=days; i++) {
                const ev = eventMap.get(i); const btn = document.createElement("button"); btn.className = `calendar-day ${ev&&(ev.p_event||ev.s_event)?'has-event':''}`; btn.textContent = i;
                if (i === new Date().getDate()) btn.classList.add('is-today');
                btn.onclick = () => { $$(".calendar-day").forEach(b => b.classList.remove("is-selected")); btn.classList.add("is-selected"); document.getElementById("selectedEventDetails").innerHTML = ev ? `<div class="w-full text-left"><div class="text-indigo-600 font-black mb-1">${i}日</div><ul class="space-y-1 text-sm">${ev.p_event?`<li>${ev.p_event}</li>`:''}${ev.s_event?`<li>${ev.s_event}</li>`:''}</ul></div>` : "情報なし"; };
                grid.appendChild(btn);
            }
        } else { full.classList.add("hidden"); today.classList.remove("hidden"); btn.textContent = "全体を見る"; }
    };
});
