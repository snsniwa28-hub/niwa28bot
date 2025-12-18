import { db } from './firebase.js';
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showPasswordModal, closePasswordModal, showToast } from './ui.js';
import { $, shuffleArray } from './utils.js';

let shiftState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedStaff: null,
    shiftDataCache: {},
    isAdminMode: false,
    selectedDay: null,
    adminSortMode: 'roster',
    staffDetails: {}, // Stores Rank, Type, ContractDays, etc.
    staffListLists: { employees: [], alba_early: [], alba_late: [] } // Sync with masters/staff_data
};

// --- Definitions ---
const RANKS = {
    EMPLOYEE: ['マネージャー', '主任', '副主任', '一般'],
    BYTE: ['チーフ', 'リーダー', 'コア', 'レギュラー']
};

const ROLES = {
    MONEY: '金',
    SUB: 'サ',
    WAREHOUSE: '倉',
    HALL: 'ホ'
};

// --- Helper Functions for Sorting ---
function getRankPriority(rank, type) {
    if (type === 'employee') {
        const idx = RANKS.EMPLOYEE.indexOf(rank);
        return idx === -1 ? 99 : idx;
    } else {
        const idx = RANKS.BYTE.indexOf(rank);
        return idx === -1 ? 99 : idx;
    }
}

function sortStaffList(list, catType) {
    list.sort((a, b) => {
        const da = shiftState.staffDetails[a] || {};
        const db = shiftState.staffDetails[b] || {};
        const ra = da.rank || (catType === 'employee' ? '一般' : 'レギュラー');
        const rb = db.rank || (catType === 'employee' ? '一般' : 'レギュラー');

        const pa = getRankPriority(ra, catType);
        const pb = getRankPriority(rb, catType);

        if (pa !== pb) return pa - pb;
        // Same rank: Name sort
        return a.localeCompare(b, 'ja');
    });
    return list;
}

