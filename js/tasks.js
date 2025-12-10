import { db } from './firebase.js';
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { TASKS_EMPLOYEE, TASKS_ALBA, MANUAL_TASK_LIST, DEFAULT_STAFF } from './config.js';
import { $, $$, getTodayDateString, openTimeSlots, closeTimeSlots, openAlbaTimeSlots, openTimeIndexMap, closeTimeIndexMap, getTaskColorClass } from './utils.js';
import { showToast, initModal, selectOptionUI, closeModal, showPasswordModal } from './ui.js';

// --- State ---
let masterStaffList = { employees: [], alba_early: [], alba_late: [] };
let specialTasks = [];
let isEditing = false;
let currentDate = '';
let staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));
let taskDocRef = null;
let unsubscribeFromTasks = null;

// Modal State
let pendingModalState = { sectionKey: null, staffIndex: null, taskIndex: null, field: null, selectedValue: null, candidatesType: null };
let pendingDelete = { action: null, targetSection: null, indices: null };

const staffRef = doc(db, 'masters', 'staff_data');
const taskDefRef = doc(db, 'masters', 'task_data');

export function fetchMasterData() {
    return new Promise((resolve) => {
        let staffLoaded = false;
        let tasksLoaded = false;

        const checkResolve = () => {
            if (staffLoaded && tasksLoaded) resolve();
        };

        onSnapshot(staffRef, (s) => {
            if(s.exists()) {
                masterStaffList = s.data();
                // Expose to window for Shift module access (as requested in prompt to minimize rewrites of shift logic which relies on window.masterStaffList)
                // Ideally shift.js should import it, but shift.js was written to use window.masterStaffList.
                window.masterStaffList = masterStaffList;
                if (window.renderMemberRaceBoard) window.renderMemberRaceBoard(); // Re-render member board if active
            }
            staffLoaded = true;
            checkResolve();
        });
        onSnapshot(taskDefRef, (s) => {
            if(s.exists()) {
                specialTasks = s.data().list || [];
                if(refreshCurrentView) refreshCurrentView();
            }
            tasksLoaded = true;
            checkResolve();
        });
    });
}

export function handleDateChange(dateString) {
    if (!dateString) dateString = getTodayDateString();
    currentDate = dateString;
    window.currentDate = dateString; // Sync global for compatibility

    const picker = $('#date-picker'); if(picker) picker.value = dateString;

    taskDocRef = doc(db, 'task_assignments', dateString);

    if (unsubscribeFromTasks) unsubscribeFromTasks();
    unsubscribeFromTasks = onSnapshot(taskDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            staffList = {
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
            staffList = JSON.parse(JSON.stringify(DEFAULT_STAFF));
        }
        refreshCurrentView();
    });
}

export function refreshCurrentView() {
    const appStaff = $('#app-staff');
    if(!appStaff || appStaff.classList.contains('hidden')) return;

    updateStaffLists();
    generateSummaryView();

    const tabOpen = $('#tab-open');
    if (tabOpen) {
        const isOpen = tabOpen.classList.contains('bg-white');
        showSubTab(isOpen ? 'open' : 'close');
    }
    setEditingMode(isEditing);
    updateFixedStaffButtons();
}

export function setupInitialView() {
    setEditingMode(false);
    showSubTab('open');
    updateStaffLists();
    generateSummaryView();
    updateFixedStaffButtons();
    const picker = $('#date-picker'); if (picker && !picker.value) picker.value = getTodayDateString();
}

export async function saveStaffListToFirestore() {
    if (!isEditing || !taskDocRef) return;
    try {
        const cleanData = JSON.parse(JSON.stringify(staffList, (key, value) => (value === null || value === undefined) ? "" : value));
        await setDoc(taskDocRef, cleanData);
    } catch (e) { console.error(e); }
}

// --- UI Switching ---
export function showSubTab(tabName) {
    const isOpen = tabName === 'open';
    $('#edit-content-open').classList.toggle('hidden', !isOpen);
    $('#edit-content-close').classList.toggle('hidden', isOpen);
    $('#view-content-open').classList.toggle('hidden', !isOpen);
    $('#view-content-close').classList.toggle('hidden', isOpen);

    $('#tab-open').className = isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";
    $('#tab-close').className = !isOpen ? "px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-indigo-600 shadow-sm" : "px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700";

    if(isEditing) renderEditTimeline(tabName);
}

