import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, onSnapshot, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- GLOBALS ---
window.masterStaffList = { employees: [], alba_early: [], alba_late: [] };
window.specialTasks = [];
window.isEditing = false;
const EDIT_PASSWORD = "admin";
window.currentDate = '';
const DEFAULT_STAFF = { early: [], late: [], closing_employee: [], closing_alba: [], fixed_money_count: "", fixed_open_warehouse: "", fixed_money_collect: "", fixed_warehouses: "", fixed_counters: "" };
window.staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));
let deleteInfo = { type: null, sectionKey: null, staffIndex: null, taskIndex: null };
let authContext = '', qscItems = [], currentQscTab = '未実施', qscEditMode = false;
let allMachines = [], newOpeningData = [], eventMap = new Map();
const latestKeywords = ["アズールレーン", "北斗の拳11", "地獄少女7500", "海物語極", "化物語", "プリズムナナ", "バーニングエキスプレス"];

// --- HELPERS ---
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
window.getTodayDateString = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
const genSlots = (s, e) => { const r=[]; let [h,m]=s.split(':').map(Number); const [eh,em]=e.split(':').map(Number); let c=h*60+m, ed=eh*60+em; while(c<=ed){r.push(`${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`); c+=15;} return r; };
const openTimeSlots = genSlots('07:00','10:00'), closeTimeSlots = genSlots('22:45','23:30');
const openTimeIndexMap = new Map(openTimeSlots.map((t,i)=>[t,i])), closeTimeIndexMap = new Map(closeTimeSlots.map((t,i)=>[t,i]));

// --- VIEW SWITCHER ---
window.switchView = (v) => {
    window.scrollTo(0,0);
    $('#app-customer').classList.toggle('hidden', v==='staff');
    $('#app-staff').classList.toggle('hidden', v!=='staff');
    if (v==='staff' && !window.taskDocRef) { window.setupInitialView(); window.handleDateChange(window.getTodayDateString()); }
};