// --- DOM Injection ---
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
        <div class="modal-content p-0 w-full max-w-6xl h-[95vh] flex flex-col bg-slate-50 overflow-hidden rounded-2xl shadow-2xl">
            <!-- Header -->
            <div class="bg-white p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-10">
                <div class="flex items-center gap-3">
                    <div class="bg-emerald-600 text-white p-2 rounded-lg">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-800 text-xl leading-none">シフト提出・管理</h3>
                        <p class="text-xs font-bold text-slate-400 mt-1">公休・希望提出 / 管理者承認</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button id="btn-shift-admin-login" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition">🔑 管理者メニュー</button>
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
                    <div id="shift-cal-grid" class="flex-1 grid grid-cols-7 gap-px bg-slate-200 p-px overflow-y-auto"></div>
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
                        <!-- Deadline Warning -->
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
                <div id="shift-view-admin" class="hidden h-full flex flex-col bg-white text-sm">
                    <div class="flex justify-between items-center px-4 py-3 bg-slate-800 text-white shrink-0">
                        <div class="flex items-center gap-3">
                            <h4 class="font-bold text-lg">シフト管理・作成</h4>
                            <div class="flex items-center gap-2 text-sm bg-slate-700 px-3 py-1 rounded-lg">
                                <button id="btn-shift-admin-prev" class="hover:text-emerald-400">◀</button>
                                <span id="shift-admin-title" class="font-mono font-bold"></span>
                                <button id="btn-shift-admin-next" class="hover:text-emerald-400">▶</button>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button id="btn-shift-toggle-mode" class="text-xs font-bold bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg border border-slate-400 text-white">📂 名簿順</button>
                            <button id="btn-open-staff-master" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg border border-indigo-400">👥 スタッフ管理</button>
                            <button id="btn-clear-shift" class="text-xs font-bold bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg border border-slate-400 text-white">🔄 割り振りクリア</button>
                            <button id="btn-auto-create-shift" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg border border-emerald-400">⚡ 自動作成</button>
                            <button id="btn-shift-admin-close" class="text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">閉じる</button>
                        </div>
                    </div>

                    <div class="flex-1 overflow-auto relative">
                        <table class="w-full border-collapse whitespace-nowrap">
                            <thead class="sticky top-0 z-20 bg-slate-100 text-slate-600 font-bold shadow-sm">
                                <tr id="shift-admin-header-row">
                                    <th class="sticky left-0 z-30 bg-slate-100 p-2 border-b border-r border-slate-300 min-w-[150px] text-left">
                                        名前 <span class="text-[10px] font-normal text-slate-400">(設定)</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="shift-admin-body"></tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- Staff Master Modal -->
    <div id="staff-master-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-0 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
             <div class="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 class="font-bold text-slate-800">スタッフマスタ管理</h3>
                <button onclick="document.getElementById('staff-master-modal').classList.add('hidden')" class="text-slate-400">✕</button>
             </div>
             <div class="p-2 border-b border-slate-100 flex justify-end">
                <button onclick="window.resetStaffSort()" class="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200">役職順にリセット</button>
             </div>
             <div class="p-4 overflow-y-auto flex-1 bg-slate-50">
                <div id="staff-master-list" class="space-y-4"></div>
                <button id="btn-add-staff" class="w-full mt-4 py-3 border-2 border-dashed border-slate-300 text-slate-400 font-bold rounded-xl hover:bg-white hover:text-indigo-500 transition">+ スタッフを追加</button>
             </div>
        </div>
    </div>

    <!-- Staff Edit Modal -->
    <div id="staff-edit-modal" class="modal-overlay hidden" style="z-index: 80;">
        <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-xl">
            <h3 class="font-bold text-slate-800 text-lg mb-4" id="staff-edit-title">スタッフ編集</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-500">名前</label>
                    <input type="text" id="se-name" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500">区分</label>
                        <select id="se-type" class="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white" onchange="window.updateRankOptions()">
                            <option value="employee">社員</option>
                            <option value="byte">アルバイト</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500">基本シフト</label>
                        <select id="se-basic-shift" class="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white">
                            <option value="A">A (早番)</option>
                            <option value="B">B (遅番)</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-500">役職 (ランク)</label>
                    <select id="se-rank" class="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white"></select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-500">契約日数 (目標)</label>
                    <input type="number" id="se-contract-days" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" value="20">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-500">特例許可 (スキル設定)</label>
                    <div class="grid grid-cols-2 gap-2 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" id="se-allow-money-main" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                            <span class="text-sm text-slate-700 font-bold">金銭メイン</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" id="se-allow-money-sub" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                            <span class="text-sm text-slate-700 font-bold">金銭サブ</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" id="se-allow-warehouse" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                            <span class="text-sm text-slate-700 font-bold">倉庫</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" id="se-allow-hall-resp" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                            <span class="text-sm text-slate-700 font-bold">ホ責</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button id="btn-se-delete" class="px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-xs hover:bg-rose-100">削除</button>
                <div class="flex-1"></div>
                <button onclick="document.getElementById('staff-edit-modal').classList.add('hidden')" class="px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs">キャンセル</button>
                <button id="btn-se-save" class="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-lg shadow-indigo-200">保存</button>
            </div>
        </div>
    </div>

    <!-- Action Select Modal (Shift) -->
    <div id="shift-action-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-6 w-full max-w-sm text-center">
             <h3 class="text-lg font-bold text-slate-800 mb-2" id="shift-action-title">日付の操作</h3>

             <!-- Admin Role Selection -->
             <div id="shift-admin-roles" class="hidden mb-4 grid grid-cols-2 gap-2">
                <button class="role-btn bg-yellow-100 text-yellow-800 font-bold py-2 rounded" data-role="金">金 (Main)</button>
                <button class="role-btn bg-orange-100 text-orange-800 font-bold py-2 rounded" data-role="サ">サ (Sub)</button>
                <button class="role-btn bg-blue-100 text-blue-800 font-bold py-2 rounded" data-role="倉">倉 (Whs)</button>
                <button class="role-btn bg-purple-100 text-purple-800 font-bold py-2 rounded" data-role="ホ">ホ (Hall)</button>
                <button class="role-btn bg-rose-100 text-rose-800 font-bold py-2 rounded" data-role="公休">公休</button>
                <button class="role-btn bg-slate-100 text-slate-800 font-bold py-2 rounded" data-role="">クリア</button>
             </div>

             <div id="shift-user-actions" class="space-y-3">
                <button id="btn-shift-action-toggle" class="w-full py-3 rounded-xl font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100">公休 設定/解除</button>
                <button id="btn-shift-action-work" class="w-full py-3 rounded-xl font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100">出勤希望 設定/解除</button>
                <button id="btn-shift-action-note" class="w-full py-3 rounded-xl font-bold bg-yellow-50 text-yellow-600 border border-yellow-100 hover:bg-yellow-100">備考を入力</button>
             </div>

             <input type="text" id="shift-action-daily-input" class="hidden w-full py-3 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2" placeholder="備考を入力...">

             <button onclick="closeShiftActionModal()" class="w-full mt-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-50">キャンセル</button>
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
    $('#btn-open-staff-master').onclick = openStaffMasterModal;
    $('#btn-add-staff').onclick = () => openStaffEditModal(null);
    $('#btn-se-save').onclick = saveStaffDetails;
    $('#btn-se-delete').onclick = deleteStaff;
    $('#btn-auto-create-shift').onclick = generateAutoShift;
    $('#btn-clear-shift').onclick = clearShiftAssignments;
    $('#btn-shift-toggle-mode').onclick = () => {
        shiftState.adminSortMode = shiftState.adminSortMode === 'roster' ? 'shift' : 'roster';
        renderShiftAdminTable();
    };

    // --- Daily Remarks Input Listener ---
    const drInput = document.getElementById('shift-daily-remark-input');
    if(drInput) {
        drInput.oninput = () => {
             if(!shiftState.selectedDay || !shiftState.selectedStaff) return;
             const name = shiftState.selectedStaff;

             // Ensure structure exists
             if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], assignments: {} };
             if (!shiftState.shiftDataCache[name].daily_remarks) shiftState.shiftDataCache[name].daily_remarks = {};

             const val = drInput.value;
             if(val === "") {
                delete shiftState.shiftDataCache[name].daily_remarks[shiftState.selectedDay];
             } else {
                shiftState.shiftDataCache[name].daily_remarks[shiftState.selectedDay] = val;
             }
        };
    }

    // Role button listeners
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.onclick = () => {
            setAdminRole(btn.dataset.role);
            closeShiftActionModal();
        };
    });
}

// --- Init & Data Loading ---

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

    // Default: Next Month
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    shiftState.currentYear = d.getFullYear();
    shiftState.currentMonth = d.getMonth() + 1;
    shiftState.isAdminMode = false;
    shiftState.selectedDay = null;

    await loadAllShiftData(); // Loads Shift Submissions & Staff Details
    renderShiftStaffList();
    switchShiftView('list');
}