export function setEditingMode(isEdit) {
    isEditing = isEdit;
    window.isEditing = isEdit; // Sync for other modules if needed

    $('#view-mode-container').classList.toggle('hidden', isEdit);
    $('#edit-mode-container').classList.toggle('hidden', !isEdit);
    const b = $('#edit-mode-button');
    if(b){ b.textContent = isEdit?"閲覧モードに戻る":"管理者編集"; b.className = isEdit?"text-xs font-bold text-white bg-indigo-600 px-4 py-2 rounded-full shadow-md":"text-xs font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-full"; }
    if(isEdit) {
        const isOpen = $('#tab-open').classList.contains('bg-white');
        renderEditTimeline(isOpen ? 'open' : 'close');
    }
}

export function toggleAdminEdit() {
    if(isEditing) {
        setEditingMode(false);
    } else {
        showPasswordModal('admin');
    }
}

export function activateAdminMode() {
    setEditingMode(true);
}

function renderEditTimeline(tabName) {
    const container = $('#editor-timeline-content');
    if (!container) return;
    const isEarly = tabName === 'open';
    const empList = (isEarly ? staffList.early : staffList.closing_employee) || [];
    const albaList = (isEarly ? staffList.late : staffList.closing_alba) || [];

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

function updateStaffLists() {
    populate('#staff-list-open-early','early'); populate('#staff-list-open-late','late');
    populate('#staff-list-close-employee','closing_employee'); populate('#staff-list-close-alba','closing_alba');
}

function populate(id, sk) {
    const c = $(id); if(!c) return; c.innerHTML = '';
    const list = staffList[sk] || [];

    list.forEach((s, si) => {
        if (!s) return;
        if(!s.tasks) s.tasks = [];
        if(s.tasks.length === 0) s.tasks.push({start:'',end:'',task:'',remarks:''});
        s.tasks.sort((a,b) => (a.start||'99').localeCompare(b.start||'99'));

        const card = document.createElement('div');
        card.className = "staff-card";

        let headerHtml = `<div class="staff-card-header"><span class="staff-name">${s.name}</span>`;
        headerHtml += `<button class="text-slate-300 hover:text-rose-500 font-bold px-2 btn-del-staff">×</button></div>`;

        let bodyHtml = `<div class="staff-card-body">`;
        s.tasks.forEach((t, ti) => {
            const isFixed = t.remarks === '（固定）';
            const delBtn = isFixed ? '' : `<button class="task-delete-btn btn-del-task">×</button>`;

            bodyHtml += `<div class="task-edit-row" data-task-idx="${ti}">`;
            bodyHtml += `${delBtn}`;

            bodyHtml += `<div class="time-group">`;
            bodyHtml += `<button class="time-btn ${t.start ? '' : 'empty'} btn-time-start" ${isFixed?'disabled':''}>${t.start || '--:--'}</button>`;
            bodyHtml += `<span class="text-slate-300 text-xs">～</span>`;
            bodyHtml += `<button class="time-btn ${t.end ? '' : 'empty'} btn-time-end" ${isFixed?'disabled':''}>${t.end || '--:--'}</button>`;
            bodyHtml += `</div>`;

            const taskColor = getTaskColorClass(t.task);
            const taskLabel = t.task || 'タスクを選択...';
            bodyHtml += `<button class="task-select-btn ${t.task ? taskColor : 'placeholder'} btn-task-sel" ${isFixed?'disabled':''}><span>${taskLabel}</span><span class="text-xs opacity-50">▼</span></button>`;

            bodyHtml += `<input class="remarks-input" placeholder="備考" value="${t.remarks||''}" ${isFixed?'readonly':''}>`;

            bodyHtml += `</div>`;
        });

        bodyHtml += `<button class="w-full py-2 text-xs font-bold text-slate-400 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:text-indigo-500 transition btn-add-task">+ タスク追加</button>`;
        bodyHtml += `</div>`;

        card.innerHTML = headerHtml + bodyHtml;

        // Attach Event Listeners
        card.querySelector('.btn-del-staff').onclick = () => confirmDeleteRequest('staff', sk, si);
        card.querySelector('.btn-add-task').onclick = () => addTask(sk, si);

        const rows = card.querySelectorAll('.task-edit-row');
        rows.forEach(row => {
            const ti = parseInt(row.getAttribute('data-task-idx'));
            const delTaskBtn = row.querySelector('.btn-del-task');
            if(delTaskBtn) delTaskBtn.onclick = () => confirmDeleteRequest('task', sk, si, ti);

            const startBtn = row.querySelector('.btn-time-start');
            if(startBtn) startBtn.onclick = () => openTimeSelect(sk, si, ti, 'start');

            const endBtn = row.querySelector('.btn-time-end');
            if(endBtn) endBtn.onclick = () => openTimeSelect(sk, si, ti, 'end');

            const taskBtn = row.querySelector('.btn-task-sel');
            if(taskBtn) taskBtn.onclick = () => openTaskSelect(sk, si, ti);

            const remInput = row.querySelector('.remarks-input');
            remInput.onchange = (e) => updateRemark(sk, si, ti, e.target.value);
        });

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

            // Re-attach listeners for tasks in summary
            $$('.task-bar-summary').forEach(el => {
                el.onclick = () => showRemarksModal(el.dataset.task, el.dataset.time, el.dataset.remarks);
            });
        } catch(e) { console.error("Summary Render Error", e); }
    };
    r('summary-open-employee-container',staffList.early,openTimeSlots); r('summary-open-alba-container',staffList.late,openAlbaTimeSlots); r('summary-close-employee-container',staffList.closing_employee,closeTimeSlots); r('summary-close-alba-container',staffList.closing_alba,closeTimeSlots);
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
                h+=`<td colspan="${span}"><div class="task-bar task-bar-summary ${taskClass}" data-task="${task.task}" data-time="${task.start}-${task.end}" data-remarks="${task.remarks||''}">${task.task}</div></td>`; idx+=span;
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

// --- Modals & Popups ---
export function showRemarksModal(t,m,r) {
    $('#remarks-modal-task').textContent=t;
    $('#remarks-modal-time').textContent=m;
    $('#remarks-modal-text').textContent=r||"備考なし";
    $('#remarks-modal').classList.remove('hidden');
}
export function closeRemarksModal() { $('#remarks-modal').classList.add('hidden'); }
export function closeSelectModal() { $('#select-modal').classList.add('hidden'); }

// Delete Logic
export function confirmDeleteRequest(action, sectionKey, idx1, idx2) {
    pendingDelete = { action: action, targetSection: sectionKey, indices: [idx1, idx2] };
    const msg = action === 'task' ? "このタスクを削除しますか？" : "このスタッフをリストから削除しますか？";
    openDeleteModal(msg);
}

export function openBulkDeleteMenu() { $('#bulk-delete-modal').classList.remove('hidden'); }
export function closeBulkDeleteModal() { $('#bulk-delete-modal').classList.add('hidden'); }

export function requestBulkDelete(action, target) {
    pendingDelete = { action: action, targetSection: target, indices: null };
    closeBulkDeleteModal();
    let msg = "";
    if (action === 'bulk_tasks') msg = (target === 'open' ? "【早番】" : "【遅番】") + "の全タスクをクリアしますか？\n(スタッフは残ります)";
    else if (action === 'bulk_staff') msg = (target === 'open' ? "【早番】" : "【遅番】") + "の人員リストを空にしますか？";
    else if (action === 'reset_all') msg = "【警告】\nこの日の全データを完全に削除しますか？\nこの操作は取り消せません。";

    openDeleteModal(msg);
}

function openDeleteModal(msg) {
    $('#delete-modal-message').innerText = msg;
    $('#delete-modal').classList.remove('hidden');
}

export function cancelDelete() {
    $('#delete-modal').classList.add('hidden');
    pendingDelete = {};
}

export async function confirmDelete() {
    const p = pendingDelete;
    $('#delete-modal').classList.add('hidden');
    if (!p.action) return;

    if (p.action === 'task') {
        const [sIdx, tIdx] = p.indices;
        staffList[p.targetSection][sIdx].tasks.splice(tIdx, 1);
    } else if (p.action === 'staff') {
        const [sIdx] = p.indices;
        const name = staffList[p.targetSection][sIdx].name;
        staffList[p.targetSection].splice(sIdx, 1);
        ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(fk=>{if(staffList[fk]===name)staffList[fk]="";});
    } else if (p.action === 'bulk_tasks') {
        const targets = p.targetSection === 'open' ? ['early', 'late'] : ['closing_employee', 'closing_alba'];
        targets.forEach(k => {
             if(staffList[k]) staffList[k].forEach(s => s.tasks = []);
        });
    } else if (p.action === 'bulk_staff') {
        const targets = p.targetSection === 'open' ? ['early', 'late'] : ['closing_employee', 'closing_alba'];
        targets.forEach(k => {
             staffList[k] = [];
        });
        const fixedKeys = p.targetSection === 'open'
            ? ['fixed_money_count','fixed_open_warehouse','fixed_open_counter']
            : ['fixed_money_collect','fixed_warehouses','fixed_counters'];
        fixedKeys.forEach(k => staffList[k] = "");
    } else if (p.action === 'reset_all') {
        ['early', 'late', 'closing_employee', 'closing_alba'].forEach(key => staffList[key] = []);
        ['fixed_money_count','fixed_open_warehouse','fixed_open_counter','fixed_money_collect','fixed_warehouses','fixed_counters'].forEach(k => staffList[k] = "");
    }

    await saveStaffListToFirestore();
    refreshCurrentView();
    pendingDelete = {};
}

// Select Modal Logic
export function selectOption(value, element) {
    selectOptionUI(element);
    pendingModalState.selectedValue = value;
}

export function confirmSelection() {
    const s = pendingModalState;
    if (s.selectedValue === null) return;

    if (s.field === 'fixed_staff') {
        setFixed(s.sectionKey, s.selectedValue, s.candidatesType);
    } else {
        staffList[s.sectionKey][s.staffIndex].tasks[s.taskIndex][s.field] = s.selectedValue;
        saveStaffListToFirestore();
        refreshCurrentView();
    }
    $('#select-modal').classList.add('hidden');
}

export function openTimeSelect(k, s, t, f) {
    pendingModalState = { sectionKey: k, staffIndex: s, taskIndex: t, field: f };
    initModal("時間選択");
    const isO = $('#tab-open').classList.contains('bg-white');
    const slots = isO ? openTimeSlots : closeTimeSlots;
    const mb = $('#select-modal-body');
    slots.forEach(tm => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = tm;
        div.onclick = () => selectOption(tm, div);
        mb.appendChild(div);
    });
}

export function openTaskSelect(k, s, t) {
    pendingModalState = { sectionKey: k, staffIndex: s, taskIndex: t, field: 'task' };
    initModal("タスク選択");
    const isEmployeeSection = (k === 'early' || k === 'closing_employee');
    const defaultList = isEmployeeSection ? TASKS_EMPLOYEE : TASKS_ALBA;
    renderTaskOptions(defaultList, true);
}

function renderTaskOptions(list, showExpandButton) {
    const mb = $('#select-modal-body');
    mb.innerHTML = '';
    list.forEach(taskName => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = taskName;
        const colorClass = getTaskColorClass(taskName);
        div.innerHTML = `<div class="flex items-center gap-3"><span class="w-3 h-3 rounded-full border border-slate-200 ${colorClass.replace('task-bar', '')}"></span><span>${taskName}</span></div>`;
        div.onclick = () => selectOption(taskName, div);
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

export function openFixedStaffSelect(k, type, title) {
    if(!isEditing) return;
    pendingModalState = { sectionKey: k, field: 'fixed_staff', candidatesType: type };
    initModal(title);
    const candidates = (type.includes('early')||type.includes('open'))
        ? [...masterStaffList.employees, ...masterStaffList.alba_early]
        : [...masterStaffList.employees, ...masterStaffList.alba_late];
    const mb = $('#select-modal-body');
    const noneDiv = document.createElement('div');
    noneDiv.className = "select-modal-option text-slate-400";
    noneDiv.textContent = "指定なし";
    noneDiv.onclick = () => { selectOption("", noneDiv); };
    mb.appendChild(noneDiv);
    candidates.sort().forEach(n => {
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = n;
        div.onclick = () => selectOption(n, div);
        mb.appendChild(div);
    });
}

export function setFixed(k, n, type) {
    staffList[k]=n;
    if(n){
        const isEmp = masterStaffList.employees.includes(n);
        let lKey = '';
        if (['fixed_money_count', 'fixed_open_warehouse', 'fixed_open_counter'].includes(k)) {
            lKey = isEmp ? 'early' : 'late';
        } else {
            lKey = isEmp ? 'closing_employee' : 'closing_alba';
        }

        let p = staffList[lKey].find(s => s && s.name === n);
        if (!p) {
            const wrongKey = (lKey === 'early') ? 'late' : (lKey === 'late') ? 'early' :
                             (lKey === 'closing_employee') ? 'closing_alba' : 'closing_employee';

            const wrongIndex = staffList[wrongKey].findIndex(s => s && s.name === n);
            if (wrongIndex !== -1) {
                p = staffList[wrongKey][wrongIndex];
                staffList[wrongKey].splice(wrongIndex, 1);
                staffList[lKey].push(p);
            } else {
                p = { name: n, tasks: [] };
                staffList[lKey].push(p);
            }
        }

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
    saveStaffListToFirestore();
    refreshCurrentView();
}

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
        const staffName = staffList[k] || "未選択";
        if (btn) {
            btn.innerHTML = `<span class="block text-[10px] text-indigo-400 font-extrabold mb-0.5 tracking-wider">${item.label}</span><span class="block text-sm font-bold text-slate-700">${staffName}</span>`;
        }
    });
}

export function updateRemark(k,s,t,v) {
    staffList[k][s].tasks[t].remarks=v;
    saveStaffListToFirestore();
}
export function addTask(k,s) {
    staffList[k][s].tasks.push({start:'',end:'',task:'',remarks:''});
    saveStaffListToFirestore();
    refreshCurrentView();
}
export function addS(k,n) {
    staffList[k].push({name:n,tasks:[{start:'',end:'',task:'',remarks:''}]});
    saveStaffListToFirestore();
    refreshCurrentView();
    $('#select-modal').classList.add('hidden');
}
export function openStaffSelect(k,mt) {
    const c=masterStaffList[mt];
    const ex=staffList[k].filter(s=>s).map(s=>s.name);
    const mb=$('#select-modal-body');
    mb.innerHTML='';
    c.filter(n=>!ex.includes(n)).forEach(n=>{
        const div = document.createElement('div');
        div.className = "select-modal-option";
        div.textContent = n;
        div.onclick = () => addS(k, n);
        mb.appendChild(div);
    });
    $('#select-modal-title').textContent="スタッフ追加";
    $('#select-modal').classList.remove('hidden');
}

// Auto Assign
export async function autoAssignSection(section) {
    await autoAssignTasks(null, section);
    showToast("自動で割り振りました！");
}

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

export async function autoAssignTasks(sec, listType) {
    try {
        if (!currentDate) currentDate = getTodayDateString();
        const isOpen = listType === 'open';
        const empKey = isOpen ? 'early' : 'closing_employee';
        const albaKey = isOpen ? 'late' : 'closing_alba';

        const employees = (staffList[empKey] || []).filter(s => s);
        const albas = (staffList[albaKey] || []).filter(s => s);
        const allStaff = [...employees, ...albas];

        // 1. Reset tasks (keep fixed)
        allStaff.forEach(s => {
            s.tasks = s.tasks.filter(t => t.remarks === '（固定）');
        });

        const fixedNames = [
            staffList.fixed_money_count,
            staffList.fixed_open_warehouse,
            staffList.fixed_open_counter,
            staffList.fixed_money_collect,
            staffList.fixed_warehouses,
            staffList.fixed_counters
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

            let empIndex = 0;
            if (freeEmployees.length > 0) {
                empTasks.forEach(task => {
                    const staff = freeEmployees[empIndex % freeEmployees.length];
                    assign(staff, task.t, task.s, task.e);
                    empIndex++;
                });
            }

            // 全員共通: 朝礼
            employees.forEach(s => {
                if (!checkOverlap(s.tasks, '09:00', '09:15')) assign(s, '朝礼', '09:00', '09:15');
            });

            // === 抽選班の割り振り (厳格な人数制限) ===
            let isWeekend = false;
            try {
                const [y, m, d] = currentDate.split('-').map(Number);
                const dayObj = new Date(y, m - 1, d);
                const dayNum = dayObj.getDay();
                isWeekend = (dayNum === 0 || dayNum === 6);
            } catch(e) {}
            const lotteryLimit = isWeekend ? 3 : 2;
            let currentLotteryCount = 0;

            const freeAlbas = albas.filter(s => !fixedNames.includes(s.name));
            let albaIdx = 0;

            // ① アルバイトから優先的に抽選班を確保
            for (let i = 0; i < lotteryLimit; i++) {
                if (albaIdx < freeAlbas.length) {
                    const s = freeAlbas[albaIdx];
                    assign(s, '朝礼', '09:00', '09:15');
                    assign(s, '抽選（準備、片付け）', '09:15', '10:00');
                    currentLotteryCount++;
                    albaIdx++; // このバイトは抽選班として消費
                }
            }

            // ② アルバイトだけで足りない場合のみ、社員を補充
            if (currentLotteryCount < lotteryLimit) {
                const needed = lotteryLimit - currentLotteryCount;
                let assignedEmp = 0;
                // ランダム性を出すため、さっきリレーで使った次の人から探す
                for (let i = 0; i < freeEmployees.length; i++) {
                    if (assignedEmp >= needed) break;
                    const s = freeEmployees[(empIndex + i) % freeEmployees.length];
                    if (!checkOverlap(s.tasks, '09:15', '10:00')) {
                        assign(s, '抽選（準備、片付け）', '09:15', '10:00');
                        assignedEmp++;
                        currentLotteryCount++;
                    }
                }
            }

            // === 残りのアルバイト作業班の割り振り ===
            // パターン: S台(30) -> ローラー(30) -> 環境(15)+清掃(15) -> 環境(15)+清掃(15)...
            let jobType = 0; // 0:S台, 1:ローラー, 2+:環境+清掃

            while (albaIdx < freeAlbas.length) {
                const s = freeAlbas[albaIdx];
                assign(s, '朝礼', '09:00', '09:15');

                if (jobType === 0) {
                    // S台担当
                    assign(s, 'S台チェック(アルバイト)', '09:15', '09:45');
                } else if (jobType === 1) {
                    // ローラー担当
                    assign(s, 'ローラー交換', '09:15', '09:45');
                } else {
                    // 環境＆清掃担当
                    assign(s, '環境整備・5M', '09:15', '09:30');
                    assign(s, '島上・イーゼル清掃', '09:30', '09:45');
                }

                albaIdx++;
                jobType++;
            }

        } else {
            // === CLOSE LOGIC ===
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
            if (!staffList.fixed_money_collect) {
                const c = employees.sort((a,b)=>a.tasks.length-b.tasks.length).find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '金銭回収', '22:45', '23:15');
            }
            if (!staffList.fixed_warehouses) {
                const c = allStaff.sort((a,b)=>a.tasks.length-b.tasks.length).find(s => !checkOverlap(s.tasks, '22:45', '23:15'));
                if(c) assign(c, '倉庫整理', '22:45', '23:15');
            }
        }

        // === Fill Free Time (隙間埋め) ===
        const slots = isOpen ? openTimeSlots : closeTimeSlots;
        allStaff.forEach(s => {
            const isEmployee = masterStaffList.employees.includes(s.name);

            for (let i = 0; i < slots.length - 1; i++) {
                const st = slots[i]; const et = slots[i+1];
                if (isOpen && st < '09:00') {
                    if (!isEmployee) continue;
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

        saveStaffListToFirestore();
        refreshCurrentView();
    } catch(e) {
        console.error(e);
        alert("割り振り処理中にエラーが発生しました: " + e.message);
    }
}