// --- CUSTOMER APP ---
window.fetchCustomerData = async () => {
    try {
        const [m, n, c] = await Promise.all([getDocs(collection(db,"machines")), getDocs(collection(db,"newOpening")), getDocs(collection(db,"calendar"))]);
        allMachines = m.docs.map(d=>d.data()).sort((a,b)=>a.name.localeCompare(b.name));
        newOpeningData = n.docs.map(d=>d.data());
        eventMap = new Map(c.docs.map(d=>d.data()).sort((a,b)=>a.date-b.date).map(e=>[e.date,e]));
        window.renderToday();
    } catch(e) { $('#todayEventContainer').innerHTML=`<p class="text-rose-500 text-center font-bold">データ読込失敗</p>`; }
};
window.renderToday = () => {
    const t = new Date(), d = t.getDate(), ev = eventMap.get(d);
    $('#todayEventContainer').innerHTML = ev ? `<div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 w-full"><div class="font-bold text-indigo-900 text-lg mb-2">本日のイベント</div><ul class="space-y-2 text-sm font-bold">${ev.p_event?`<li>${ev.p_event}</li>`:''}${ev.s_event?`<li>${ev.s_event}</li>`:''}</ul></div>` : `<div class="py-10 text-center text-slate-400 font-bold">イベント情報なし</div>`;
    $('#currentDate').textContent = `${t.getFullYear()}.${t.getMonth()+1}.${d}`;
};
window.openNewOpening = () => {
    const c = $('#newOpeningInfo'); c.innerHTML = "";
    if (!newOpeningData.length) { c.innerHTML = "<p class='text-center text-slate-400 py-10'>データなし</p>"; $('#newOpeningModal').classList.remove("hidden"); return; }
    const lat=[], oth=[]; newOpeningData.forEach(m => (latestKeywords.some(k=>m.name.includes(k))?lat:oth).push(m));
    const render = (l,t) => { if(l.length){ c.innerHTML+=`<h3 class="font-bold text-lg mb-2 border-b pb-1">${t}</h3>`; const u=document.createElement('ul'); u.className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"; l.sort((a,b)=>b.count-a.count).forEach(i=>{ 
        const li=document.createElement('li'); li.className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm"; const m=allMachines.find(x=>x.name.includes(i.name));
        li.innerHTML=`<div class="flex flex-col"><span class="font-bold text-slate-700">${i.name}</span>${m?.salesPitch?'<span class="text-xs text-slate-400">詳細あり</span>':''}</div><span class="text-xs font-black bg-slate-800 text-white px-2 py-1 rounded">${i.count}台</span>`;
        if(m?.salesPitch) { li.style.cursor="pointer"; li.onclick=()=>{ $('#detailName').textContent=m.name; $('#detailPitch').textContent=m.salesPitch||""; $('#machineDetailModal').classList.remove("hidden"); }; }
        u.appendChild(li); }); c.appendChild(u); }};
    render(lat,"✨ 最新導入"); render(oth,"🔄 その他");
    $('#newOpeningModal').classList.remove("hidden");
};
window.subscribeQSC = () => onSnapshot(collection(db,"qsc_items"), s => { qscItems=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.no-b.no); const u=qscItems.filter(i=>i.status==="未実施").length; $('#qscUnfinishedCount').textContent=u>0?`残り ${u} 件`:`完了`; if(!$('#qscModal').classList.contains("hidden")) window.renderQSCList(); });
window.renderQSCList = () => {
    const c=$('#qscListContainer'); c.innerHTML=""; const f=qscItems.filter(i=>currentQscTab==='未実施'?i.status==="未実施":i.status==="完了");
    if(!f.length) { c.innerHTML=`<div class="text-center py-10 text-slate-400 font-bold">項目なし</div>`; return; }
    const g={}; f.forEach(i=>{if(!g[i.area])g[i.area]=[];g[i.area].push(i);});
    for(const [a,is] of Object.entries(g)) { c.innerHTML+=`<div class="text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2">${a}</div>`; is.forEach(i=>{
        const d=document.createElement('div'); d.className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4";
        d.innerHTML = qscEditMode ? `<div class="flex-1 font-bold text-slate-700 text-sm">${i.content}</div><button onclick="deleteQscItem('${i.id}')" class="text-rose-500">×</button>` : `<div class="flex-1 font-bold text-slate-700 text-sm ${i.status==='完了'?'line-through opacity-50':''}">${i.content}</div>`;
        if(!qscEditMode){ const cb=document.createElement('input'); cb.type="checkbox"; cb.className="qsc-checkbox shrink-0"; cb.checked=i.status==="完了"; cb.onchange=()=>updateDoc(doc(db,"qsc_items",i.id),{status:cb.checked?"完了":"未実施"}); d.prepend(cb); }
        c.appendChild(d); });
    }
};
window.addQscItem = async () => { const n=$('#newQscNo').value, a=$('#newQscArea').value, c=$('#newQscContent').value; if(n&&a&&c){ await addDoc(collection(db,"qsc_items"),{no:Number(n),area:a,content:c,status:"未実施"}); $('#newQscNo').value=''; $('#newQscContent').value=''; }};
window.deleteQscItem = async (id) => { if(confirm("削除しますか？")) await deleteDoc(doc(db,"qsc_items",id)); };

// --- STAFF APP ---
let unsubscribe=null; window.taskDocRef=null;
const staffRef=doc(db,'artifacts',firebaseConfig.projectId,'public','data','masters','staff_data');
const taskDefRef=doc(db,'artifacts',firebaseConfig.projectId,'public','data','masters','task_data');

window.fetchMasterData = () => {
    onSnapshot(staffRef, s=>{if(s.exists()) window.masterStaffList=s.data();});
    onSnapshot(taskDefRef, s=>{if(s.exists()) window.specialTasks=s.data().list||[];});
};
window.handleDateChange = (ds) => {
    if(!ds) ds=window.getTodayDateString(); window.currentDate=ds; $('#date-picker').value=ds;
    window.taskDocRef=doc(db,'artifacts',firebaseConfig.projectId,'public','data','task_assignments',ds);
    if(unsubscribe) unsubscribe();
    unsubscribe = onSnapshot(window.taskDocRef, s => { window.staffList = s.exists() ? {...window.staffList, ...s.data()} : JSON.parse(JSON.stringify(DEFAULT_STAFF)); window.refreshCurrentView(); });
};
window.refreshCurrentView = () => { if(!$('#app-staff').classList.contains('hidden')){ updateStaffLists(); window.showSubTab($('#tab-open').classList.contains('bg-white')?'open':'close'); setEditingMode(window.isEditing); updateFixedButtons(); }};
window.setupInitialView = () => { setEditingMode(false); window.showSubTab('open'); updateStaffLists(); updateFixedButtons(); $('#date-picker').value=window.getTodayDateString(); };
window.saveStaffListToFirestore = async () => { if(window.isEditing && window.taskDocRef) await setDoc(window.taskDocRef, JSON.parse(JSON.stringify(window.staffList))); };

