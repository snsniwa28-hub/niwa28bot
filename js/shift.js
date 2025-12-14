import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showPasswordModal, closePasswordModal, showToast } from './ui.js';
import { $ } from './utils.js';

let shiftState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedStaff: null,
    shiftDataCache: {},
    isAdminMode: false,
    selectedDay: null
};

// --- DOM Injection (UI生成) ---
export function injectShiftButton() {
    const card = document.getElementById('shiftEntryCard');
    if (card) {
        card.onclick = openShiftUserModal;
    }
}

export function createShiftModals() {
    if (document.getElementById('shift-modal')) return;

    const modalHTML = `
    <!-- MAIN SHIFT MODAL -->
    <div id="shift-modal" class="modal-overlay hidden" style="z-index: 60;">
        <div class="modal-content p-0 w-full max-w-4xl h-[95vh] flex flex-col bg-slate-50 overflow-hidden rounded-2xl shadow-2xl">
            <!-- Header -->
            <div class="bg-white p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-10">
                <div class="flex items-center gap-3">
                    <div class="bg-emerald-600 text-white p-2 rounded-lg">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-800 text-xl leading-none">シフト提出</h3>
                        <p class="text-xs font-bold text-slate-400 mt-1">希望休・出勤入力</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button id="btn-shift-admin-login" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition">🔑 管理者一覧</button>
                    <button id="btn-close-shift" class="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div id="shift-modal-body" class="flex-1 overflow-hidden relative bg-slate-100 flex flex-col">
                <!-- 1. Staff List View -->
                <div id="shift-view-list" class="h-full overflow-y-auto p-4 sm:p-8">
                    <div class="max-w-4xl mx-auto bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                        <h4 class="text-center font-black text-slate-700 text-lg mb-6">名前を選択してください</h4>
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 px-2">
                                <span class="w-2 h-6 bg-indigo-500 rounded-full"></span>
                                <span class="font-bold text-slate-700 text-lg">社員</span>
                            </div>
                            <div id="shift-list-employees" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"></div>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-4 px-2">
                                <span class="w-2 h-6 bg-teal-500 rounded-full"></span>
                                <span class="font-bold text-slate-700 text-lg">アルバイト</span>
                            </div>
                            <div id="shift-list-alba" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"></div>
                        </div>
                    </div>
                </div>

                <!-- 2. User Calendar View -->
                <div id="shift-view-calendar" class="hidden h-full flex flex-col bg-white">
                    <div class="flex justify-between items-center px-4 py-2 bg-white border-b border-slate-200 shrink-0">
                        <button id="shift-prev-month" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">◀ 前月</button>
                        <div class="text-center">
                            <h4 id="shift-cal-title" class="text-xl font-black text-slate-800"></h4>
                            <span id="shift-staff-name" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"></span>
                        </div>
                        <button id="shift-next-month" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-sm">次月 ▶</button>
                    </div>
                    <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 shrink-0">
                        ${['日','月','火','水','木','金','土'].map((d,i) =>
                            `<div class="py-2 text-center text-xs font-black ${i===0?'text-rose-500':i===6?'text-blue-500':'text-slate-500'}">${d}</div>`
                        ).join('')}
                    </div>
                    <div id="shift-cal-grid" class="flex-1 grid grid-cols-7 gap-px bg-slate-200 p-px"></div>
                    <div class="p-3 bg-white border-t border-slate-200 shrink-0 pb-6 sm:pb-3">
                        <div id="shift-daily-remark-container" class="hidden mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                             <div class="flex items-center gap-2">
                                 <span id="shift-daily-remark-label" class="text-xs font-bold text-yellow-700 whitespace-nowrap"></span>
                                 <input type="text" id="shift-daily-remark-input" class="flex-1 bg-white border border-yellow-200 rounded px-2 py-1 text-xs" placeholder="日付ごとの備考(早退など)">
                             </div>
                        </div>
                         <div class="flex gap-2 items-center mb-2">
                            <span class="text-xs font-bold text-slate-400">月間備考:</span>
                            <input type="text" id="shift-remarks-input" class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500" placeholder="早番希望など">
                        </div>
                        <!-- Deadline Warning (Inserted dynamically) -->
                        <div id="shift-deadline-warning" class="hidden mb-2 text-center">
                            <p class="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-200 p-2 rounded-lg">今月の提出期間は終了しました（1日〜15日まで）</p>
                        </div>
                        <div class="flex gap-3">
                            <button id="btn-shift-back" class="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100">戻る</button>
                            <button id="btn-shift-submit" class="flex-[2] py-3 rounded-xl font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-200">提出する</button>
                        </div>
                    </div>
                </div>

                <!-- 3. Admin Matrix View -->
                <div id="shift-view-admin" class="hidden h-full flex flex-col bg-white">
                    <div class="flex justify-between items-center px-4 py-3 bg-slate-800 text-white shrink-0">
                        <div class="flex items-center gap-3">
                            <h4 class="font-bold text-lg">管理者ビュー</h4>
                            <div class="flex items-center gap-2 text-sm bg-slate-700 px-3 py-1 rounded-lg">
                                <button id="btn-shift-admin-prev" class="hover:text-emerald-400">◀</button>
                                <span id="shift-admin-title" class="font-mono font-bold"></span>
                                <button id="btn-shift-admin-next" class="hover:text-emerald-400">▶</button>
                            </div>
                        </div>
                        <button id="btn-shift-admin-close" class="text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">閉じる</button>
                    </div>
                    <div class="flex-1 overflow-auto relative">
                        <table class="w-full border-collapse text-sm whitespace-nowrap">
                            <thead class="sticky top-0 z-20 bg-slate-100 text-slate-600 font-bold shadow-sm">
                                <tr id="shift-admin-header-row">
                                    <th class="sticky left-0 z-30 bg-slate-100 p-2 border-b border-r border-slate-300 min-w-[100px] text-left">名前</th>
                                </tr>
                            </thead>
                            <tbody id="shift-admin-body"></tbody>
                        </table>
                    </div>
                    <div class="p-2 bg-yellow-50 text-yellow-800 text-xs font-bold text-center border-t border-yellow-100">
                        マスをタップすると「公休」を変更できます。名前横の📝は備考あり。
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- Action Select Modal (Shift) -->
    <div id="shift-action-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-6 w-full max-w-sm text-center">
             <h3 class="text-lg font-bold text-slate-800 mb-2" id="shift-action-title">日付の操作</h3>
             <p class="text-xs text-slate-500 mb-6">操作を選択してください</p>
             <div class="space-y-3">
                <button id="btn-shift-action-toggle" class="w-full py-3 rounded-xl font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100">公休 設定/解除</button>
                <button id="btn-shift-action-work" class="w-full py-3 rounded-xl font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100">出勤希望 設定/解除</button>
                <button id="btn-shift-action-note" class="w-full py-3 rounded-xl font-bold bg-yellow-50 text-yellow-600 border border-yellow-100 hover:bg-yellow-100">備考を入力</button>
                <button onclick="closeShiftActionModal()" class="w-full py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-50">キャンセル</button>
             </div>
        </div>
    </div>

    <!-- Admin Note Modal -->
    <div id="admin-note-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-6 w-full max-w-md max-h-[90vh] flex flex-col">
            <h3 class="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex justify-between items-center">
                <span>備考詳細・編集</span>
                <span id="admin-note-staff-name" class="text-sm font-normal text-slate-500"></span>
            </h3>

            <div class="flex-1 overflow-y-auto pr-2">
                <div class="mb-6">
                    <p class="text-xs font-bold text-slate-400 mb-1">月間備考</p>
                    <textarea id="admin-note-monthly-edit" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" rows="3"></textarea>
                </div>

                 <div class="mb-4">
                    <p class="text-xs font-bold text-slate-400 mb-1">デイリー備考</p>
                    <div id="admin-note-daily-list" class="space-y-3"></div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button onclick="closeAdminNoteModal()" class="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200">キャンセル</button>
                <button id="btn-save-admin-note" class="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">保存する</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Event Listeners for Shift Modal
    $('#btn-shift-admin-login').onclick = checkShiftAdminPassword;
    $('#btn-close-shift').onclick = closeShiftModal;
    $('#shift-prev-month').onclick = () => changeShiftMonth(-1);
    $('#shift-next-month').onclick = () => changeShiftMonth(1);
    $('#btn-shift-back').onclick = backToShiftList;
    $('#btn-shift-submit').onclick = saveShiftSubmission;
    $('#btn-shift-admin-prev').onclick = () => changeShiftMonth(-1);
    $('#btn-shift-admin-next').onclick = () => changeShiftMonth(1);
    $('#btn-shift-admin-close').onclick = backToShiftList;

    // --- Daily Remarks Input Listener (Attached Once) ---
    const drInput = document.getElementById('shift-daily-remark-input');
    if(drInput) {
        drInput.oninput = () => {
             if(!shiftState.selectedDay || !shiftState.selectedStaff) return;
             const name = shiftState.selectedStaff;

             // Ensure structure exists
             if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], remarks: "", daily_remarks: {} };
             if (!shiftState.shiftDataCache[name].daily_remarks) shiftState.shiftDataCache[name].daily_remarks = {};

             const val = drInput.value;
             if(val === "") {
                delete shiftState.shiftDataCache[name].daily_remarks[shiftState.selectedDay];
             } else {
                shiftState.shiftDataCache[name].daily_remarks[shiftState.selectedDay] = val;
             }
        };
    }
}

export function checkShiftAdminPassword() {
    const pwModal = document.getElementById('password-modal');
    if(pwModal) pwModal.style.zIndex = "100";
    showPasswordModal('shift_admin');
}

export function activateShiftAdminMode() {
    closePasswordModal();
    shiftState.isAdminMode = true;
    switchShiftView('admin');
}

export async function openShiftUserModal() {
    createShiftModals();
    document.getElementById('shift-modal').classList.remove('hidden');
    renderShiftStaffList();

    // Default: Next Month
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    shiftState.currentYear = d.getFullYear();
    shiftState.currentMonth = d.getMonth() + 1;
    shiftState.isAdminMode = false;
    shiftState.selectedDay = null;

    await loadAllShiftData();
    switchShiftView('list');
}

export function closeShiftModal() {
    document.getElementById('shift-modal').classList.add('hidden');
}

export function closeShiftActionModal() {
    document.getElementById('shift-action-modal').classList.add('hidden');
}

export function closeAdminNoteModal() {
    document.getElementById('admin-note-modal').classList.add('hidden');
}

export function switchShiftView(viewName) {
    ['list', 'calendar', 'admin'].forEach(v => {
        const el = document.getElementById(`shift-view-${v}`);
        if(el) el.classList.add('hidden');
    });
    const target = document.getElementById(`shift-view-${viewName}`);
    if(target) target.classList.remove('hidden');

    if (viewName === 'calendar') renderShiftCalendar();
    if (viewName === 'admin') renderShiftAdminTable();
}

export function renderShiftStaffList() {
    if (!window.masterStaffList) return;
    const render = (cid, list) => {
        const c = document.getElementById(cid);
        if(!c) return;
        c.innerHTML = '';
        list.forEach(name => {
            const btn = document.createElement('button');
            btn.className = "bg-white border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold py-4 px-2 rounded-2xl text-sm transition-all shadow-sm active:scale-95";
            btn.textContent = name;
            btn.onclick = () => selectShiftStaff(name);
            c.appendChild(btn);
        });
    };
    render('shift-list-employees', window.masterStaffList.employees || []);
    render('shift-list-alba', [...(window.masterStaffList.alba_early || []), ...(window.masterStaffList.alba_late || [])]);
}

export function selectShiftStaff(name) {
    shiftState.selectedStaff = name;
    document.getElementById('shift-staff-name').textContent = name;
    switchShiftView('calendar');
}

export function backToShiftList() {
    shiftState.selectedStaff = null;
    shiftState.isAdminMode = false;
    shiftState.selectedDay = null;
    switchShiftView('list');
}

export async function loadAllShiftData() {
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    try {
        const docRef = doc(db, "shift_submissions", docId);
        const snap = await getDoc(docRef);
        shiftState.shiftDataCache = snap.exists() ? snap.data() : {};
    } catch(e) {
        console.error("Shift Load Error:", e);
        shiftState.shiftDataCache = {};
    }
}

export function renderShiftCalendar() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-cal-title').textContent = `${y}年 ${m}月`;
    const container = document.getElementById('shift-cal-grid');
    container.innerHTML = '';
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    // Ensure cache exists for selected staff
    if (!shiftState.shiftDataCache[shiftState.selectedStaff]) {
        shiftState.shiftDataCache[shiftState.selectedStaff] = { off_days: [], work_days: [], remarks: "", daily_remarks: {} };
    }
    const staffData = shiftState.shiftDataCache[shiftState.selectedStaff];
    const offDays = staffData.off_days || [];
    const workDays = staffData.work_days || [];
    document.getElementById('shift-remarks-input').value = staffData.remarks || "";

    // Deadline Logic
    const today = new Date();
    const isDeadlinePassed = today.getDate() > 15;
    const isRestricted = !shiftState.isAdminMode && isDeadlinePassed;

    const submitBtn = document.getElementById('btn-shift-submit');
    const warningDiv = document.getElementById('shift-deadline-warning');

    if (isRestricted) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        warningDiv.classList.remove('hidden');
    } else {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        warningDiv.classList.add('hidden');
    }

    // Daily Remark UI Visibility
    const drContainer = document.getElementById('shift-daily-remark-container');
    const drLabel = document.getElementById('shift-daily-remark-label');
    const drInput = document.getElementById('shift-daily-remark-input');

    if (shiftState.selectedDay) {
        drContainer.classList.remove('hidden');
        drLabel.textContent = `${shiftState.selectedDay}日の備考:`;
        drInput.value = (staffData.daily_remarks && staffData.daily_remarks[shiftState.selectedDay]) || "";
    } else {
        drContainer.classList.add('hidden');
    }

    for (let i = 0; i < firstDay; i++) container.innerHTML += `<div class="bg-slate-100"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const isOff = offDays.includes(d);
        const isWork = workDays.includes(d);
        const isSelected = d === shiftState.selectedDay;
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        let numColor = "text-slate-700";
        if (dayOfWeek === 0) numColor = "text-rose-500";
        if (dayOfWeek === 6) numColor = "text-blue-500";

        let bgClass = 'bg-white hover:bg-emerald-50';

        if (isOff) {
            numColor = "text-white";
            bgClass = "bg-rose-500";
        } else if (isWork) {
            numColor = "text-white";
            bgClass = "bg-blue-500";
        }

        const borderClass = isSelected ? 'border-4 border-yellow-400 z-10' : 'border-transparent';

        const cell = document.createElement('div');
        cell.className = `${bgClass} ${borderClass} flex flex-col items-center justify-center cursor-pointer transition-colors select-none active:opacity-80 relative`;

        // Show indicator if daily remark exists
        const hasDailyRemark = staffData.daily_remarks && staffData.daily_remarks[d];
        const remarkIndicator = hasDailyRemark ? '<span class="absolute top-1 right-1 text-[8px]">📝</span>' : '';

        cell.innerHTML = `<span class="text-xl sm:text-2xl font-black ${numColor}">${d}</span>
          ${isOff ? '<span class="text-[10px] text-white font-bold leading-none mt-1">公休</span>' : ''}
          ${isWork ? '<span class="text-[10px] text-white font-bold leading-none mt-1">出勤</span>' : ''}
          ${remarkIndicator}`;

        cell.onclick = () => showActionSelectModal(d);

        container.appendChild(cell);
    }
}