export async function loadAllShiftData() {
    // 1. Load Staff Master Data (includes Details)
    const staffDocRef = doc(db, 'masters', 'staff_data');
    try {
        const staffSnap = await getDoc(staffDocRef);
        if (staffSnap.exists()) {
            const data = staffSnap.data();
            shiftState.staffListLists = {
                employees: data.employees || [],
                alba_early: data.alba_early || [],
                alba_late: data.alba_late || []
            };
            shiftState.staffDetails = data.staff_details || {};
        }
    } catch(e) { console.error("Staff Load Error:", e); }

    // 2. Load Shift Submissions
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

// --- View Switching ---

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

export function closeShiftModal() {
    document.getElementById('shift-modal').classList.add('hidden');
}

export function backToShiftList() {
    shiftState.selectedStaff = null;
    shiftState.isAdminMode = false;
    shiftState.selectedDay = null;
    switchShiftView('list');
}

// --- Staff List View (User Mode) ---

export function renderShiftStaffList() {
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
    render('shift-list-employees', shiftState.staffListLists.employees);
    render('shift-list-alba', [...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late]);
}

export function selectShiftStaff(name) {
    shiftState.selectedStaff = name;
    document.getElementById('shift-staff-name').textContent = name;
    switchShiftView('calendar');
}

// --- Calendar View (User Mode) ---

export function renderShiftCalendar() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-cal-title').textContent = `${y}年 ${m}月`;
    const container = document.getElementById('shift-cal-grid');
    container.innerHTML = '';
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    if (!shiftState.shiftDataCache[shiftState.selectedStaff]) {
        shiftState.shiftDataCache[shiftState.selectedStaff] = { off_days: [], work_days: [], assignments: {} };
    }
    const staffData = shiftState.shiftDataCache[shiftState.selectedStaff];
    const offDays = staffData.off_days || [];
    const workDays = staffData.work_days || [];
    const assignments = staffData.assignments || {};

    document.getElementById('shift-remarks-input').value = staffData.remarks || "";

    // Check deadlines
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

    // Daily Remarks
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
        const assignedRole = assignments[d]; // If admin confirmed

        const isSelected = d === shiftState.selectedDay;
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        let numColor = "text-slate-700";
        if (dayOfWeek === 0) numColor = "text-rose-500";
        if (dayOfWeek === 6) numColor = "text-blue-500";

        let bgClass = 'bg-white hover:bg-emerald-50';

        // Visualization Priority: Admin Confirmed > User Request
        let label = '';
        if (assignedRole) {
            if (assignedRole === '公休') {
                numColor = "text-white";
                bgClass = "bg-rose-500";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">公休</span>';
            } else {
                // Working role
                numColor = "text-white";
                bgClass = "bg-indigo-600";
                label = `<span class="text-[10px] text-white font-bold leading-none mt-1">${assignedRole}</span>`;
            }
        } else {
            // User Requests
            if (isOff) {
                numColor = "text-white";
                bgClass = "bg-rose-400 opacity-80"; // Slightly different to show it's request
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">希望休</span>';
            } else if (isWork) {
                numColor = "text-white";
                bgClass = "bg-blue-400 opacity-80";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">出勤希</span>';
            }
        }

        const borderClass = isSelected ? 'border-4 border-yellow-400 z-10' : 'border-transparent';
        const hasDailyRemark = staffData.daily_remarks && staffData.daily_remarks[d];
        const remarkIndicator = hasDailyRemark ? '<span class="absolute top-1 right-1 text-[8px]">📝</span>' : '';

        const cell = document.createElement('div');
        let cursorClass = 'cursor-pointer';
        let hoverClass = 'hover:bg-emerald-50 active:opacity-80';

        if (isRestricted) {
            cursorClass = 'cursor-default';
            hoverClass = '';
        }

        cell.className = `${bgClass} ${borderClass} flex flex-col items-center justify-center ${cursorClass} ${hoverClass} transition-colors select-none relative min-h-[60px]`;
        cell.innerHTML = `<span class="text-xl font-black ${numColor}">${d}</span>${label}${remarkIndicator}`;

        if (!isRestricted) {
            cell.onclick = () => showActionSelectModal(d);
        }
        container.appendChild(cell);
    }
}

// --- Admin Matrix View ---