window.showSubTab = (t) => {
    const isO = t==='open';
    $('#edit-content-open').classList.toggle('hidden', !isO); $('#edit-content-close').classList.toggle('hidden', isO);
    $('#view-content-open').classList.toggle('hidden', !isO); $('#view-content-close').classList.toggle('hidden', isO);
    $('#tab-open').className = isO ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    $('#tab-close').className = !isO ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    if(window.isEditing) renderEditTimeline(t);
};
window.setEditingMode = (e) => {
    window.isEditing = e;
    $('#view-mode-container').classList.toggle('hidden', e); $('#edit-mode-container').classList.toggle('hidden', !e);
    $('#edit-mode-button').textContent = e ? "閲覧モードに戻る" : "管理者編集";
    $('#master-settings-button').classList.toggle('hidden', !e);
    if(e) renderEditTimeline($('#tab-open').classList.contains('bg-white')?'open':'close');
};

// --- AUTO ASSIGN (HARDCODED RULES) ---
const getTask = (n) => window.specialTasks.find(t=>t.name===n) || {name:n, slots:1};
const calcTime = (t,m) => t.reduce((acc,x)=>{const s=m.get(x.start),e=m.get(x.end); return (s!==undefined&&e!==undefined)?acc+(e-s):acc;},0);
const isOverlap = (t,s,e,m) => t.some(x=>{const S=m.get(x.start),E=m.get(x.end); return S!==undefined&&E!==undefined&&S<e&&E>s;});
// Score: Lower is better (prioritize less work & variety)
const findBest = (grp, sI, eI, map, tName, exNames) => {
    const c = grp.filter(p => p.name !== '浅羽駿汰' && !exNames.includes(p.name) && !isOverlap(p.tasks, sI, eI, map));
    if(!c.length) return null;
    let best=null, min=Infinity;
    c.forEach(p => {
        let score = calcTime(p.tasks, map);
        if(p.tasks.some(t=>t.task===tName)) score+=200; // Penalty for repeating same task
        if(score < min) { min=score; best=p; }
    });
    return {p:best};
};