// --- Action Select Modal Logic ---
export function showActionSelectModal(day) {
    shiftState.selectedDay = day;

    // Update daily remark input if it's already visible
    const staffData = shiftState.shiftDataCache[shiftState.selectedStaff] || { daily_remarks: {} };
    const drInput = document.getElementById('shift-daily-remark-input');
    const drLabel = document.getElementById('shift-daily-remark-label');
    if (drInput && drLabel) {
        drLabel.textContent = `${day}日の備考:`;
        drInput.value = (staffData.daily_remarks && staffData.daily_remarks[day]) || "";
    }

    const modal = document.getElementById('shift-action-modal');
    document.getElementById('shift-action-title').textContent = `${shiftState.currentMonth}/${day} の操作`;

    // Setup Buttons
    const btnToggle = document.getElementById('btn-shift-action-toggle');
    const btnWork = document.getElementById('btn-shift-action-work');
    const btnNote = document.getElementById('btn-shift-action-note');

    if(btnToggle) {
        btnToggle.onclick = () => {
            toggleShiftOffDay(day);
            closeShiftActionModal();
        };
    }

    if(btnWork) {
        btnWork.onclick = () => {
            toggleShiftWorkDay(day);
            closeShiftActionModal();
        };
    }

    if(btnNote) {
        btnNote.onclick = () => {
            const container = document.getElementById('shift-daily-remark-container');
            const input = document.getElementById('shift-daily-remark-input');
            const label = document.getElementById('shift-daily-remark-label');

            closeShiftActionModal();

            if(container) container.classList.remove('hidden');
            if(label) label.textContent = `${shiftState.selectedDay}日の備考:`;

            // Scroll to container to ensure visibility
            if(container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            if(input) {
                // Restore value just in case
                const staffData = shiftState.shiftDataCache[shiftState.selectedStaff] || { daily_remarks: {} };
                input.value = (staffData.daily_remarks && staffData.daily_remarks[shiftState.selectedDay]) || "";
                input.focus();
            }
        };
    }

    modal.classList.remove('hidden');
}

export function toggleShiftOffDay(day) {
    const name = shiftState.selectedStaff;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], remarks: "", daily_remarks: {} };

    shiftState.selectedDay = day;

    let offList = shiftState.shiftDataCache[name].off_days || [];
    let workList = shiftState.shiftDataCache[name].work_days || [];

    if (offList.includes(day)) {
        offList = offList.filter(d => d !== day);
    } else {
        offList.push(day);
        // Remove from work_days if present (Mutually exclusive)
        workList = workList.filter(d => d !== day);
    }
    shiftState.shiftDataCache[name].off_days = offList;
    shiftState.shiftDataCache[name].work_days = workList;

    if (shiftState.isAdminMode) renderShiftAdminTable();
    else renderShiftCalendar();
}