export function renderShiftAdminTable() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-admin-title').textContent = `${y}年 ${m}月`;
    const daysInMonth = new Date(y, m, 0).getDate();

    // Sort Mode Handling
    const sortMode = shiftState.adminSortMode || 'roster';

    // Update Button Appearance
    const toggleBtn = document.getElementById('btn-shift-toggle-mode');
    if(toggleBtn) {
        toggleBtn.textContent = sortMode === 'roster' ? "📂 名簿順" : "⚡ シフト別";
        toggleBtn.className = sortMode === 'roster'
            ? "text-xs font-bold bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg border border-slate-400 text-white"
            : "text-xs font-bold bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg border border-amber-400 text-white";
    }

    const headerRow = document.getElementById('shift-admin-header-row');
    while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
    for(let d=1; d<=daysInMonth; d++) {
        const th = document.createElement('th');
        const dayOfWeek = new Date(y, m-1, d).getDay();
        const color = dayOfWeek===0?'text-rose-500':dayOfWeek===6?'text-blue-500':'text-slate-600';
        th.className = `p-2 border-b border-r border-slate-200 min-w-[30px] text-center ${color}`;
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
            const data = shiftState.shiftDataCache[name] || { off_days: [], work_days: [], assignments: {} };
            const details = shiftState.staffDetails[name] || {};
            const monthlySettings = (data.monthly_settings) || {};

            // Current Shift Type (A/B) for this month
            const currentType = monthlySettings.shift_type || details.basic_shift || 'A';

            // Check for remarks
            const hasMonthly = data.remarks && data.remarks.trim() !== "";
            const hasDaily = data.daily_remarks && Object.keys(data.daily_remarks).length > 0;
            const hasAnyRemark = hasMonthly || hasDaily;

            const tdName = document.createElement('td');
            tdName.className = "sticky left-0 z-10 bg-white p-2 border-b border-r border-slate-300 font-bold text-slate-700 text-xs truncate max-w-[150px]";

            // Name Cell Content
            const nameContainer = document.createElement('div');
            nameContainer.className = "flex items-center justify-between gap-2";

            // Name & Remark Icon
            const nameSpan = document.createElement('span');
            nameSpan.innerHTML = `${name} ${hasAnyRemark ? '📝' : ''}`;
            if(hasAnyRemark) {
                nameSpan.className = "cursor-pointer hover:text-indigo-600";
                nameSpan.onclick = () => showAdminNoteModal(name, data.remarks, data.daily_remarks);
            }

            // Shift Type Toggle
            const typeBtn = document.createElement('button');
            typeBtn.className = `w-6 h-6 rounded flex items-center justify-center font-black text-[10px] ${currentType==='A'?'bg-amber-100 text-amber-700':'bg-indigo-100 text-indigo-700'}`;
            typeBtn.textContent = currentType;
            typeBtn.title = "今月の早番(A)/遅番(B)切り替え";
            typeBtn.onclick = (e) => { e.stopPropagation(); toggleStaffShiftType(name, currentType); };

            nameContainer.appendChild(nameSpan);
            nameContainer.appendChild(typeBtn);
            tdName.appendChild(nameContainer);
            tr.appendChild(tdName);

            for(let d=1; d<=daysInMonth; d++) {
                const td = document.createElement('td');
                const isOffReq = data.off_days && data.off_days.includes(d);
                const isWorkReq = data.work_days && data.work_days.includes(d);
                const assignment = (data.assignments && data.assignments[d]) || null;
                const dailyRemark = data.daily_remarks && data.daily_remarks[d];

                let bgCell = 'hover:bg-slate-100';
                let cellContent = '';

                if (assignment) {
                    if (assignment === '公休') {
                         if (isOffReq) {
                             bgCell = 'bg-red-50 hover:bg-red-100';
                             cellContent = '<span class="text-red-500 font-bold text-[10px] select-none">(休)</span>';
                         } else {
                             bgCell = 'bg-white hover:bg-slate-100';
                             cellContent = '<span class="text-slate-300 font-bold text-[10px] select-none">/</span>';
                         }
                    } else {
                         // Role assigned
                         bgCell = 'bg-white hover:bg-slate-100';

                         // Check if role exists
                         const roles = ['金', 'サ', '倉', 'ホ'];
                         const hasRole = roles.some(r => assignment.includes(r));

                         if (hasRole) {
                             // Pattern 1: With Role
                             let roleColor = 'text-slate-800';
                             if(assignment.includes('金')) roleColor = 'text-yellow-600';
                             if(assignment.includes('サ')) roleColor = 'text-orange-600';
                             if(assignment.includes('倉')) roleColor = 'text-blue-600';
                             if(assignment.includes('ホ')) roleColor = 'text-purple-600';

                             const typeLabel = currentType === 'A' ? 'A早' : 'B遅';
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none -mt-0.5">
                                    <span class="text-[7px] text-slate-400 font-normal transform scale-90">${typeLabel}</span>
                                    <span class="${roleColor} font-black text-xs -mt-px">${assignment}</span>
                                </div>
                             `;
                         } else {
                             // Pattern 2: Without Role (e.g. '出勤')
                             const typeColor = currentType === 'A' ? 'text-amber-500' : 'text-indigo-500';
                             cellContent = `
                                <div class="flex items-center justify-center h-full">
                                    <span class="${typeColor} font-black text-base">${currentType}</span>
                                </div>
                             `;
                         }
                    }
                } else {
                    // Requests
                    if (isOffReq) {
                        bgCell = 'bg-red-50 hover:bg-red-100';
                        cellContent = '<span class="text-red-500 font-bold text-[10px] select-none">(休)</span>';
                    } else if (isWorkReq) {
                         bgCell = 'bg-slate-50 hover:bg-slate-100';
                        cellContent = '<span class="text-blue-300 font-bold text-[10px]">(出)</span>';
                    } else {
                        cellContent = '<span class="text-slate-200">-</span>';
                    }
                }

                if (dailyRemark) {
                    cellContent += `<span class="absolute top-0 right-0 text-[8px] text-yellow-600">●</span>`;
                }

                td.className = `border-b border-r border-slate-200 text-center cursor-pointer transition relative ${bgCell}`;
                td.innerHTML = cellContent;
                td.onclick = () => {
                     shiftState.selectedStaff = name;
                     showActionSelectModal(d);
                };
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
    };

    if (sortMode === 'roster') {
        createSection("▼ 社員", shiftState.staffListLists.employees, "bg-indigo-100 text-indigo-800");
        createSection("▼ 早番アルバイト", shiftState.staffListLists.alba_early, "bg-teal-100 text-teal-800");
        createSection("▼ 遅番アルバイト", shiftState.staffListLists.alba_late, "bg-purple-100 text-purple-800");
    } else {
        // Shift Mode
        const allNames = [
            ...shiftState.staffListLists.employees,
            ...shiftState.staffListLists.alba_early,
            ...shiftState.staffListLists.alba_late
        ];

        const listA = [];
        const listB = [];

        allNames.forEach(name => {
            const data = shiftState.shiftDataCache[name] || {};
            const details = shiftState.staffDetails[name] || {};
            const monthlySettings = (data.monthly_settings) || {};

            const type = monthlySettings.shift_type || details.basic_shift || 'A';
            if(type === 'A') listA.push(name);
            else listB.push(name);
        });

        // Custom Sort for Mixed List (Emp > Byte, then Rank > Name)
        const mixedSort = (list) => {
             return list.sort((a,b) => {
                 const da = shiftState.staffDetails[a] || {};
                 const db = shiftState.staffDetails[b] || {};

                 const typeA = da.type || 'byte';
                 const typeB = db.type || 'byte';

                 // 1. Employment Type: Employee (0) < Byte (1)
                 const isEmpA = typeA === 'employee' ? 0 : 1;
                 const isEmpB = typeB === 'employee' ? 0 : 1;
                 if (isEmpA !== isEmpB) return isEmpA - isEmpB;

                 // 2. Rank Priority
                 const ra = da.rank || (typeA === 'employee' ? '一般' : 'レギュラー');
                 const rb = db.rank || (typeB === 'employee' ? '一般' : 'レギュラー');

                 const pa = getRankPriority(ra, typeA);
                 const pb = getRankPriority(rb, typeB);

                 if(pa !== pb) return pa - pb;

                 return a.localeCompare(b, 'ja');
             });
        };

        createSection("▼ A番 (早番) チーム", mixedSort(listA), "bg-amber-100 text-amber-800");
        createSection("▼ B番 (遅番) チーム", mixedSort(listB), "bg-indigo-100 text-indigo-800");
    }
}

async function toggleStaffShiftType(name, currentType) {
    const newType = currentType === 'A' ? 'B' : 'A';
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    if (!shiftState.shiftDataCache[name].monthly_settings) shiftState.shiftDataCache[name].monthly_settings = {};

    shiftState.shiftDataCache[name].monthly_settings.shift_type = newType;

    // Save to Firestore immediately
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        const updateData = {};
        updateData[`${name}.monthly_settings`] = shiftState.shiftDataCache[name].monthly_settings;
        await setDoc(docRef, updateData, { merge: true });
        renderShiftAdminTable();
    } catch(e) {
        alert("設定保存失敗: " + e.message);
    }
}

// --- Action Select (Shared & Admin Logic) ---

export function showActionSelectModal(day) {
    shiftState.selectedDay = day;
    const name = shiftState.selectedStaff;
    const staffData = shiftState.shiftDataCache[name] || {};

    // Update input
    const drInput = document.getElementById('shift-action-daily-input');
    if (drInput) drInput.value = (staffData.daily_remarks && staffData.daily_remarks[day]) || "";

    document.getElementById('shift-action-title').textContent = `${shiftState.currentMonth}/${day} ${name}`;
    document.getElementById('shift-action-modal').classList.remove('hidden');

    const adminRolesDiv = document.getElementById('shift-admin-roles');
    const userActionsDiv = document.getElementById('shift-user-actions');
    const noteBtn = document.getElementById('btn-shift-action-note');

    if (shiftState.isAdminMode) {
        adminRolesDiv.classList.remove('hidden');
        // Explicitly show user actions (requests) for admin as well
        userActionsDiv.classList.remove('hidden');
        drInput.classList.remove('hidden');

        // Admin also gets User Action Listeners
        document.getElementById('btn-shift-action-toggle').onclick = () => { toggleShiftRequest(day, 'off'); closeShiftActionModal(); };
        document.getElementById('btn-shift-action-work').onclick = () => { toggleShiftRequest(day, 'work'); closeShiftActionModal(); };
    } else {
        adminRolesDiv.classList.add('hidden');
        userActionsDiv.classList.remove('hidden');
        drInput.classList.add('hidden');

        // Setup User Buttons
        document.getElementById('btn-shift-action-toggle').onclick = () => { toggleShiftRequest(day, 'off'); closeShiftActionModal(); };
        document.getElementById('btn-shift-action-work').onclick = () => { toggleShiftRequest(day, 'work'); closeShiftActionModal(); };
        document.getElementById('btn-shift-action-note').onclick = () => {
             // Redirect to main modal note input
             closeShiftActionModal();
             const container = document.getElementById('shift-daily-remark-container');
             const input = document.getElementById('shift-daily-remark-input');
             if(container) {
                 container.classList.remove('hidden');
                 document.getElementById('shift-daily-remark-label').textContent = `${day}日の備考:`;
                 if(input) input.focus();
             }
        };
    }
}

export function closeShiftActionModal() {
    document.getElementById('shift-action-modal').classList.add('hidden');
    // Save note if input present
    const inp = document.getElementById('shift-action-daily-input');
    if (inp && shiftState.isAdminMode && shiftState.selectedDay && shiftState.selectedStaff) {
         const val = inp.value;
         const name = shiftState.selectedStaff;
         const day = shiftState.selectedDay;
         if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { daily_remarks: {} };
         if (!shiftState.shiftDataCache[name].daily_remarks) shiftState.shiftDataCache[name].daily_remarks = {};

         if(val.trim() === "") delete shiftState.shiftDataCache[name].daily_remarks[day];
         else shiftState.shiftDataCache[name].daily_remarks[day] = val;
    }
}

// User Request Toggle
async function toggleShiftRequest(day, type) {
    const name = shiftState.selectedStaff;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], assignments: {} };

    let offList = shiftState.shiftDataCache[name].off_days || [];
    let workList = shiftState.shiftDataCache[name].work_days || [];

    if (type === 'off') {
        if (offList.includes(day)) offList = offList.filter(d => d !== day);
        else {
            offList.push(day);
            workList = workList.filter(d => d !== day); // Mutually exclusive
        }
    } else if (type === 'work') {
        if (workList.includes(day)) workList = workList.filter(d => d !== day);
        else {
            workList.push(day);
            offList = offList.filter(d => d !== day);
        }
    }

    shiftState.shiftDataCache[name].off_days = offList;
    shiftState.shiftDataCache[name].work_days = workList;

    if (shiftState.isAdminMode) {
        // Immediate Save
        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        const docRef = doc(db, "shift_submissions", docId);
        try {
            const updateData = {};
            updateData[name] = shiftState.shiftDataCache[name];
            await setDoc(docRef, updateData, { merge: true });
            renderShiftAdminTable();
        } catch(e) {
            alert("保存失敗: " + e.message);
        }
    } else {
        renderShiftCalendar();
    }
}

// Admin Set Role
async function setAdminRole(role) {
    const name = shiftState.selectedStaff;
    const day = shiftState.selectedDay;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    if (!shiftState.shiftDataCache[name].assignments) shiftState.shiftDataCache[name].assignments = {};

    if (role === "") {
        delete shiftState.shiftDataCache[name].assignments[day];
    } else {
        shiftState.shiftDataCache[name].assignments[day] = role;
    }

    // Save Daily Remark
    const noteVal = document.getElementById('shift-action-daily-input').value;
    if (!shiftState.shiftDataCache[name].daily_remarks) shiftState.shiftDataCache[name].daily_remarks = {};
    if (noteVal.trim() === "") delete shiftState.shiftDataCache[name].daily_remarks[day];
    else shiftState.shiftDataCache[name].daily_remarks[day] = noteVal;

    // Save to Firestore
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        const updateData = {};
        updateData[name] = shiftState.shiftDataCache[name];
        await setDoc(docRef, updateData, { merge: true });
        renderShiftAdminTable();
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
}

// --- Shift Submission Save (User) ---

export async function saveShiftSubmission() {
    if (shiftState.isAdminMode) return;
    const name = shiftState.selectedStaff;
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);

    // Update remarks from input
    shiftState.shiftDataCache[name].remarks = document.getElementById('shift-remarks-input').value;

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

export async function changeShiftMonth(delta) {
    let newM = shiftState.currentMonth + delta;
    let newY = shiftState.currentYear;
    if (newM > 12) { newM = 1; newY++; }
    else if (newM < 1) { newM = 12; newY--; }
    shiftState.currentMonth = newM;
    shiftState.currentYear = newY;
    await loadAllShiftData();
    if (shiftState.isAdminMode) renderShiftAdminTable();
    else {
        if(shiftState.selectedStaff) renderShiftCalendar();
    }
}

// --- Staff Master Management ---

export function openStaffMasterModal() {
    renderStaffMasterList();
    document.getElementById('staff-master-modal').classList.remove('hidden');
}

function renderStaffMasterList() {
    const listDiv = document.getElementById('staff-master-list');
    listDiv.innerHTML = '';

    // Render 3 sections
    const sections = [
        { title: '社員', key: 'employees', cat: 'employee' },
        { title: 'アルバイト (早番)', key: 'alba_early', cat: 'byte' },
        { title: 'アルバイト (遅番)', key: 'alba_late', cat: 'byte' }
    ];

    sections.forEach(sec => {
        const list = shiftState.staffListLists[sec.key];
        if (list.length > 0) {
            const h4 = document.createElement('h4');
            h4.className = "text-xs font-bold text-slate-500 mb-2 mt-4 px-2";
            h4.textContent = sec.title;
            listDiv.appendChild(h4);

            list.forEach((name, idx) => {
                const details = shiftState.staffDetails[name] || {};
                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-2";

                // Generate Badges
                const ar = details.allowed_roles || [];
                let badges = '';
                if(ar.includes('money_main')) badges += `<span class="ml-1 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">金主</span>`;
                if(ar.includes('money_sub')) badges += `<span class="ml-1 text-[10px] bg-yellow-50 text-yellow-600 px-1 rounded">金副</span>`;
                if(ar.includes('warehouse')) badges += `<span class="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">倉</span>`;
                if(ar.includes('hall_resp')) badges += `<span class="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1 rounded">ホ責</span>`;

                // Content
                div.innerHTML = `
                    <div class="flex-1">
                        <div class="font-bold text-slate-800 flex items-center">${name}${badges}</div>
                        <div class="text-xs text-slate-500">
                            ${details.rank || '-'} / 基本:${details.basic_shift || '-'} / 契約:${details.contract_days || '-'}日
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                         <div class="flex flex-col gap-1">
                            <button class="w-8 h-6 flex items-center justify-center bg-slate-100 rounded text-xs hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed btn-up">↑</button>
                            <button class="w-8 h-6 flex items-center justify-center bg-slate-100 rounded text-xs hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed btn-down">↓</button>
                         </div>
                         <button class="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 btn-edit-staff">編集</button>
                    </div>
                `;

                // Handlers
                const btnUp = div.querySelector('.btn-up');
                const btnDown = div.querySelector('.btn-down');

                if (idx === 0) btnUp.disabled = true;
                if (idx === list.length - 1) btnDown.disabled = true;

                btnUp.onclick = () => window.moveStaffUp(name);
                btnDown.onclick = () => window.moveStaffDown(name);
                div.querySelector('.btn-edit-staff').onclick = () => openStaffEditModal(name);

                listDiv.appendChild(div);
            });
        }
    });
}

function openStaffEditModal(name) {
    document.getElementById('staff-edit-modal').classList.remove('hidden');
    const isNew = !name;
    document.getElementById('staff-edit-title').textContent = isNew ? "スタッフ追加" : "スタッフ編集";

    const inputName = document.getElementById('se-name');
    inputName.value = name || "";
    inputName.disabled = !isNew;

    const details = name ? (shiftState.staffDetails[name] || {}) : {};

    document.getElementById('se-type').value = details.type || 'byte';
    document.getElementById('se-basic-shift').value = details.basic_shift || 'A';
    document.getElementById('se-contract-days').value = details.contract_days || 20;

    const ar = details.allowed_roles || [];
    document.getElementById('se-allow-money-main').checked = ar.includes('money_main');
    document.getElementById('se-allow-money-sub').checked = ar.includes('money_sub');
    document.getElementById('se-allow-warehouse').checked = ar.includes('warehouse');
    document.getElementById('se-allow-hall-resp').checked = ar.includes('hall_resp');

    window.updateRankOptions(); // Use global
    document.getElementById('se-rank').value = details.rank || '';

    // Store editing target
    document.getElementById('btn-se-save').dataset.target = name || "";
}

function updateRankOptions() {
    const type = document.getElementById('se-type').value;
    const select = document.getElementById('se-rank');
    select.innerHTML = '';
    const opts = type === 'employee' ? RANKS.EMPLOYEE : RANKS.BYTE;
    opts.forEach(r => {
        const op = document.createElement('option');
        op.value = r;
        op.textContent = r;
        select.appendChild(op);
    });
}

async function saveStaffDetails() {
    const isNew = document.getElementById('se-name').disabled === false;
    const name = document.getElementById('se-name').value.trim();
    if(!name) return alert("名前を入力してください");

    const type = document.getElementById('se-type').value;
    const rank = document.getElementById('se-rank').value;
    const basicShift = document.getElementById('se-basic-shift').value;
    const contractDays = parseInt(document.getElementById('se-contract-days').value) || 0;

    const allowedRoles = [];
    if(document.getElementById('se-allow-money-main').checked) allowedRoles.push('money_main');
    if(document.getElementById('se-allow-money-sub').checked) allowedRoles.push('money_sub');
    if(document.getElementById('se-allow-warehouse').checked) allowedRoles.push('warehouse');
    if(document.getElementById('se-allow-hall-resp').checked) allowedRoles.push('hall_resp');

    // Update Local State
    shiftState.staffDetails[name] = {
        type,
        rank,
        basic_shift: basicShift,
        contract_days: contractDays,
        allowed_roles: allowedRoles
    };

    // Update Lists (Categorization)
    let lists = shiftState.staffListLists;
    lists.employees = lists.employees.filter(n => n !== name);
    lists.alba_early = lists.alba_early.filter(n => n !== name);
    lists.alba_late = lists.alba_late.filter(n => n !== name);

    let targetList = null;
    let catType = 'byte';
    if (type === 'employee') {
        targetList = lists.employees;
        catType = 'employee';
    } else {
        if (basicShift === 'A') targetList = lists.alba_early;
        else targetList = lists.alba_late;
    }

    targetList.push(name);
    // Sort logic call
    sortStaffList(targetList, catType);

    // Save to Firestore
    const docRef = doc(db, 'masters', 'staff_data');
    try {
        await setDoc(docRef, {
            employees: lists.employees,
            alba_early: lists.alba_early,
            alba_late: lists.alba_late,
            staff_details: shiftState.staffDetails
        }, { merge: true });

        showToast("スタッフ情報を保存しました");
        document.getElementById('staff-edit-modal').classList.add('hidden');
        renderStaffMasterList();
        renderShiftAdminTable();
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
}

async function deleteStaff() {
    const name = document.getElementById('se-name').value;
    if(!name || !confirm(`本当に ${name} を削除しますか？`)) return;

    let lists = shiftState.staffListLists;
    lists.employees = lists.employees.filter(n => n !== name);
    lists.alba_early = lists.alba_early.filter(n => n !== name);
    lists.alba_late = lists.alba_late.filter(n => n !== name);

    const docRef = doc(db, 'masters', 'staff_data');
    try {
        await setDoc(docRef, {
            employees: lists.employees,
            alba_early: lists.alba_early,
            alba_late: lists.alba_late
        }, { merge: true });

        showToast("削除しました");
        document.getElementById('staff-edit-modal').classList.add('hidden');
        renderStaffMasterList();
        renderShiftAdminTable();
    } catch(e) {
        alert("削除失敗: " + e.message);
    }
}

// --- List Mutation Helpers ---

async function moveStaffUp(name) {
    const lists = shiftState.staffListLists;
    let list = null;
    if (lists.employees.includes(name)) list = lists.employees;
    else if (lists.alba_early.includes(name)) list = lists.alba_early;
    else if (lists.alba_late.includes(name)) list = lists.alba_late;

    if (!list) return;
    const idx = list.indexOf(name);
    if (idx <= 0) return;

    // Swap
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    await saveStaffListsOnly();
}

async function moveStaffDown(name) {
    const lists = shiftState.staffListLists;
    let list = null;
    if (lists.employees.includes(name)) list = lists.employees;
    else if (lists.alba_early.includes(name)) list = lists.alba_early;
    else if (lists.alba_late.includes(name)) list = lists.alba_late;

    if (!list) return;
    const idx = list.indexOf(name);
    if (idx === -1 || idx >= list.length - 1) return;

    // Swap
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    await saveStaffListsOnly();
}

async function resetStaffSort() {
    if(!confirm("全てのスタッフの並び順を役職・名前順にリセットしますか？")) return;

    sortStaffList(shiftState.staffListLists.employees, 'employee');
    sortStaffList(shiftState.staffListLists.alba_early, 'byte');
    sortStaffList(shiftState.staffListLists.alba_late, 'byte');

    await saveStaffListsOnly();
    showToast("並び順をリセットしました");
}

async function saveStaffListsOnly() {
    const docRef = doc(db, 'masters', 'staff_data');
    try {
        await setDoc(docRef, {
            employees: shiftState.staffListLists.employees,
            alba_early: shiftState.staffListLists.alba_early,
            alba_late: shiftState.staffListLists.alba_late
        }, { merge: true });
        renderStaffMasterList();
        renderShiftAdminTable();
    } catch(e) {
        console.error(e);
        showToast("並び替え保存失敗");
    }
}

// --- Auto Shift Generation Logic (Revised) ---

async function generateAutoShift() {
    if(!confirm(`${shiftState.currentYear}年${shiftState.currentMonth}月のシフトを自動作成します。\n既存の確定済みシフトは上書きされます（希望休などは保持）。\nよろしいですか？`)) return;

    const Y = shiftState.currentYear;
    const M = shiftState.currentMonth;
    const daysInMonth = new Date(Y, M, 0).getDate();

    const shifts = shiftState.shiftDataCache;
    const details = shiftState.staffDetails;
    const staffNames = [
        ...shiftState.staffListLists.employees,
        ...shiftState.staffListLists.alba_early,
        ...shiftState.staffListLists.alba_late
    ];

    const getS = (name) => {
        const d = details[name] || {};
        const s = shifts[name] || {};
        const m = s.monthly_settings || {};
        return {
            name,
            rank: d.rank || '一般',
            type: d.type || 'byte',
            contractDays: d.contract_days || 20,
            allowedRoles: d.allowed_roles || [],
            shiftType: m.shift_type || d.basic_shift || 'A',
            requests: {
                work: s.work_days || [],
                off: s.off_days || []
            },
            assignedCount: 0,
            roleCounts: { // Track role assignments count
                [ROLES.MONEY]: 0,
                [ROLES.SUB]: 0,
                [ROLES.WAREHOUSE]: 0,
                [ROLES.HALL]: 0
            }
        };
    };

    let staffObjects = staffNames.map(getS);

    const isSpecialDay = (d) => [2, 8, 12, 18, 22, 28].includes(d);
    const getRequired = (day) => {
        const date = new Date(Y, M - 1, day);
        const dayOfWeek = date.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (isWeekend && isSpecialDay(day)) return 11;
        if (isWeekend) return 10;
        return 9;
    };

    const isViceChiefOrAbove = (rank) => ['マネージャー', '主任', '副主任'].includes(rank);

    // Clear assignments
    staffNames.forEach(n => {
        if(!shifts[n]) shifts[n] = {};
        if(!shifts[n].assignments) shifts[n].assignments = {};
    });

    for (let d = 1; d <= daysInMonth; d++) {
        const reqCount = getRequired(d);

        const candidatesA = staffObjects.filter(s => s.shiftType === 'A' && !s.requests.off.includes(d));
        const candidatesB = staffObjects.filter(s => s.shiftType === 'B' && !s.requests.off.includes(d));

        const processShift = (candidates, label) => {
            let working = [];

            // Step 1: Force Include
            const forced = candidates.filter(s => s.requests.work.includes(d));
            forced.forEach(s => { if(!working.includes(s)) working.push(s); });

            // Step 2: Secure Contract Days (Ignore Capacity)
            let pool = candidates.filter(s => !working.includes(s));

            // Filter those who haven't met contract days
            let needingDays = pool.filter(s => s.assignedCount < s.contractDays);

            // Sort by deficit (descending: largest deficit first)
            needingDays.sort((a,b) => {
                const defA = a.contractDays - a.assignedCount;
                const defB = b.contractDays - b.assignedCount;
                return defB - defA;
            });

            // Add ALL of them (even if it exceeds reqCount)
            needingDays.forEach(s => working.push(s));

            // Step 3: Fill to Minimum Staffing (if count < reqCount)
            if (working.length < reqCount) {
                // Refresh pool (remove those just added)
                pool = candidates.filter(s => !working.includes(s));

                // Sort remaining by deficit (closest to target first)
                pool.sort((a,b) => {
                    const defA = a.contractDays - a.assignedCount;
                    const defB = b.contractDays - b.assignedCount;
                    return defB - defA;
                });

                while (working.length < reqCount && pool.length > 0) {
                    working.push(pool.shift());
                }
            }

            // Step 4: Assign Roles (New Logic)
            // Roles: 金(1), サ(1), 倉(1), ホ(1)
            // Priority: Min role count

            let unassigned = [...working];
            const assignedRoles = {};

            const assignRole = (roleName, filterFn, sortFn) => {
                let cands = unassigned.filter(filterFn);
                if (cands.length === 0) return;

                // Shuffle first to randomize order for equal priorities
                shuffleArray(cands);

                // Sort candidates
                cands.sort((a,b) => {
                    // Priority 1: Role Count (Equalization)
                    const countA = a.roleCounts[roleName];
                    const countB = b.roleCounts[roleName];
                    if (countA !== countB) return countA - countB;

                    // Priority 2: Custom Sort (e.g. Priority for Hall)
                    if (sortFn) return sortFn(a,b);

                    return 0;
                });

                const p = cands[0];
                assignedRoles[p.name] = roleName;
                p.roleCounts[roleName]++;
                unassigned = unassigned.filter(x => x !== p);
            };

            // 1. 金 (Money) - Checks 'money_main'
            assignRole(ROLES.MONEY, (s) => s.allowedRoles.includes('money_main'));

            // 2. サブ (Sub) - Checks 'hall_resp'
            assignRole(ROLES.SUB, (s) => s.allowedRoles.includes('hall_resp'));

            // 3. 倉庫 (Warehouse) - Checks 'warehouse'
            assignRole(ROLES.WAREHOUSE, (s) => s.allowedRoles.includes('warehouse'));

            // 4. ホ (Hall Leader)
            // Target: Employee(General) OR All Alba
            // Priority: Alba & General Employee
            assignRole(ROLES.HALL, (s) => {
                if (s.type === 'employee' && s.rank === '一般') return true;
                if (s.type === 'byte') return true;
                return false;
            }, (a,b) => {
                // Priority logic if counts are equal?
                // "Prioritize Alba and General Employee" is implicitly handled by filtering
                // since we filter for them.
                // If we allowed others, we would sort them down.
                return 0;
            });

            // Remainder: Blank (No Assignment)
            // But mark "Off" for those not working
            const notWorking = candidates.filter(s => !working.includes(s));

            // Commit
            working.forEach(s => {
                s.assignedCount++;
                const r = assignedRoles[s.name];
                if (r) {
                    if (!shifts[s.name].assignments) shifts[s.name].assignments = {};
                    shifts[s.name].assignments[d] = r;
                } else {
                    // Working but no role -> '出勤'
                    if (!shifts[s.name].assignments) shifts[s.name].assignments = {};
                    shifts[s.name].assignments[d] = '出勤';
                }
            });

            notWorking.forEach(s => {
                 if (!shifts[s.name].assignments) shifts[s.name].assignments = {};
                 shifts[s.name].assignments[d] = '公休';
            });
        };

        processShift(candidatesA, 'A');
        processShift(candidatesB, 'B');
    }

    const docId = `${Y}-${String(M).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        await setDoc(docRef, shifts, { merge: true });
        showToast("シフト自動作成完了！");
        renderShiftAdminTable();
    } catch(e) {
        alert("自動作成保存失敗: " + e.message);
    }
}

// Admin Note Modal functions
export function showAdminNoteModal(name, monthlyNote, dailyNotes) {
    const modal = document.getElementById('admin-note-modal');
    document.getElementById('admin-note-staff-name').textContent = name;
    document.getElementById('admin-note-monthly-edit').value = monthlyNote || "";

    const dailyListDiv = document.getElementById('admin-note-daily-list');
    dailyListDiv.innerHTML = '';
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

    document.getElementById('btn-save-admin-note').onclick = () => saveAdminNote(name);
    modal.classList.remove('hidden');
}

export function closeAdminNoteModal() {
    document.getElementById('admin-note-modal').classList.add('hidden');
}

async function saveAdminNote(name) {
    const monthlyVal = document.getElementById('admin-note-monthly-edit').value;
    const dailyInputs = document.querySelectorAll('.admin-daily-note-input');

    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    const staffData = shiftState.shiftDataCache[name];
    staffData.remarks = monthlyVal;
    if (!staffData.daily_remarks) staffData.daily_remarks = {};

    dailyInputs.forEach(input => {
        const day = input.dataset.day;
        const val = input.value;
        if(val.trim() === "") delete staffData.daily_remarks[day];
        else staffData.daily_remarks[day] = val;
    });

    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);

    try {
        const updateData = {};
        updateData[name] = staffData;
        await setDoc(docRef, updateData, { merge: true });
        showToast("備考を保存しました");
        closeAdminNoteModal();
        renderShiftAdminTable();
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
}

// Clear Shift Assignments
async function clearShiftAssignments() {
    if(!confirm(`${shiftState.currentYear}年${shiftState.currentMonth}月の割り振りを全てクリアします。\n希望休・出勤希望・備考は保持されます。\nよろしいですか？`)) return;

    const names = Object.keys(shiftState.shiftDataCache);
    names.forEach(name => {
        if(shiftState.shiftDataCache[name]) {
            shiftState.shiftDataCache[name].assignments = {};
        }
    });

    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);

    try {
        await setDoc(docRef, shiftState.shiftDataCache, { merge: true });
        showToast("割り振りをクリアしました");
        renderShiftAdminTable();
    } catch(e) {
        alert("クリア失敗: " + e.message);
    }
}

// Global Exports
window.showActionSelectModal = showActionSelectModal;
window.closeShiftActionModal = closeShiftActionModal;
window.closeAdminNoteModal = closeAdminNoteModal;
window.showAdminNoteModal = showAdminNoteModal;
window.clearShiftAssignments = clearShiftAssignments;
window.generateAutoShift = generateAutoShift;
window.updateRankOptions = updateRankOptions;
window.moveStaffUp = moveStaffUp;
window.moveStaffDown = moveStaffDown;
window.resetStaffSort = resetStaffSort;