window.autoAssignTasks = async (sec, list) => {
    const emp=window.staffList[sec==='early'?'early':'closing_employee'], alba=window.staffList[sec==='late'?'late':'closing_alba'], all=[...emp,...alba];
    all.forEach(s=>s.tasks=[]);
    
    // 1. Handle Fixed Tasks
    const fixedMap = { 'fixed_money_count':{t:'金銭業務',s:'07:00',e:'08:15'}, 'fixed_open_warehouse':{t:'倉庫番(特景)',s:'09:15',e:'09:45'}, 'fixed_money_collect':{t:'金銭回収',s:'22:45',e:'23:15'}, 'fixed_warehouses':{t:'倉庫整理',s:'22:45',e:'23:15'}, 'fixed_counters':{t:'カウンター業務',s:'22:45',e:'23:00'} };
    const fixedStaff = [];
    Object.keys(fixedMap).forEach(k => {
        const p = all.find(s=>s.name===window.staffList[k]);
        if(p){ p.tasks.push({start:fixedMap[k].s, end:fixedMap[k].e, task:getTask(fixedMap[k].t).name, remarks:'（固定）'}); fixedStaff.push(p.name); }
    });

    // 2. Define Rules (HARDCODED)
    const openRules = [
        { name: "抽選（準備、片付け）", slots: 3, count: 2, target: "all" },
        { name: "カウンター開設準備", slots: 4, count: 1, target: "alba" },
        { name: "外販出し、新聞、岡持", slots: 1, count: 1, target: "employee" },
        { name: "P台チェック", slots: 1, count: 1, target: "employee" },
        { name: "販促確認", slots: 1, count: 1, target: "employee" },
        { name: "全体確認", slots: 1, count: 1, target: "employee" },
        { name: "ローラー交換", slots: 2, count: 1, target: "alba" },
        { name: "P台チェック", slots: 1, count: 1, target: "alba" },
        { name: "S台チェック(ユニメモ込)", slots: 1, count: 1, target: "alba" },
        { name: "環境整備・5M", slots: 1, count: 1, target: "alba" },
        { name: "時差島台電落とし", slots: 1, count: 1, target: "employee" }
    ];
    const closeRules = [
        { name: "立駐（社員）", slots: 1, count: 1, target: "employee" },
        { name: "立駐（アルバイト）", slots: 1, count: 1, target: "alba" },
        { name: "施錠・工具箱チェック", slots: 1, count: 1, target: "employee" },
        { name: "引継ぎ・事務所清掃", slots: 1, count: 1, target: "employee" },
        { name: "飲み残し・フラッグ確認", slots: 1, count: 1, target: "alba" },
        { name: "島上清掃・カード補充", slots: 1, count: 1, target: "alba" }
    ];

    const isO = list==='open';
    const targetRules = isO ? openRules : closeRules;
    const slots = isO ? openTimeSlots : closeTimeSlots;
    const tMap = isO ? openTimeIndexMap : closeTimeIndexMap;
    
    if(isO) all.forEach(s=>s.tasks.push({start:'09:00',end:'09:15',task:'朝礼',remarks:''}));

    // 3. Assign Tasks
    targetRules.forEach(r => {
        let group = [];
        if(r.target==='all') group=all; else if(r.target==='employee') group=emp; else if(r.target==='alba') group=alba;
        
        for(let k=0; k<r.count; k++){
            // Start time: Open & not Employee & not Chusen = 9:15(idx 9)
            const startIdx = (isO && r.target!=='employee' && !r.name.includes('抽選')) ? 9 : 0;
            
            for(let i=startIdx; i<=slots.length-r.slots; i++){
                const res = findBest(group, i, i+r.slots, tMap, r.name, fixedStaff);
                if(res){
                    res.p.tasks.push({start:slots[i], end:slots[i+r.slots], task:r.name, remarks:""});
                    break; // Assigned one instance
                }
            }
        }
    });
    
    // 4. Fill Free Time
    const tFree = "個人業務、自由時間";
    all.forEach(s => {
        const startI = (isO && emp.includes(s)) ? 0 : (isO?9:0);
        for(let i=startI; i<slots.length-1; i++){
            if(!isOverlap(s.tasks, i, i+1, tMap)) s.tasks.push({start:slots[i], end:slots[i+1], task:tFree, remarks:""});
        }
        s.tasks.sort((a,b)=>(a.start||"").localeCompare(b.start||""));
    });

    saveStaffListToFirestore(); window.refreshCurrentView();
};

// --- TIMELINE (READ ONLY) ---
function renderEditTimeline(tab) {
    const c = $('#editor-timeline-content'); if(!c)return;
    const isO=tab==='open', emp=isO?window.staffList.early:window.staffList.closing_employee, alba=isO?window.staffList.late:window.staffList.closing_alba, all=[...emp,...alba];
    const slots=isO?openTimeSlots:closeTimeSlots, map=isO?openTimeIndexMap:closeTimeIndexMap;
    if(!all.length){ c.innerHTML="<p class='text-xs text-slate-400'>スタッフなし</p>"; return; }
    
    let h = `<div class="relative min-w-[800px] border border-slate-200 rounded bg-white select-none"><div class="flex border-b bg-slate-50 text-xs font-bold sticky top-0 z-10"><div class="w-24 shrink-0 p-2 border-r bg-slate-50 sticky left-0 z-20">STAFF</div><div class="flex-1 flex">`;
    slots.forEach(t=>h+=`<div class="flex-1 text-center py-2 border-r">${t}</div>`);
    h += `</div></div>`;
    
    all.forEach(s => {
        h += `<div class="flex border-b h-12 relative"><div class="w-24 shrink-0 p-2 border-r text-xs font-bold flex items-center bg-white sticky left-0 z-10 truncate">${s.name}</div><div class="flex-1 flex relative">`;
        slots.forEach(()=> h+=`<div class="flex-1 border-r"></div>`);
        s.tasks.forEach(t=>{
            if(!t.start) return;
            const si=map.get(t.start), ei=map.get(t.end); if(si===undefined||ei===undefined)return;
            const w=(ei-si)/slots.length*100, l=si/slots.length*100;
            const tc=window.specialTasks.find(x=>x.name===t.task)||{class:'color-gray'};
            h+=`<div class="absolute top-1 bottom-1 rounded text-[10px] font-bold text-slate-700 flex items-center justify-center shadow-sm border ${tc.class}" style="left:${l}%;width:${w}%"><span class="truncate px-1">${t.task}</span></div>`;
        });
        h += `</div></div>`;
    });
    h += `</div>`; c.innerHTML=h;
}