export function toggleShiftWorkDay(day) {
    const name = shiftState.selectedStaff;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], remarks: "", daily_remarks: {} };

    shiftState.selectedDay = day;

    let offList = shiftState.shiftDataCache[name].off_days || [];
    let workList = shiftState.shiftDataCache[name].work_days || [];

    if (workList.includes(day)) {
        workList = workList.filter(d => d !== day);
    } else {
        workList.push(day);
        // Remove from off_days if present
        offList = offList.filter(d => d !== day);
    }
    shiftState.shiftDataCache[name].off_days = offList;
    shiftState.shiftDataCache[name].work_days = workList;

    if (shiftState.isAdminMode) renderShiftAdminTable();
    else renderShiftCalendar();
}

export async function changeShiftMonth(delta) {
    if (!shiftState.isAdminMode && shiftState.selectedStaff) {
        const rem = document.getElementById('shift-remarks-input').value;
        if (!shiftState.shiftDataCache[shiftState.selectedStaff]) shiftState.shiftDataCache[shiftState.selectedStaff] = {};
        shiftState.shiftDataCache[shiftState.selectedStaff].remarks = rem;
    }
    let newM = shiftState.currentMonth + delta;
    let newY = shiftState.currentYear;
    if (newM > 12) { newM = 1; newY++; }
    else if (newM < 1) { newM = 12; newY--; }
    shiftState.currentMonth = newM;
    shiftState.currentYear = newY;
    await loadAllShiftData();
    if (shiftState.isAdminMode) renderShiftAdminTable();
    else renderShiftCalendar();
}

export async function saveShiftSubmission() {
    if (shiftState.isAdminMode) return;

    // Deadline Check
    if (new Date().getDate() > 15) {
        alert("提出期間が終了しています（毎月15日まで）");
        return;
    }

    const name = shiftState.selectedStaff;
    const remarks = document.getElementById('shift-remarks-input').value;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [] };
    shiftState.shiftDataCache[name].remarks = remarks;
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        const updateData = {};
        updateData[name] = shiftState.shiftDataCache[name];
        await setDoc(docRef, updateData, { merge: true });
        showToast("提出しました！");
        setTimeout(backToShiftList, 500);
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
}

export function renderShiftAdminTable() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-admin-title').textContent = `${y}年 ${m}月`;
    const daysInMonth = new Date(y, m, 0).getDate();

    const headerRow = document.getElementById('shift-admin-header-row');
    while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
    for(let d=1; d<=daysInMonth; d++) {
        const th = document.createElement('th');
        const dayOfWeek = new Date(y, m-1, d).getDay();
        const color = dayOfWeek===0?'text-rose-500':dayOfWeek===6?'text-blue-500':'text-slate-600';
        th.className = `p-2 border-b border-r border-slate-200 min-w-[40px] text-center ${color}`;
        th.textContent = d;
        headerRow.appendChild(th);
    }

    const tbody = document.getElementById('shift-admin-body');
    tbody.innerHTML = '';

    const createSection = (title, list, bgClass) => {
        if(!list || list.length === 0) return;
        const trTitle = document.createElement('tr');
        trTitle.innerHTML = `<td class="sticky left-0 z-10 p-2 font-bold text-xs ${bgClass} border-b border-r border-slate-300" colspan="${daysInMonth+1}">${title}</td>`;
        tbody.appendChild(trTitle);

        list.forEach(name => {
            const tr = document.createElement('tr');
            const data = shiftState.shiftDataCache[name] || { off_days: [] };

            // Check for monthly remark or ANY daily remark
            const hasMonthly = data.remarks && data.remarks.trim() !== "";
            const hasDaily = data.daily_remarks && Object.keys(data.daily_remarks).length > 0;
            const hasAnyRemark = hasMonthly || hasDaily;

            const dailyRemarks = data.daily_remarks || {};

            const tdName = document.createElement('td');
            tdName.className = "sticky left-0 z-10 bg-white p-2 border-b border-r border-slate-300 font-bold text-slate-700 text-xs truncate max-w-[120px]";
            tdName.innerHTML = `<div class="flex items-center justify-between"><span>${name}</span>${hasAnyRemark ? '<span class="text-lg cursor-pointer" title="備考あり">📝</span>' : ''}</div>`;

            if(hasAnyRemark) {
                tdName.onclick = () => showAdminNoteModal(name, data.remarks, dailyRemarks);
            }
            tr.appendChild(tdName);

            for(let d=1; d<=daysInMonth; d++) {
                const td = document.createElement('td');
                const isOff = data.off_days && data.off_days.includes(d);
                const isWork = data.work_days && data.work_days.includes(d);
                const dailyRemark = data.daily_remarks && data.daily_remarks[d];

                let bgCell = 'hover:bg-slate-100';
                if (isOff) bgCell = 'bg-rose-50 hover:bg-rose-100';
                else if (isWork) bgCell = 'bg-blue-50 hover:bg-blue-100';

                td.className = `border-b border-r border-slate-200 text-center cursor-pointer transition ${bgCell}`;

                let cellContent = '';
                if(isOff) cellContent = '<span class="text-rose-500 font-black">休</span>';
                else if(isWork) cellContent = '<span class="text-blue-500 font-black">出</span>';

                if (dailyRemark) {
                    cellContent += `<span class="text-[10px] block" title="${dailyRemark}">📝</span>`;
                }

                td.innerHTML = cellContent;

                // Onclick for admin cells
                td.onclick = () => {
                     shiftState.selectedStaff = name;
                     showActionSelectModal(d);
                };
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    };
    if (window.masterStaffList) {
        createSection("▼ 社員", window.masterStaffList.employees, "bg-indigo-100 text-indigo-800");
        createSection("▼ 早番", window.masterStaffList.alba_early, "bg-teal-100 text-teal-800");
        createSection("▼ 遅番", window.masterStaffList.alba_late, "bg-purple-100 text-purple-800");
    }
}

// --- Admin Note Modal Logic (Editable) ---
export function showAdminNoteModal(name, monthlyNote, dailyNotes) {
    const modal = document.getElementById('admin-note-modal');
    document.getElementById('admin-note-staff-name').textContent = name;

    // Monthly Note (Textarea)
    document.getElementById('admin-note-monthly-edit').value = monthlyNote || "";

    // Daily Notes (Inputs)
    const dailyListDiv = document.getElementById('admin-note-daily-list');
    dailyListDiv.innerHTML = '';

    // Collect all days that have remarks
    const sortedDays = (dailyNotes ? Object.keys(dailyNotes) : []).sort((a,b) => Number(a) - Number(b));

    if (sortedDays.length > 0) {
        sortedDays.forEach(day => {
            const note = dailyNotes[day];
            const div = document.createElement('div');
            div.className = "flex items-center gap-2";
            div.innerHTML = `
                <span class="w-8 text-xs font-bold text-yellow-700">${day}日</span>
                <input type="text" class="flex-1 bg-white border border-yellow-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 admin-daily-note-input" data-day="${day}" value="${note}">
            `;
            dailyListDiv.appendChild(div);
        });
    } else {
        dailyListDiv.innerHTML = '<p class="text-xs text-slate-400">デイリー備考はありません</p>';
    }

    // Attach Save Event
    const saveBtn = document.getElementById('btn-save-admin-note');
    saveBtn.onclick = () => saveAdminNote(name);

    modal.classList.remove('hidden');
}

export async function saveAdminNote(name) {
    const monthlyVal = document.getElementById('admin-note-monthly-edit').value;
    const dailyInputs = document.querySelectorAll('.admin-daily-note-input');

    // Construct new daily remarks object
    // Note: We are only editing *existing* daily remarks here.
    // If we wanted to allow adding new ones, we'd need a way to add rows.
    // Assuming the requirement implies editing the ones that show up.

    // However, if we read the current state to preserve other fields, we should be careful.
    // The modal shows a list based on what was passed.
    // We should update the cache and then firestore.

    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    const staffData = shiftState.shiftDataCache[name];

    staffData.remarks = monthlyVal;

    if (!staffData.daily_remarks) staffData.daily_remarks = {};

    dailyInputs.forEach(input => {
        const day = input.dataset.day;
        const val = input.value;
        if(val.trim() === "") {
            delete staffData.daily_remarks[day];
        } else {
            staffData.daily_remarks[day] = val;
        }
    });

    // Save to Firebase
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);

    try {
        const updateData = {};
        updateData[name] = staffData;
        await setDoc(docRef, updateData, { merge: true });

        showToast("備考を保存しました");
        closeAdminNoteModal();
        renderShiftAdminTable(); // Refresh table to update icons
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
}

// Ensure global access if needed
window.showActionSelectModal = showActionSelectModal;
window.closeShiftActionModal = closeShiftActionModal;
window.closeAdminNoteModal = closeAdminNoteModal;
window.showAdminNoteModal = showAdminNoteModal;