// --- UI LIST & MODALS ---
function populate(id,sk){ const c=$(id); if(!c)return; c.innerHTML=''; window.staffList[sk].forEach((s,si)=>{ let h=''; s.tasks.sort((a,b)=>(a.start||'99').localeCompare(b.start||'99')).forEach((t,ti)=>{ 
    const f=t.remarks==='（固定）', del=f?'':`<button onclick="delTask('${sk}',${si},${ti})" class="text-rose-500">×</button>`, add=`<button onclick="addTask('${sk}',${si})" class="text-slate-600">＋</button>`;
    h+=`<tr class="edit-row"><td data-label="氏名">${ti===0?`${s.name} <button onclick="delStaff('${sk}',${si})" class="text-slate-300 ml-2">×</button>`:''}</td><td><button class="custom-select-button" onclick="${!f?`selTime('${sk}',${si},${ti},'start')`:''}">${t.start||'--'}</button></td><td><button class="custom-select-button" onclick="${!f?`selTime('${sk}',${si},${ti},'end')`:''}">${t.end||'--'}</button></td><td><button class="custom-select-button" onclick="${!f?`selTask('${sk}',${si},${ti})`:''}">${t.task||'--'}</button></td><td><input class="w-full bg-slate-50 border rounded p-1" value="${t.remarks||''}" onchange="upd('${sk}',${si},${ti},'remarks',this.value)" ${f?'readonly':''}></td><td>${ti>0||s.tasks.length>1?del:add}</td></tr>`;
}); c.innerHTML+=h; }); }
function updateStaffLists(){ populate('#staff-list-open-early','early'); populate('#staff-list-open-late','late'); populate('#staff-list-close-employee','closing_employee'); populate('#staff-list-close-alba','closing_alba'); }
function updateFixedButtons(){ const ids=['fixed_money_count','fixed_open_warehouse','fixed_money_collect','fixed_warehouses','fixed_counters']; ids.forEach(k=>{ const b=$(`#${k.replace(/_/g,'-')}-btn span`); if(b) b.textContent=window.staffList[k]||"選択"; }); }

window.selTime=(k,s,t,f)=>{ const isO=$('#tab-open').classList.contains('bg-white'), slots=isO?openTimeSlots:closeTimeSlots; const mb=$('#select-modal-body'); mb.innerHTML=''; slots.forEach(tm=>mb.innerHTML+=`<div class="select-modal-option" onclick="upd('${k}',${s},${t},'${f}','${tm}');$('#select-modal').classList.add('hidden')">${tm}</div>`); $('#select-modal').classList.remove('hidden'); };
window.selTask=(k,s,t)=>{ const mb=$('#select-modal-body'); mb.innerHTML=''; window.specialTasks.forEach(zk=>mb.innerHTML+=`<div class="select-modal-option" onclick="upd('${k}',${s},${t},'task','${zk.name}');$('#select-modal').classList.add('hidden')">${zk.name}</div>`); $('#select-modal').classList.remove('hidden'); };
window.upd=(k,s,t,f,v)=>{ window.staffList[k][s].tasks[t][f]=v; saveStaffListToFirestore(); window.refreshCurrentView(); };
window.addTask=(k,s)=>{ window.staffList[k][s].tasks.push({start:'',end:'',task:'',remarks:''}); saveStaffListToFirestore(); window.refreshCurrentView(); };
window.delTask=(k,s,t)=>{ if(confirm("削除？")){ window.staffList[k][s].tasks.splice(t,1); saveStaffListToFirestore(); window.refreshCurrentView(); } };
window.delStaff=(k,s)=>{ if(confirm("スタッフ削除？")){ const n=window.staffList[k][s].name; window.staffList[k].splice(s,1); ['fixed_money_count','fixed_open_warehouse','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(fk=>{if(window.staffList[fk]===n)window.staffList[fk]="";}); saveStaffListToFirestore(); window.refreshCurrentView(); } };

// Fixed Staff Select & Auto Add
window.openFixedStaffSelect=(fk, candType)=>{ const c=(candType.includes('early')||candType.includes('open'))?[...window.masterStaffList.employees,...window.masterStaffList.alba_early]:[...window.masterStaffList.employees,...window.masterStaffList.alba_late]; const mb=$('#select-modal-body'); mb.innerHTML=`<div class="select-modal-option text-slate-400" onclick="setFixed('${fk}','','${candType}')">なし</div>`; c.sort().forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="setFixed('${fk}','${n}','${candType}')">${n}</div>`); $('#select-modal').classList.remove('hidden'); };
window.setFixed=(fk,name,type)=>{
    window.staffList[fk]=name;
    if(name){
        const isEmp=window.masterStaffList.employees.includes(name);
        let listKey = '';
        if(type.includes('early')) listKey='early'; else if(type.includes('open')) listKey=isEmp?'early':'late'; else listKey=isEmp?'closing_employee':'closing_alba';
        let p = window.staffList[listKey].find(s=>s.name===name);
        if(!p){ p={name,tasks:[]}; window.staffList[listKey].push(p); }
        // Set Task
        const defs={'fixed_money_count':{t:'金銭業務',s:'07:00',e:'08:15'},'fixed_open_warehouse':{t:'倉庫番(特景)',s:'09:15',e:'09:45'},'fixed_money_collect':{t:'金銭回収',s:'22:45',e:'23:15'},'fixed_warehouses':{t:'倉庫整理',s:'22:45',e:'23:15'},'fixed_counters':{t:'カウンター業務',s:'22:45',e:'23:00'}};
        const d=defs[fk];
        if(d){ p.tasks=p.tasks.filter(t=>t.remarks!=='（固定）'&&t.task!==d.t); p.tasks.push({start:d.s,end:d.e,task:d.t,remarks:'（固定）'}); p.tasks.sort((a,b)=>a.start.localeCompare(b.start)); }
    }
    saveStaffListToFirestore(); window.refreshCurrentView(); $('#select-modal').classList.add('hidden');
};

// Staff Add
window.openStaffSelect=(k,mt)=>{ const c=window.masterStaffList[mt], ex=window.staffList[k].map(s=>s.name); const mb=$('#select-modal-body'); mb.innerHTML=''; c.filter(n=>!ex.includes(n)).forEach(n=>mb.innerHTML+=`<div class="select-modal-option" onclick="addS('${k}','${n}')">${n}</div>`); $('#select-modal').classList.remove('hidden'); };
window.addS=(k,n)=>{ window.staffList[k].push({name:n,tasks:[{start:'',end:'',task:'',remarks:''}]}); saveStaffListToFirestore(); window.refreshCurrentView(); $('#select-modal').classList.add('hidden'); };

// Auth & Init
window.checkPassword=()=>{ if($('#password-input').value===EDIT_PASSWORD){ $('#password-modal').classList.add('hidden'); if(authContext==='admin') setEditingMode(true); else { qscEditMode=true; $('#qscAddForm').classList.remove('hidden'); window.renderQSCList(); } } };
window.addEventListener("DOMContentLoaded", () => {
    window.fetchCustomerData(); window.subscribeQSC(); window.fetchMasterData();
    $('#qscEditButton').onclick=()=>{ if(qscEditMode){qscEditMode=false;$('#qscAddForm').classList.add('hidden');window.renderQSCList();}else{authContext='qsc';$('#password-modal').classList.remove('hidden');} };
    $('#edit-mode-button').onclick=()=>{ if(window.isEditing)setEditingMode(false); else{authContext='admin';$('#password-modal').classList.remove('hidden');} };
    // Other inits skipped for brevity (calendar etc same as before)
});
