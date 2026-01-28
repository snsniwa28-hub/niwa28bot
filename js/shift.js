import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showPasswordModal, closePasswordModal, showToast, showConfirmModal } from './ui.js';
import { $, getHolidays } from './utils.js';

let shiftState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedStaff: null,
    shiftDataCache: {},
    isAdminMode: false,
    selectedDay: null,
    adminSortMode: 'roster',
    staffDetails: {},
    staffListLists: { employees: [], alba_early: [], alba_late: [] },
    historyStack: [],
    earlyWarehouseMode: false,
    adjustmentMode: false, // New Switch State
    prevMonthCache: null,
    currentStaffTab: 'early',
    autoShiftSettings: { money: true, warehouse: true, hall_resp: true } // New
};

const RANKS = {
    EMPLOYEE: ['マネージャー', '主任', '副主任', '一般'],
    BYTE: ['チーフ', 'リーダー', 'コア', 'レギュラー']
};

const ROLES = {
    MONEY: '金メ',
    MONEY_SUB: '金サブ',
    HALL_RESP: 'ホ責',
    WAREHOUSE: '倉庫',
    HALL: 'ホ',
    OFF: '公休',
    GENERIC_A: 'A早',
    GENERIC_B: 'B遅',
    PAID: '有休',
    SPECIAL: '特休',
    SLASH: '/',
    WORK: '出勤',
    BLANK: ''
};

const renderRoleBadges = (roles) => {
    if (!roles || !roles.length) return '';
    let html = '<div class="flex flex-wrap gap-0.5 mt-1">';
    if (roles.includes('money_main')) html += '<span class="px-1 py-0.5 rounded text-[9px] font-bold bg-yellow-100 text-yellow-800 leading-none">金</span>';
    if (roles.includes('money_sub')) html += '<span class="px-1 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 leading-none">副</span>';
    if (roles.includes('warehouse')) html += '<span class="px-1 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 leading-none">倉</span>';
    if (roles.includes('hall_resp')) html += '<span class="px-1 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 leading-none">責</span>';
    html += '</div>';
    return html;
};

function showLoading() {
    let el = document.getElementById('shift-loading-overlay');
    if(!el) {
        el = document.createElement('div');
        el.id = 'shift-loading-overlay';
        el.className = 'loading-overlay hidden';
        el.innerHTML = `<div class="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-emerald-500"></div>`;
        document.body.appendChild(el);
    }
    el.classList.remove('hidden');
}

function hideLoading() {
    const el = document.getElementById('shift-loading-overlay');
    if(el) el.classList.add('hidden');
}

// --- DOM Injection ---

export function injectShiftButton() {
    const card = document.getElementById('shiftEntryCard');
    if (card) {
        card.onclick = openShiftUserModal;
    }
}

export function createShiftModals() {
    if (document.getElementById('shift-main-view')) return;

    const html = `
    <!-- FULL SCREEN SHIFT VIEW -->
    <div id="shift-main-view" class="fixed inset-0 z-[60] bg-slate-50 transform transition-transform duration-300 translate-x-full flex flex-col font-main font-sans">

        <header class="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-20 shadow-sm">
            <button id="btn-close-shift-view" class="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition py-2">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                <span class="font-bold text-sm hidden sm:inline">戻る</span>
            </button>
            <div class="flex items-center gap-2 sm:gap-4">
                <div class="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h2 class="font-black text-slate-800 text-lg sm:text-xl tracking-tight">シフト管理</h2>
            </div>
            <button id="btn-shift-admin-login" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-lg transition flex items-center gap-2">
                <span>🔒</span> <span class="hidden sm:inline">管理者</span>
            </button>
        </header>

        <div id="shift-content-area" class="flex-1 overflow-hidden relative">
            <!-- 1. Staff List View -->
            <div id="shift-view-list" class="h-full overflow-y-auto p-4 sm:p-8 bg-slate-50">
                <div class="max-w-4xl mx-auto">
                    <div class="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 text-center">
                        <h3 class="font-black text-slate-700 text-xl sm:text-2xl mb-2">スタッフ選択</h3>
                        <p class="text-slate-400 text-sm font-bold mb-6">ご自身の名前を選択してシフトを入力してください</p>

                        <!-- Tabs -->
                        <div class="flex flex-wrap justify-center gap-2 mb-8">
                            <button id="btn-tab-early" class="px-6 py-2 rounded-full bg-indigo-600 text-white font-bold text-sm shadow-md transition-all" onclick="window.switchStaffTab('early')">☀️ 早番 (Early)</button>
                            <button id="btn-tab-late" class="px-6 py-2 rounded-full bg-white text-slate-500 font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all" onclick="window.switchStaffTab('late')">🌙 遅番 (Late)</button>
                            <button id="btn-tab-employee" class="px-6 py-2 rounded-full bg-white text-slate-500 font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all" onclick="window.switchStaffTab('employee')">👔 社員 (Employee)</button>
                        </div>

                        <div id="shift-staff-list-container" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 text-left"></div>
                    </div>
                </div>
            </div>

            <!-- 2. Individual Calendar View -->
            <div id="shift-view-calendar" class="hidden h-full flex flex-col bg-white">
                <div class="flex justify-between items-center px-4 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
                    <button id="shift-prev-month" class="p-2 hover:bg-slate-50 rounded-lg text-slate-400 font-bold transition">◀</button>
                    <div class="text-center">
                        <h4 id="shift-cal-title" class="text-lg font-black text-slate-800 font-num"></h4>
                        <div id="shift-cal-stats" class="text-xs font-bold text-slate-500 mt-1"></div>
                        <span id="shift-staff-name" class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-1 inline-block hidden"></span>
                    </div>
                    <button id="shift-next-month" class="p-2 hover:bg-slate-50 rounded-lg text-slate-400 font-bold transition">▶</button>
                </div>
                <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 shrink-0">
                    ${['日','月','火','水','木','金','土'].map((d,i) =>
                        `<div class="py-2 text-center text-xs font-black ${i===0?'text-rose-500':i===6?'text-blue-500':'text-slate-500'}">${d}</div>`
                    ).join('')}
                </div>
                <div id="shift-cal-grid" class="flex-1 grid grid-cols-7 gap-px bg-slate-200 border-b border-slate-200 overflow-y-auto pb-20"></div>
                <div class="p-4 bg-white border-t border-slate-200 shrink-0 pb-8 sm:pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                     <div class="flex items-center gap-3 mb-4">
                        <span class="text-xs font-bold text-slate-400 shrink-0">月間備考:</span>
                        <input type="text" id="shift-remarks-input" class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例: 後半は早番希望です">
                    </div>
                    <div id="shift-deadline-warning" class="hidden mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-center gap-2">
                        <span class="text-lg">⚠️</span>
                        <p class="text-xs font-bold text-rose-600">提出期限が過ぎています（毎月15日まで）</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                         <button id="btn-shift-cal-back" class="py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">一覧に戻る</button>
                         <button id="btn-shift-submit" class="py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition">保存・提出する</button>
                    </div>
                </div>
            </div>

            <!-- 3. Admin Matrix View -->
            <div id="shift-view-admin" class="hidden h-full flex flex-col bg-slate-50">
                <div class="bg-slate-800 text-white p-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-md z-20">
                    <div class="flex items-center gap-3">
                         <div class="flex bg-slate-700 rounded-lg p-1">
                            <button id="btn-shift-admin-prev" class="px-3 py-1 hover:text-emerald-400 text-slate-300 font-bold transition">◀</button>
                            <span id="shift-admin-title" class="px-2 font-num font-black text-lg tracking-widest"></span>
                            <button id="btn-shift-admin-next" class="px-3 py-1 hover:text-emerald-400 text-slate-300 font-bold transition">▶</button>
                         </div>
                    </div>
                    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <!-- UPDATED: Flex container for checkboxes to sit on one line on mobile -->
                        <div class="flex items-center gap-2">
                             <label class="flex items-center gap-1.5 text-[10px] md:text-xs font-bold bg-slate-700 px-2 py-2 rounded-lg border border-slate-600 cursor-pointer select-none whitespace-nowrap">
                                <input type="checkbox" id="chk-adjustment-mode" class="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500 rounded focus:ring-emerald-600 bg-slate-600 border-slate-500">
                                <span>調整モード</span>
                             </label>
                             <label class="flex items-center gap-1.5 text-[10px] md:text-xs font-bold bg-slate-700 px-2 py-2 rounded-lg border border-slate-600 cursor-pointer select-none whitespace-nowrap">
                                <input type="checkbox" id="chk-early-warehouse-auto" class="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500 rounded focus:ring-emerald-600 bg-slate-600 border-slate-500">
                                <span>早番倉庫お任せ</span>
                             </label>
                        </div>
                         <button id="btn-undo-action" class="hidden flex items-center gap-1 text-xs font-bold bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-lg transition border border-slate-500">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        </button>
                        <div class="h-6 w-px bg-slate-600 mx-1"></div>
                        <button id="btn-shift-toggle-mode" class="whitespace-nowrap text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600">📂 名簿順</button>
                        <button id="btn-open-staff-master" class="whitespace-nowrap text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600">👥 スタッフ</button>
                    </div>
                </div>

                <div class="flex-1 overflow-hidden relative bg-white">
                    <div id="admin-table-container" class="h-full overflow-auto">
                        <table class="w-full border-collapse whitespace-nowrap text-sm">
                            <thead class="sticky top-0 z-30 bg-slate-100 text-slate-600 font-bold shadow-sm">
                                <tr id="shift-admin-header-row">
                                    <th class="sticky left-0 z-40 bg-slate-100 p-1 md:p-2 border-b border-r border-slate-300 w-20 md:w-auto md:min-w-[140px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        名前 <span class="text-[10px] font-normal text-slate-400 ml-1 hidden md:inline">ランク/連/契/実</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="shift-admin-body"></tbody>
                        </table>
                    </div>
                </div>

                <div class="md:hidden absolute bottom-6 right-6 z-50">
                    <button id="mobile-fab-menu" class="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-700 transition transform hover:scale-105">
                        <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                </div>

                <div class="hidden md:flex p-3 bg-white border-t border-slate-200 justify-end gap-3 shrink-0">
                    <button id="btn-clear-shift" class="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-lg border border-rose-200 transition">🗑️ 割り振りクリア</button>
                    <button id="btn-shift-settings" class="text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition flex items-center gap-2">
                        <span>⚙️</span> 設定
                    </button>
                    <button id="btn-auto-create-shift" class="text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2 rounded-lg shadow-md transition flex items-center gap-2">
                        <span>⚡</span> AI 自動作成
                    </button>
                    <button id="btn-hybrid-create-shift" class="text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 px-6 py-2 rounded-lg shadow-md transition flex items-center gap-2 ml-2">
                        <span>🤖⚡</span> ハイブリッド作成
                    </button>
                    <button id="btn-shift-ai-chat" class="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition flex items-center gap-2 ml-2">
                        <span>💬</span> AI相談
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- ACTION MODAL -->
    <div id="shift-action-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-0 w-full max-w-[340px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div class="bg-slate-800 text-white p-5 text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
                <h3 id="shift-action-title" class="text-lg font-black tracking-widest font-num mb-1"></h3>
                <div id="shift-action-status" class="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-slate-700/80 backdrop-blur-sm border border-slate-600 mt-1"></div>
            </div>

            <!-- User Request Buttons -->
            <div id="user-req-buttons" class="p-6 grid grid-cols-2 gap-3">
                 <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-orange-50 border border-orange-100 hover:bg-orange-100 hover:text-orange-700 transition" data-role="early">
                    <span class="text-xl">☀️</span>
                    <span class="text-[10px] font-bold">早番希望</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-purple-50 border border-purple-100 hover:bg-purple-100 hover:text-purple-700 transition" data-role="late">
                    <span class="text-xl">🌙</span>
                    <span class="text-[10px] font-bold">遅番希望</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 transition col-span-2" data-role="any">
                    <span class="text-xl">🙋‍♂️</span>
                    <span class="text-[10px] font-bold">どちらでも可 (出勤希望)</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition" data-role="off">
                    <span class="text-xl">🏖️</span>
                    <span class="text-[10px] font-bold">公休 (休み)</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-pink-50 border border-pink-100 hover:bg-pink-100 hover:text-pink-600 transition" data-role="paid">
                    <span class="text-xl">🎫</span>
                    <span class="text-[10px] font-bold">有休希望</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-yellow-50 border border-yellow-100 hover:bg-yellow-100 hover:text-yellow-600 transition hidden" id="btn-req-special" data-role="special">
                    <span class="text-xl">🌟</span>
                    <span class="text-[10px] font-bold">特休希望</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-200 transition" data-role="clear">
                    <span class="text-xl">🔄</span>
                    <span class="text-[10px] font-bold">クリア</span>
                </button>
            </div>

            <!-- Admin Role Buttons -->
            <div id="admin-role-grid" class="hidden px-6 pb-2 grid grid-cols-4 gap-2 mt-4">
                 <button class="role-btn bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="A早">A (早)</button>
                 <button class="role-btn bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="B遅">B (遅)</button>
                 <button class="role-btn bg-amber-100 text-amber-700 border border-amber-300 font-bold py-2 rounded-lg text-[10px]" data-role="中番">中番</button>
                 <button class="role-btn bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2 rounded-lg text-[10px]" data-role="公休">公休</button>
                 <button class="role-btn bg-pink-50 text-pink-600 border border-pink-200 font-bold py-2 rounded-lg text-[10px]" data-role="有休">有休</button>
                 <button class="role-btn bg-yellow-50 text-yellow-600 border border-yellow-200 font-bold py-2 rounded-lg text-[10px]" data-role="特休">特休</button>
                 <button class="role-btn bg-slate-100 text-slate-400 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="/">/</button>
                 <button class="role-btn bg-slate-50 text-slate-400 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="revert">↩️ 戻す</button>
                 <button class="role-btn bg-slate-50 text-slate-400 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="clear">クリア</button>

                 <div class="col-span-4 h-px bg-slate-100 my-1"></div>

                 <button class="role-btn bg-yellow-50 text-yellow-700 border border-yellow-200 font-bold py-2 rounded-lg text-[10px]" data-role="金メ">金メ</button>
                 <button class="role-btn bg-amber-50 text-amber-700 border border-amber-200 font-bold py-2 rounded-lg text-[10px]" data-role="金サブ">金サブ</button>
                 <button class="role-btn bg-orange-50 text-orange-700 border border-orange-200 font-bold py-2 rounded-lg text-[10px]" data-role="ホ責">ホ責</button>
                 <button class="role-btn bg-blue-50 text-blue-700 border border-blue-200 font-bold py-2 rounded-lg text-[10px]" data-role="倉庫">倉庫</button>
            </div>

            <div class="px-6 pb-4 pt-2">
                <label class="block text-[10px] font-bold text-slate-400 mb-1 ml-1">備考 (入力で即時保存)</label>
                <div class="relative">
                    <textarea id="shift-action-daily-input" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition" rows="2" placeholder="早退・遅刻予定など..."></textarea>
                    <div class="absolute bottom-2 right-2 text-slate-300 text-[10px]">📝</div>
                </div>
            </div>

            <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button id="btn-action-prev" class="pr-4 pl-2 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg> 前の日
                </button>
                <button onclick="closeShiftActionModal()" class="px-4 py-2 rounded-lg text-slate-400 font-bold text-xs hover:bg-slate-100 transition">閉じる</button>
                <button id="btn-action-next" class="pl-4 pr-2 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-1">
                    次の日 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
    </div>

    <!-- ADJUSTMENT CANDIDATE MODAL -->
    <div id="adjustment-candidate-modal" class="modal-overlay hidden" style="z-index: 80;">
        <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
            <h3 class="font-bold text-slate-800 text-lg mb-2">代わりのスタッフを選択</h3>
            <p id="adj-modal-desc" class="text-xs text-slate-400 font-bold mb-4"></p>
            <div id="adj-candidate-list" class="flex-1 overflow-y-auto space-y-2 pr-2"></div>
            <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button onclick="document.getElementById('adjustment-candidate-modal').classList.add('hidden')" class="px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs">キャンセル</button>
            </div>
        </div>
    </div>

    <!-- ADJUSTMENT CONFIRM MODAL -->
    <div id="adjustment-confirm-modal" class="modal-overlay hidden" style="z-index: 90;">
        <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col items-center text-center">
            <h3 class="font-bold text-slate-800 text-lg mb-2">スタッフ交代の確認</h3>
            <p class="text-sm text-slate-500 font-bold mb-6">以下の内容で交代を実行しますか？</p>

            <div class="flex items-center gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 w-full justify-center">
                <div class="text-center">
                    <div class="text-xs text-slate-400 font-bold mb-1">現在の担当</div>
                    <div class="text-lg font-black text-slate-700" id="adj-confirm-old"></div>
                </div>
                <div class="text-slate-300 font-bold text-xl">➡</div>
                 <div class="text-center">
                    <div class="text-xs text-slate-400 font-bold mb-1">新しい担当</div>
                    <div class="text-lg font-black text-indigo-600" id="adj-confirm-new"></div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 w-full">
                <button onclick="document.getElementById('adjustment-confirm-modal').classList.add('hidden')" class="py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition">キャンセル</button>
                <button id="btn-exec-adjustment" class="py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition">実行する</button>
            </div>
        </div>
    </div>

    <!-- Mobile Admin Menu -->
    <div id="mobile-admin-menu" class="modal-overlay hidden" style="z-index: 80; align-items: flex-end;">
        <div class="bg-white w-full rounded-t-3xl p-6 animate-fade-in-up">
            <h4 class="text-center font-black text-slate-800 mb-6">管理者メニュー</h4>
            <div class="grid grid-cols-1 gap-3">
                <button id="btn-mobile-clear" class="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100">割り振りをクリア</button>
                <button id="btn-mobile-settings" class="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-100">⚙️ 自動割り振り設定</button>
                <button id="btn-mobile-auto" class="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200">AI 自動作成を実行</button>
                <button id="btn-mobile-hybrid" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2">
                    <span>🤖⚡</span> ハイブリッド作成
                </button>
                <button id="btn-mobile-ai-chat" class="w-full py-4 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 mt-2 flex items-center justify-center gap-2">
                    <span>💬</span> AI相談
                </button>
                <button onclick="document.getElementById('mobile-admin-menu').classList.add('hidden')" class="w-full py-4 text-slate-400 font-bold">キャンセル</button>
            </div>
        </div>
    </div>

    <!-- AUTO SHIFT SETTINGS MODAL -->
    <div id="auto-shift-settings-modal" class="modal-overlay hidden" style="z-index: 100;">
        <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl">
            <h3 class="font-bold text-slate-800 text-lg mb-4">⚙️ 自動割り振り設定</h3>
            <p class="text-xs font-bold text-slate-400 mb-6">AIが割り振りを行う役割を選択してください。</p>

            <div class="space-y-4">
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">金銭業務 (金メ・金サブ)</span>
                    <input type="checkbox" id="chk-as-money" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" checked>
                </label>
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">倉庫番</span>
                    <input type="checkbox" id="chk-as-warehouse" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" checked>
                </label>
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">ホール責任者</span>
                    <input type="checkbox" id="chk-as-hall-resp" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" checked>
                </label>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-100">
                <button onclick="document.getElementById('auto-shift-settings-modal').classList.add('hidden')" class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition">閉じる</button>
            </div>
        </div>
    </div>

    <!-- Staff Master, Edit, Target, Note Modals (Keeping Structure) -->
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
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500">契約日数 (目標)</label>
                        <input type="number" id="se-contract-days" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" value="20">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500">最大連勤数</label>
                        <input type="number" id="se-max-consecutive" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" value="5">
                    </div>
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
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" id="se-allow-nakaban" class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                            <span class="text-sm text-slate-700 font-bold">中番可</span>
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

    <div id="daily-target-modal" class="modal-overlay hidden" style="z-index: 90;">
        <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl">
            <h3 class="font-bold text-slate-800 text-lg mb-4" id="daily-target-title">定員設定</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-500">早番 (A) 定員</label>
                    <input type="number" id="target-a-input" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" min="0">
                </div>
                 <div>
                    <label class="text-xs font-bold text-slate-500">遅番 (B) 定員</label>
                    <input type="number" id="target-b-input" class="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" min="0">
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="document.getElementById('daily-target-modal').classList.add('hidden')" class="flex-1 py-2 bg-slate-100 text-slate-500 font-bold rounded-lg text-xs">キャンセル</button>
                <button id="btn-save-daily-target" class="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-lg shadow-indigo-200">保存</button>
            </div>
        </div>
    </div>

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

    <!-- COMPENSATORY OFF MODAL -->
    <div id="compensatory-off-modal" class="modal-overlay hidden" style="z-index: 90;">
        <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
            <h3 class="font-bold text-slate-800 text-lg mb-2">代休の提案</h3>
            <p id="comp-off-desc" class="text-xs text-slate-500 font-bold mb-4"></p>

            <div class="bg-indigo-50 p-3 rounded-lg mb-4 text-xs text-indigo-800 font-bold flex items-start gap-2">
                <span>💡</span>
                <span>シフト交代で出勤が増えました。<br>人員に余裕がある日を代休（休み）にできます。</span>
            </div>

            <div id="comp-off-list" class="flex-1 overflow-y-auto space-y-2 pr-2 mb-4"></div>

            <div class="pt-2 border-t border-slate-100">
                <button onclick="closeCompensatoryModal()" class="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-200 transition">
                    今回は代休を設定しない（完了）
                </button>
            </div>
        </div>
    </div>

    <!-- AUTO SHIFT PREVIEW MODAL -->
    <div id="auto-shift-preview-modal" class="modal-overlay hidden" style="z-index: 100;">
        <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
            <h3 class="font-bold text-slate-800 text-lg mb-2">AI 自動作成プレビュー</h3>
            <p class="text-xs font-bold text-slate-400 mb-4">以下の内容でシフトを確定しますか？</p>

            <div class="bg-slate-50 p-4 rounded-xl space-y-3 mb-6 border border-slate-100">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-bold text-slate-500">新規に埋まるシフト</span>
                    <span class="text-lg font-black text-emerald-600" id="preview-filled-count">0</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm font-bold text-slate-500">変更対象スタッフ</span>
                    <span class="text-lg font-black text-slate-700" id="preview-staff-count">0</span>
                </div>
            </div>

            <div class="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-xs font-bold mb-6">
                <span class="text-lg">⚠️</span>
                <span>確定すると、既存の割り振りが上書きされます。<br>（希望休や固定休は保持されます）</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <button onclick="cancelAutoShift()" class="py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition">キャンセル</button>
                <button onclick="finalizeAutoShift()" class="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition">確定して保存</button>
            </div>
        </div>
    </div>

    <!-- SHIFT AI CHAT MODAL (Right Sidebar) -->
    <div id="shift-ai-chat-modal" class="fixed top-0 right-0 h-full w-full sm:w-[350px] bg-white shadow-2xl z-[110] transform transition-transform duration-300 translate-x-full border-l border-slate-200 flex flex-col">
            <!-- Header -->
            <div class="bg-white border-b border-slate-100 p-4 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl shadow-md">🤖</div>
                    <div>
                        <h3 class="font-bold text-slate-800">AIシフト相談</h3>
                        <p class="text-[10px] text-slate-400 font-bold">現在のシフト状況を認識しています</p>
                    </div>
                </div>
                <button onclick="closeShiftAiChat()" class="p-2 hover:bg-slate-100 rounded-full transition text-slate-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Chat Area -->
            <div id="shift-ai-messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                <!-- Messages will be injected here -->
            </div>

            <!-- Input Area -->
            <div class="p-4 bg-white border-t border-slate-100 shrink-0">
                <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 transition">
                    <input type="text" id="shift-ai-input" class="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 px-2" placeholder="例: 20日の人が足りない、どうすればいい？" onkeydown="if(event.key === 'Enter') sendShiftAiMessage()">
                    <button onclick="sendShiftAiMessage()" class="p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    setupShiftEventListeners();
}

function setupShiftEventListeners() {
    $('#btn-shift-admin-login').onclick = checkShiftAdminPassword;
    $('#btn-close-shift-view').onclick = closeShiftModal;
    $('#btn-shift-cal-back').onclick = backToShiftList;
    $('#shift-prev-month').onclick = () => changeShiftMonth(-1);
    $('#shift-next-month').onclick = () => changeShiftMonth(1);
    $('#btn-shift-admin-prev').onclick = () => changeShiftMonth(-1);
    $('#btn-shift-admin-next').onclick = () => changeShiftMonth(1);
    $('#btn-shift-submit').onclick = saveShiftSubmission;
    $('#btn-open-staff-master').onclick = openStaffMasterModal;
    $('#btn-shift-toggle-mode').onclick = () => {
        shiftState.adminSortMode = shiftState.adminSortMode === 'roster' ? 'shift' : 'roster';
        renderShiftAdminTable();
    };
    $('#btn-undo-action').onclick = undoShiftAction;
    $('#btn-clear-shift').onclick = clearShiftAssignments;
    $('#btn-auto-create-shift').onclick = generateAutoShift;
    $('#btn-mobile-clear').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); clearShiftAssignments(); };
    $('#btn-shift-settings').onclick = () => document.getElementById('auto-shift-settings-modal').classList.remove('hidden');
    $('#btn-mobile-settings').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); document.getElementById('auto-shift-settings-modal').classList.remove('hidden'); };
    $('#btn-mobile-auto').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); generateAutoShift(); };
    $('#btn-mobile-hybrid').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); generateHybridShift(); };
    $('#btn-hybrid-create-shift').onclick = generateHybridShift;
    $('#btn-shift-ai-chat').onclick = openShiftAiChat;
    $('#btn-mobile-ai-chat').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); openShiftAiChat(); };
    $('#mobile-fab-menu').onclick = () => $('#mobile-admin-menu').classList.remove('hidden');

    // Auto Shift Settings Listeners
    $('#chk-as-money').onchange = (e) => { shiftState.autoShiftSettings.money = e.target.checked; };
    $('#chk-as-warehouse').onchange = (e) => { shiftState.autoShiftSettings.warehouse = e.target.checked; };
    $('#chk-as-hall-resp').onchange = (e) => { shiftState.autoShiftSettings.hall_resp = e.target.checked; };

    $('#btn-add-staff').onclick = () => openStaffEditModal(null);
    $('#btn-se-save').onclick = saveStaffDetails;
    $('#btn-se-delete').onclick = deleteStaff;
    $('#btn-save-daily-target').onclick = saveDailyTarget;
    $('#chk-early-warehouse-auto').onchange = (e) => { shiftState.earlyWarehouseMode = e.target.checked; };
    $('#chk-adjustment-mode').onchange = (e) => { shiftState.adjustmentMode = e.target.checked; };

    // Event Delegation for Shift Admin Table
    const adminBody = document.getElementById('shift-admin-body');
    if(adminBody) {
        adminBody.onclick = (e) => {
            const td = e.target.closest('td');
            if(!td) return;
            // Handle Staff Name Click (Note)
            if(td.dataset.type === 'name-cell') {
                const name = td.dataset.name;
                const remarks = td.dataset.remarks;
                const dailyRemarks = td.dataset.dailyRemarks ? JSON.parse(decodeURIComponent(td.dataset.dailyRemarks)) : {};
                showAdminNoteModal(name, remarks, dailyRemarks);
                return;
            }
            // Handle Shift Cell Click
            if(td.dataset.type === 'shift-cell') {
                const day = parseInt(td.dataset.day);
                const name = td.dataset.name;
                const status = td.dataset.status;
                if(name && day) {
                    if (shiftState.adjustmentMode && status && status !== '公休' && status !== '未設定' && !status.includes('希望')) {
                        // In adjustment mode, clicking an assigned slot triggers candidate search
                        openAdjustmentCandidateModal(day, name, status);
                    } else {
                        shiftState.selectedStaff = name;
                        showActionSelectModal(day, status);
                    }
                }
                return;
            }
            // Handle Daily Target Cell Click (Footer)
            if(td.dataset.type === 'target-cell') {
                const day = parseInt(td.dataset.day);
                if(day) openDailyTargetModal(day);
                return;
            }
        };
    }

    document.querySelectorAll('.action-btn-role').forEach(btn => {
        btn.onclick = () => {
            handleActionPanelClick(btn.dataset.role);
        };
    });
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.onclick = async () => {
            const role = btn.dataset.role;
            if (role === 'clear') handleActionPanelClick('clear');
            else if (role === 'revert') handleActionPanelClick('revert');
            else if (role === '公休') handleActionPanelClick('公休');
            else {
                await setAdminRole(role);
                showToast("✅ 変更しました", "black");
            }
        };
    });
    $('#btn-action-next').onclick = () => moveDay(1);
    $('#btn-action-prev').onclick = () => moveDay(-1);

    const drInput = document.getElementById('shift-action-daily-input');
    if(drInput) {
        drInput.oninput = () => {
             if(!shiftState.selectedDay || !shiftState.selectedStaff) return;
             const name = shiftState.selectedStaff;
             const day = shiftState.selectedDay;
             if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { daily_remarks: {} };
             if (!shiftState.shiftDataCache[name].daily_remarks) shiftState.shiftDataCache[name].daily_remarks = {};
             const val = drInput.value;
             if(val === "") delete shiftState.shiftDataCache[name].daily_remarks[day];
             else shiftState.shiftDataCache[name].daily_remarks[day] = val;
        };
    }
}

export function checkShiftAdminPassword() {
    const pwModal = document.getElementById('password-modal');
    if(pwModal) pwModal.style.zIndex = "100";
    showPasswordModal(activateShiftAdminMode);
}

export function activateShiftAdminMode() {
    closePasswordModal();
    shiftState.isAdminMode = true;
    switchShiftView('admin');
}

export async function openShiftUserModal() {
    showLoading();
    createShiftModals();
    document.getElementById('shift-main-view').classList.remove('translate-x-full');
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    shiftState.currentYear = d.getFullYear();
    shiftState.currentMonth = d.getMonth() + 1;
    shiftState.isAdminMode = false;
    shiftState.selectedDay = null;
    await loadAllShiftData();
    renderShiftStaffList();
    switchShiftView('list');
    hideLoading();
}

export async function loadAllShiftData() {
    showLoading();
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
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    try {
        const docRef = doc(db, "shift_submissions", docId);
        const snap = await getDoc(docRef);
        shiftState.shiftDataCache = snap.exists() ? snap.data() : {};
    } catch(e) {
        console.error("Shift Load Error:", e);
        shiftState.shiftDataCache = {};
    }
    shiftState.prevMonthCache = null; // Invalidate cache on new load
    hideLoading();
}

export function switchShiftView(viewName) {
    ['list', 'calendar', 'admin'].forEach(v => {
        const el = document.getElementById(`shift-view-${v}`);
        if(el) el.classList.add('hidden');
    });
    if(viewName === 'admin') {
        document.getElementById('shift-view-admin').classList.remove('hidden');
        renderShiftAdminTable();
        return;
    }
    const target = document.getElementById(`shift-view-${viewName}`);
    if(target) target.classList.remove('hidden');
    if (viewName === 'calendar') renderShiftCalendar();
}

export function closeShiftModal() {
    document.getElementById('shift-main-view').classList.add('translate-x-full');
}

export function backToShiftList() {
    if (shiftState.isAdminMode) {
        if(!document.getElementById('shift-view-calendar').classList.contains('hidden')) {
             switchShiftView('admin');
        } else {
             shiftState.isAdminMode = false;
             switchShiftView('list');
        }
    } else {
        shiftState.selectedStaff = null;
        shiftState.selectedDay = null;
        switchShiftView('list');
    }
}

export function renderShiftStaffList() {
    const container = document.getElementById('shift-staff-list-container');
    if (!container) return;
    container.innerHTML = '';

    let targetList = [];
    if (shiftState.currentStaffTab === 'early') targetList = shiftState.staffListLists.alba_early;
    else if (shiftState.currentStaffTab === 'late') targetList = shiftState.staffListLists.alba_late;
    else if (shiftState.currentStaffTab === 'employee') targetList = shiftState.staffListLists.employees;

    targetList.forEach(name => {
        const btn = document.createElement('button');
        btn.className = "bg-white border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold py-4 px-2 rounded-2xl text-sm transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center gap-1";
        btn.innerHTML = `<span class="text-2xl opacity-50">👤</span><span>${name}</span>`;
        btn.onclick = () => selectShiftStaff(name);
        container.appendChild(btn);
    });

    // Update Tab Styles
    ['early', 'late', 'employee'].forEach(tab => {
        const btn = document.getElementById(`btn-tab-${tab}`);
        if(btn) {
             if(tab === shiftState.currentStaffTab) {
                 btn.className = "px-6 py-2 rounded-full bg-indigo-600 text-white font-bold text-sm shadow-md transition-all";
             } else {
                 btn.className = "px-6 py-2 rounded-full bg-white text-slate-500 font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all";
             }
        }
    });
}

export function switchStaffTab(tab) {
    shiftState.currentStaffTab = tab;
    renderShiftStaffList();
}
window.switchStaffTab = switchStaffTab;

export function selectShiftStaff(name) {
    shiftState.selectedStaff = name;
    document.getElementById('shift-staff-name').textContent = name;
    switchShiftView('calendar');
}

export function renderShiftCalendar() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-cal-title').textContent = `${y}年 ${m}月`;
    const container = document.getElementById('shift-cal-grid');
    container.innerHTML = '';
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const holidays = getHolidays(y, m);

    if (!shiftState.shiftDataCache[shiftState.selectedStaff]) {
        shiftState.shiftDataCache[shiftState.selectedStaff] = { off_days: [], work_days: [], assignments: {}, shift_requests: {} };
    }
    const staffData = shiftState.shiftDataCache[shiftState.selectedStaff];
    const offDays = staffData.off_days || [];
    const workDays = staffData.work_days || [];
    const assignments = staffData.assignments || {};
    const requests = staffData.shift_requests || {};
    const details = shiftState.staffDetails[shiftState.selectedStaff] || {};

    // Progress Stats
    const statsDiv = document.getElementById('shift-cal-stats');
    if(statsDiv) statsDiv.textContent = `提出: ${workDays.length} / 目標: ${details.contract_days || 20}`;

    document.getElementById('shift-remarks-input').value = staffData.remarks || "";

    const today = new Date();
    const isDeadlinePassed = today.getDate() > 15;
    const isRestricted = !shiftState.isAdminMode && isDeadlinePassed;

    const submitBtn = document.getElementById('btn-shift-submit');
    const warningDiv = document.getElementById('shift-deadline-warning');
    const backBtn = document.getElementById('btn-shift-cal-back');

    if (shiftState.isAdminMode) {
        submitBtn.classList.add('hidden');
        warningDiv.classList.add('hidden');
        backBtn.textContent = "管理者一覧に戻る";
    } else {
        submitBtn.classList.remove('hidden');
        backBtn.textContent = "一覧に戻る";
        if (isRestricted) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            warningDiv.classList.remove('hidden');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            warningDiv.classList.add('hidden');
        }
    }

    for (let i = 0; i < firstDay; i++) container.innerHTML += `<div class="bg-slate-100"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const isOff = offDays.includes(d);
        const isWork = workDays.includes(d);
        const reqType = requests[d] || 'any'; // 'early', 'late', 'any'
        const assignedRole = assignments[d];
        const isSelected = d === shiftState.selectedDay;
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        const isHoliday = holidays.includes(d);

        let numColor = "text-slate-700";
        if (dayOfWeek === 0 || isHoliday) numColor = "text-rose-500";
        else if (dayOfWeek === 6) numColor = "text-blue-500";

        let bgClass = 'bg-white hover:bg-emerald-50';
        let label = '';
        let statusText = '';

        // UPDATED: User Mode Logic - Ignore Assignments completely if not admin
        const showAssignment = shiftState.isAdminMode && (assignedRole !== undefined); // Allow empty string to pass through logic

        if (showAssignment) {
            if (assignedRole === '公休') {
                numColor = "text-white";
                bgClass = "bg-rose-500";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">公休</span>';
                statusText = '公休';
            } else if (assignedRole === '有休' || assignedRole === 'PAID') {
                numColor = "text-white";
                bgClass = "bg-pink-500";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">有休</span>';
                statusText = '有休';
            } else if (assignedRole === '特休' || assignedRole === 'SPECIAL') {
                numColor = "text-white";
                bgClass = "bg-yellow-500";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">特休</span>';
                statusText = '特休';
            } else if (assignedRole === '' || assignedRole === undefined) {
                // Completely Blank
                bgClass = 'bg-white';
                label = '';
                statusText = '未設定';
            } else if (assignedRole === '/') {
                numColor = "text-slate-400";
                bgClass = "bg-slate-50";
                label = '<span class="text-[10px] text-slate-400 font-bold leading-none mt-1">/</span>';
                statusText = '/';
            } else {
                numColor = "text-white";
                bgClass = "bg-indigo-600";
                label = `<span class="text-[10px] text-white font-bold leading-none mt-1">${assignedRole}</span>`;
                statusText = assignedRole;
            }
        } else {
            // Show Requests (Standard for User Mode)
            if (isOff) {
                numColor = "text-white";
                bgClass = "bg-rose-400 opacity-80";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">希望休</span>';
                statusText = '希望休';
            } else if (isWork) {
                numColor = "text-white";
                // Color based on request type
                if(reqType === 'early') { bgClass = "bg-orange-400 opacity-80"; label = '<span class="text-[10px] text-white font-bold leading-none mt-1">早番希</span>'; statusText = '早番希望'; }
                else if(reqType === 'late') { bgClass = "bg-purple-500 opacity-80"; label = '<span class="text-[10px] text-white font-bold leading-none mt-1">遅番希</span>'; statusText = '遅番希望'; }
                else if(reqType === 'PAID') { bgClass = "bg-pink-400 opacity-80"; label = '<span class="text-[10px] text-white font-bold leading-none mt-1">有休希</span>'; statusText = '有休希望'; }
                else if(reqType === 'SPECIAL') { bgClass = "bg-yellow-400 opacity-80"; label = '<span class="text-[10px] text-white font-bold leading-none mt-1">特休希</span>'; statusText = '特休希望'; }
                else { bgClass = "bg-blue-400 opacity-80"; label = '<span class="text-[10px] text-white font-bold leading-none mt-1">出勤希</span>'; statusText = '出勤希望'; }
            }
        }

        const borderClass = isSelected ? 'ring-4 ring-yellow-400 z-10' : '';
        const hasDailyRemark = staffData.daily_remarks && staffData.daily_remarks[d];
        const remarkIndicator = hasDailyRemark ? '<span class="absolute top-1 right-1 text-[8px]">📝</span>' : '';
        let cursorClass = isRestricted ? 'cursor-default' : 'cursor-pointer';

        const cell = document.createElement('div');
        cell.className = `${bgClass} ${borderClass} flex flex-col items-center justify-center ${cursorClass} transition-all select-none relative min-h-[60px]`;
        cell.innerHTML = `<span class="text-xl font-black ${numColor} font-num">${d}</span>${label}${remarkIndicator}`;

        if (!isRestricted) {
            cell.onclick = () => showActionSelectModal(d, statusText || '未設定');
        }
        container.appendChild(cell);
    }
}

export function renderShiftAdminTable() {
    const y = shiftState.currentYear;
    const m = shiftState.currentMonth;
    document.getElementById('shift-admin-title').textContent = `${y}年 ${m}月`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const holidays = getHolidays(y, m);
    const isMobile = window.innerWidth < 768;

    // UPDATED: Forced Table View (Removed View Mode Logic)
    const toggleBtn = document.getElementById('btn-shift-toggle-mode');
    toggleBtn.textContent = shiftState.adminSortMode === 'roster' ? "📂 名簿順" : "⚡ シフト別";
    const undoBtn = document.getElementById('btn-undo-action');
    if(shiftState.historyStack.length > 0) undoBtn.classList.remove('hidden');
    else undoBtn.classList.add('hidden');

    // Ensure table container is always visible
    document.getElementById('admin-table-container').classList.remove('hidden');

    const headerRow = document.getElementById('shift-admin-header-row');
    while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
    for(let d=1; d<=daysInMonth; d++) {
        const th = document.createElement('th');
        const dayOfWeek = new Date(y, m-1, d).getDay();
        const isHoliday = holidays.includes(d);
        const color = (dayOfWeek===0 || isHoliday) ?'text-rose-500':dayOfWeek===6?'text-blue-500':'text-slate-600';
        // UPDATED: Compact header styles for mobile
        th.className = `p-1 md:p-2 border-b border-r border-slate-200 min-w-[24px] md:min-w-[30px] text-center ${color} font-num text-[10px] md:text-xs`;
        th.textContent = d;
        headerRow.appendChild(th);
    }

    const tbody = document.getElementById('shift-admin-body');
    tbody.innerHTML = '';

    // Performance Optimization: Use DocumentFragment
    const fragment = document.createDocumentFragment();

    const createSection = (title, list, bgClass) => {
        if(!list || list.length === 0) return;
        const trTitle = document.createElement('tr');
        // UPDATED: Section title spans full width with correct padding
        trTitle.innerHTML = `<td class="sticky left-0 z-20 p-1 md:p-2 font-bold text-[10px] md:text-xs ${bgClass} border-b border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left pl-2" colspan="${daysInMonth+1}">${title}</td>`;
        fragment.appendChild(trTitle);

        list.forEach(name => {
            const tr = document.createElement('tr');
            const data = shiftState.shiftDataCache[name] || { off_days: [], work_days: [], assignments: {} };
            const details = shiftState.staffDetails[name] || {};
            const monthlySettings = (data.monthly_settings) || {};
            const currentType = monthlySettings.shift_type || details.basic_shift || 'A';
            const hasAnyRemark = (data.remarks && data.remarks.trim() !== "") || (data.daily_remarks && Object.keys(data.daily_remarks).length > 0);

            // Calculate Actual Assigned Count
            // Logic: Contract Days includes Paid/Special. Physical Days is Work only.
            // Here "Actual" usually means "Assigned Days against Contract".
            const actualCount = Object.values(data.assignments || {}).filter(r => r && r !== '公休' && r !== '/').length; // Includes Paid/Special if they are in assignments?
            // Wait, r could be '有休' or '特休'.
            // If we count them for contract, they should be included.
            // If r is '', it's not counted.
            // If r is '/', it's not counted.
            // So: r exists AND r != '公休' AND r != '/'.

            const tdName = document.createElement('td');
            // UPDATED: Name cell layout (narrow on mobile)
            tdName.className = "sticky left-0 z-20 bg-white p-1 md:p-2 border-b border-r border-slate-300 font-bold text-slate-700 text-[10px] md:text-xs truncate w-20 md:w-auto md:min-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";

            const nameSpan = document.createElement('div');
            nameSpan.className = "flex flex-col md:mb-1 justify-center h-full"; // Centered vertically

            // UPDATED: Details hidden on mobile
            const detailsHtml = `
                <span class="text-[9px] text-slate-300 font-normal leading-none mt-0.5 hidden md:block">
                    連:${details.max_consecutive_days||5} / 契:${details.contract_days||20} / <span class="text-slate-500 font-bold">実:${actualCount}</span>
                </span>
            `;

            // UPDATED: Name cell inner HTML structure
            nameSpan.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-1">
                    <span class="leading-tight truncate ${hasAnyRemark ? 'text-indigo-600' : ''}">${name} ${hasAnyRemark ? '<span class="md:hidden">📝</span>' : (hasAnyRemark ? '📝' : '')}</span>
                    <button class="w-4 h-4 md:w-5 md:h-5 rounded flex items-center justify-center font-bold text-[8px] md:text-[9px] ${currentType==='A'?'bg-slate-50 text-slate-400':'bg-slate-800 text-white'} toggle-type-btn shrink-0" data-name="${name}" data-type="${currentType}">${currentType}</button>
                </div>
                <div class="scale-90 origin-left mt-0.5 md:mt-1">
                    ${renderRoleBadges(details.allowed_roles)}
                </div>
                ${detailsHtml}
            `;
            // Toggle type button handles its own click via stopPropagation
            nameSpan.querySelector('.toggle-type-btn').onclick = (e) => { e.stopPropagation(); toggleStaffShiftType(name, currentType); };

            // Setup data attributes for delegation
            if(hasAnyRemark) {
                tdName.dataset.type = 'name-cell';
                tdName.dataset.name = name;
                tdName.dataset.remarks = data.remarks || "";
                tdName.dataset.dailyRemarks = encodeURIComponent(JSON.stringify(data.daily_remarks || {}));
                tdName.style.cursor = "pointer";
            }

            tdName.appendChild(nameSpan);
            tr.appendChild(tdName);

            for(let d=1; d<=daysInMonth; d++) {
                const td = document.createElement('td');
                const isOffReq = data.off_days && data.off_days.includes(d);
                const isWorkReq = data.work_days && data.work_days.includes(d);
                const requests = data.shift_requests || {};
                const reqType = requests[d] || 'any';
                const assignment = (data.assignments && data.assignments[d]) || null;
                const dailyRemark = data.daily_remarks && data.daily_remarks[d];

                let bgCell = '';
                let cellContent = '';

                // NEW: Check for AI Proposal in remarks
                if (dailyRemark && dailyRemark.includes("AI提案:中番")) {
                    bgCell += ' border-2 border-yellow-400 box-border z-10';
                }

                if (assignment || assignment === '') { // Allow empty string
                    if (assignment === '公休') {
                         // Always show Pink/Holiday style regardless of request
                         bgCell = 'bg-rose-50 hover:bg-rose-100';
                         cellContent = '<span class="text-rose-500 font-bold text-[10px] select-none">(休)</span>';
                    } else if (assignment === '有休' || assignment === 'PAID') {
                         bgCell = 'bg-pink-100 hover:bg-pink-200';
                         cellContent = '<span class="text-pink-600 font-bold text-[10px] select-none">有休</span>';
                    } else if (assignment === '特休' || assignment === 'SPECIAL') {
                         bgCell = 'bg-yellow-100 hover:bg-yellow-200';
                         cellContent = '<span class="text-yellow-600 font-bold text-[10px] select-none">特休</span>';
                    } else if (assignment === '') {
                         // Explicit Blank
                         bgCell = 'bg-white hover:bg-slate-50';
                         cellContent = '';
                    } else if (assignment === '/') {
                         bgCell = 'bg-slate-50 hover:bg-slate-100';
                         cellContent = '<span class="text-slate-400 font-bold text-[10px] select-none">/</span>';
                    } else {
                         let roleColor = 'text-slate-800';

                         // Check for special roles
                         const isSpecial = assignment.includes('金メ') || assignment.includes('金サブ') || assignment.includes('ホ責') || assignment.includes('倉庫');

                         if (assignment === '中番') {
                             bgCell = 'bg-white border-2 border-yellow-400 box-border z-10'; // Yellow border for Middle shift
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none">
                                    <span class="text-yellow-600 font-bold text-[9px] md:text-[10px] leading-none">中番</span>
                                </div>
                             `;
                         } else if (isSpecial) {
                             if(assignment.includes('金メ')) { bgCell = 'bg-yellow-50'; roleColor = 'text-yellow-600'; }
                             else if(assignment.includes('金サブ')) { bgCell = 'bg-amber-50'; roleColor = 'text-amber-600'; }
                             else if(assignment.includes('ホ責')) { bgCell = 'bg-orange-50'; roleColor = 'text-orange-600'; }
                             else if(assignment.includes('倉庫')) { bgCell = 'bg-blue-50'; roleColor = 'text-blue-600'; }

                             const typeLabel = currentType === 'A' ? 'A早' : 'B遅';
                             // UPDATED: Shift cell text size
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none">
                                    <span class="text-[6px] md:text-[7px] text-slate-300 font-normal transform scale-90 mb-px">${typeLabel}</span>
                                    <span class="${roleColor} font-bold text-[9px] md:text-[10px] leading-none">${assignment}</span>
                                </div>
                             `;
                         } else {
                             // Plain Shift (No specific role, or generic like 'ホ', '早番', 'A早', etc.)
                             // Force simplified style
                             bgCell = 'bg-white';
                             const displayLabel = currentType === 'A' ? 'A出勤' : 'B出勤';
                             // UPDATED: Shift cell text size
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none">
                                    <span class="text-slate-600 font-bold text-[9px] md:text-[10px] leading-none">${displayLabel}</span>
                                </div>
                             `;
                         }

                         // WARNING: Forced assignment on holiday request
                         if(isOffReq) {
                            bgCell += ' ring-2 ring-inset ring-rose-500 bg-rose-50';
                         }
                    }
                } else {
                    if (isOffReq) { bgCell = 'bg-rose-50 hover:bg-rose-100'; cellContent = '<span class="text-rose-500 font-bold text-[10px] select-none">(休)</span>'; }
                    else if (isWorkReq) {
                        if(reqType === 'early') { bgCell = 'bg-orange-50 hover:bg-orange-100'; cellContent = '<span class="text-orange-400 font-bold text-[10px]">(早)</span>'; }
                        else if(reqType === 'late') { bgCell = 'bg-purple-50 hover:bg-purple-100'; cellContent = '<span class="text-purple-400 font-bold text-[10px]">(遅)</span>'; }
                        else { bgCell = 'bg-slate-50 hover:bg-slate-100'; cellContent = '<span class="text-blue-300 font-bold text-[10px]">(出)</span>'; }
                    }
                }

                if (dailyRemark) cellContent += `<span class="absolute top-0 right-0 text-[8px] text-yellow-600">●</span>`;

                // UPDATED: Cell padding
                td.className = `border-b border-r border-slate-200 text-center cursor-pointer transition relative ${bgCell} p-0.5 md:p-1 h-8 md:h-auto align-middle`;
                td.innerHTML = cellContent;

                // Data Attributes for Event Delegation
                td.dataset.type = 'shift-cell';
                td.dataset.day = d;
                td.dataset.name = name;
                td.dataset.status = assignment || (isOffReq ? '公休希望' : isWorkReq ? (reqType==='early'?'早番希望':reqType==='late'?'遅番希望':'出勤希望') : '未設定');

                tr.appendChild(td);
            }
            fragment.appendChild(tr);
        });
    };

    if (shiftState.adminSortMode === 'roster') {
        createSection("▼ 社員", shiftState.staffListLists.employees, "bg-indigo-100 text-indigo-800");
        createSection("▼ 早番アルバイト", shiftState.staffListLists.alba_early, "bg-teal-100 text-teal-800");
        createSection("▼ 遅番アルバイト", shiftState.staffListLists.alba_late, "bg-purple-100 text-purple-800");
    } else {
        const allNames = [...shiftState.staffListLists.employees, ...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late];
        const listA = [];
        const listB = [];
        allNames.forEach(name => {
            const type = (shiftState.shiftDataCache[name]?.monthly_settings?.shift_type) || (shiftState.staffDetails[name]?.basic_shift) || 'A';
            if(type === 'A') listA.push(name); else listB.push(name);
        });
        createSection("▼ A番 (早番)", listA, "bg-amber-100 text-amber-800");
        createSection("▼ B番 (遅番)", listB, "bg-indigo-100 text-indigo-800");
    }

    // --- Footer Rows (Actuals & Targets) ---
    const allNames = [...shiftState.staffListLists.employees, ...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late];
    const dailyTargets = shiftState.shiftDataCache._daily_targets || {};

    // Calculate Actuals
    const actualA = {};
    const actualB = {};
    for(let d=1; d<=daysInMonth; d++) {
        actualA[d] = 0;
        actualB[d] = 0;
    }

    allNames.forEach(name => {
        const data = shiftState.shiftDataCache[name] || {};
        const assignments = data.assignments || {};
        const shiftType = (data.monthly_settings?.shift_type) || (shiftState.staffDetails[name]?.basic_shift) || 'A';

        for(let d=1; d<=daysInMonth; d++) {
            const role = assignments[d];
            // Actual Count for Staffing (Physical Presence)
            // Exclude Paid/Special/Blank/Slash
            if(role && role !== '公休' && role !== '有休' && role !== 'PAID' && role !== '特休' && role !== 'SPECIAL' && role !== '/') {
                if (role === '中番') {
                    // Middle shift counts for BOTH A and B
                    actualA[d]++;
                    actualB[d]++;
                } else {
                    if(shiftType === 'A') actualA[d]++;
                    else actualB[d]++;
                }
            }
        }
    });

    // Create Footer Rows Helper
    const createFooterRow = (title, type, counts, targets, isTargetRow = false) => {
        const tr = document.createElement('tr');
        const tdTitle = document.createElement('td');
        // UPDATED: Footer title cell matching name column style
        tdTitle.className = "sticky left-0 z-20 bg-slate-100 p-1 md:p-2 border-b border-r border-slate-300 font-bold text-[10px] md:text-xs text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-20 md:w-auto md:min-w-[140px] truncate";
        tdTitle.textContent = title;
        tr.appendChild(tdTitle);

        for(let d=1; d<=daysInMonth; d++) {
            const td = document.createElement('td');
            const val = counts[d] || 0;
            const target = (targets[d] && targets[d][type]) !== undefined ? targets[d][type] : 9;

            let colorClass = "text-slate-600";
            if (val < target) colorClass = "text-rose-600 font-black";
            else if (val > target) colorClass = "text-blue-600";

            // UPDATED: Footer cell padding/style
            td.className = "border-b border-r border-slate-200 text-center font-bold text-[10px] md:text-xs p-0.5 md:p-1 h-8 md:h-auto align-middle";

            if (isTargetRow) {
                 td.className += " cursor-pointer hover:bg-slate-100 bg-slate-50";
                 td.innerHTML = `<span class="text-slate-400 text-[9px] md:text-[10px]">(${target})</span>`;
                 td.dataset.type = 'target-cell';
                 td.dataset.day = d;
            } else {
                 td.innerHTML = `<span class="${colorClass}">${val}</span>`;
            }
            tr.appendChild(td);
        }
        fragment.appendChild(tr);
    };

    createFooterRow("実績 (A番)", 'A', actualA, dailyTargets);
    createFooterRow("実績 (B番)", 'B', actualB, dailyTargets);

    // --- New Inline Input Target Rows ---
    const createInputTargetRow = (typeLabel, typeKey) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="sticky left-0 z-20 bg-slate-800 text-white p-1 md:p-2 border-b border-r border-slate-600 font-bold text-[10px] md:text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-20 md:w-auto md:min-w-[140px] truncate">定員 (${typeLabel})</td>`;

        for(let d=1; d<=daysInMonth; d++) {
            const td = document.createElement('td');
            const t = dailyTargets[d] || {};
            const val = t[typeKey] !== undefined ? t[typeKey] : 9;

            td.className = "border-b border-r border-slate-200 p-0.5 md:p-1 h-8 md:h-auto align-middle bg-slate-50";

            const input = document.createElement('input');
            input.type = "number";
            input.id = `target-input-${typeKey}-${d}`;
            input.className = "w-full h-full bg-transparent text-center font-bold text-[10px] md:text-xs text-slate-600 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-0";
            input.value = val;
            input.min = 0;

            // Event Handlers
            input.onblur = () => window.saveDailyTargetInline(d, typeKey, input);
            input.onkeydown = (e) => window.handleDailyTargetKeydown(e, d, typeKey);
            input.onclick = (e) => e.stopPropagation(); // Prevent row click if any

            td.appendChild(input);
            tr.appendChild(td);
        }
        fragment.appendChild(tr);
    };

    createInputTargetRow("A", "A");
    createInputTargetRow("B", "B");

    // Append the entire fragment to the table body
    tbody.appendChild(fragment);
}

export function showActionSelectModal(day, currentStatusText) {
    shiftState.selectedDay = day;
    const name = shiftState.selectedStaff;
    const staffData = shiftState.shiftDataCache[name] || {};
    document.getElementById('shift-action-title').textContent = `${shiftState.currentMonth}/${day} ${name}`;
    document.getElementById('shift-action-status').textContent = `現在: ${currentStatusText}`;
    const drInput = document.getElementById('shift-action-daily-input');
    drInput.value = (staffData.daily_remarks && staffData.daily_remarks[day]) || "";
    document.getElementById('shift-action-modal').classList.remove('hidden');

    const adminRoles = document.getElementById('admin-role-grid');
    const userReqButtons = document.getElementById('user-req-buttons');

    if (shiftState.isAdminMode) {
        userReqButtons.classList.add('hidden');
        adminRoles.classList.remove('hidden');
    } else {
        userReqButtons.classList.remove('hidden');
        adminRoles.classList.add('hidden');

        // Toggle Special Leave Button for Employees
        const details = shiftState.staffDetails[name] || {};
        const btnSpecial = document.getElementById('btn-req-special');
        if (btnSpecial) {
            if (details.type === 'employee') {
                btnSpecial.classList.remove('hidden');
            } else {
                btnSpecial.classList.add('hidden');
            }
        }
    }
}

export function closeShiftActionModal() {
    document.getElementById('shift-action-modal').classList.add('hidden');
    if (shiftState.isAdminMode && shiftState.selectedStaff) {
         saveShiftToFirestore(shiftState.selectedStaff);
    }
}

function handleActionPanelClick(role) {
    if (shiftState.isAdminMode) {
        if (role === 'clear') {
             const day = shiftState.selectedDay;
             const name = shiftState.selectedStaff;
             if(!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { assignments: {}, daily_remarks: {} };
             if(!shiftState.shiftDataCache[name].assignments) shiftState.shiftDataCache[name].assignments = {};

             // DELETE assignment to reset to unassigned/blank state (NOT counting as work)
             delete shiftState.shiftDataCache[name].assignments[day];
             delete shiftState.shiftDataCache[name].daily_remarks[day];

             updateViewAfterAction();
             showToast("✅ 変更しました", "black");
             closeShiftActionModal();
        } else if (role === 'revert') {
             const day = shiftState.selectedDay;
             const name = shiftState.selectedStaff;
             const data = shiftState.shiftDataCache[name];
             const req = data?.shift_requests?.[day];
             const isOff = data?.off_days?.includes(day);
             const isWork = data?.work_days?.includes(day);

             let newVal = '';
             if (isOff) {
                 newVal = '公休';
             } else if (isWork) {
                 // Check precise request type
                 if (req === 'PAID') newVal = '有休';
                 else if (req === 'SPECIAL') newVal = '特休';
                 else newVal = '出勤';
             }

             // If no request -> '' (Blank).
             if (!isOff && !isWork) newVal = '';

             if(!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { assignments: {} };
             if(!shiftState.shiftDataCache[name].assignments) shiftState.shiftDataCache[name].assignments = {};

             shiftState.shiftDataCache[name].assignments[day] = newVal;

             updateViewAfterAction();
             showToast("✅ 変更しました", "black");
             closeShiftActionModal();
        } else {
            setAdminRole(role);
            showToast("✅ 変更しました", "black");
            closeShiftActionModal();
        }
    } else {
        // User Mode
        updateShiftRequest(role); // 'early', 'late', 'any', 'off', 'clear', 'paid', 'special'
        closeShiftActionModal();
    }
}

function updateShiftRequest(type) {
    const day = shiftState.selectedDay;
    const name = shiftState.selectedStaff;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], assignments: {}, shift_requests: {} };
    const data = shiftState.shiftDataCache[name];
    if (!data.shift_requests) data.shift_requests = {};

    let offList = data.off_days || [];
    let workList = data.work_days || [];

    if (type === 'clear') {
        offList = offList.filter(d => d !== day);
        workList = workList.filter(d => d !== day);
        delete data.shift_requests[day];
    } else if (type === 'off') {
        if(!offList.includes(day)) offList.push(day);
        workList = workList.filter(d => d !== day);
        delete data.shift_requests[day];
    } else if (type === 'paid') {
        // Paid Leave - Treated like work in contract, but technically a request here?
        // User instructions say: [有休希望] ... 選択時はあくまで「希望」として保存する
        // For logic simplicity, treat as Work Day with special request type 'paid'
        // But wait, the system logic uses assignments for calculations mostly.
        // For requests, we can just store 'paid' in shift_requests.
        // And ensure it counts as "Work Day" (contract) but maybe handle differently in logic.
        // Let's store as work_day + request 'paid'.
        if(!workList.includes(day)) workList.push(day);
        offList = offList.filter(d => d !== day);
        data.shift_requests[day] = 'PAID';
    } else if (type === 'special') {
        if(!workList.includes(day)) workList.push(day);
        offList = offList.filter(d => d !== day);
        data.shift_requests[day] = 'SPECIAL';
    } else {
        // work (early, late, any)
        if(!workList.includes(day)) workList.push(day);
        offList = offList.filter(d => d !== day);
        data.shift_requests[day] = type;
    }

    data.off_days = offList;
    data.work_days = workList;
    updateViewAfterAction();
}

function updateViewAfterAction() {
    if (shiftState.isAdminMode) {
        saveShiftToFirestore(shiftState.selectedStaff);
        renderShiftAdminTable();
        renderShiftCalendar();
    } else {
        renderShiftCalendar();
    }
}

async function setAdminRole(role) {
    const name = shiftState.selectedStaff;
    const day = shiftState.selectedDay;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    if (!shiftState.shiftDataCache[name].assignments) shiftState.shiftDataCache[name].assignments = {};
    shiftState.shiftDataCache[name].assignments[day] = role;
    updateViewAfterAction();
}

function moveDay(delta) {
    if(!shiftState.selectedDay) return;
    const nextDay = shiftState.selectedDay + delta;
    const daysInMonth = new Date(shiftState.currentYear, shiftState.currentMonth, 0).getDate();
    if (nextDay < 1 || nextDay > daysInMonth) { showToast("月外の日付です"); return; }

    closeShiftActionModal();
    setTimeout(() => {
        const name = shiftState.selectedStaff;
        const data = shiftState.shiftDataCache[name] || {};
        const isOff = data.off_days?.includes(nextDay);
        const isWork = data.work_days?.includes(nextDay);
        const req = data.shift_requests?.[nextDay] || 'any';
        const assign = data.assignments?.[nextDay];

        let status = assign;
        if(!status) {
            if(isOff) status = '公休希望';
            else if(isWork) {
                if (req === 'early') status = '早番希望';
                else if (req === 'late') status = '遅番希望';
                else if (req === 'PAID') status = '有休希望';
                else if (req === 'SPECIAL') status = '特休希望';
                else status = '出勤希望';
            }
            else status = '未設定';
        }
        showActionSelectModal(nextDay, status);
    }, 200);
}

function pushHistory() {
    shiftState.historyStack.push(JSON.parse(JSON.stringify(shiftState.shiftDataCache)));
    if (shiftState.historyStack.length > 5) shiftState.historyStack.shift();
    document.getElementById('btn-undo-action').classList.remove('hidden');
}

async function undoShiftAction() {
    if(shiftState.historyStack.length === 0) return;
    const prev = shiftState.historyStack.pop();
    shiftState.shiftDataCache = prev;
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    await setDoc(docRef, shiftState.shiftDataCache);
    renderShiftAdminTable();
    showToast("直前の操作を取り消しました");
    if(shiftState.historyStack.length === 0) document.getElementById('btn-undo-action').classList.add('hidden');
}

async function saveShiftToFirestore(name) {
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    const updateData = {};
    updateData[name] = shiftState.shiftDataCache[name];
    await setDoc(docRef, updateData, { merge: true });
}

async function toggleStaffShiftType(name, currentType) {
    const newType = currentType === 'A' ? 'B' : 'A';
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
    if (!shiftState.shiftDataCache[name].monthly_settings) shiftState.shiftDataCache[name].monthly_settings = {};
    shiftState.shiftDataCache[name].monthly_settings.shift_type = newType;
    await saveShiftToFirestore(name);
    renderShiftAdminTable();
}

// --- SHARED HELPER: PREPARE SHIFT ANALYSIS CONTEXT ---
// Used by both Auto Generator and Smart Adjustment Mode
async function prepareShiftAnalysisContext(year, month, currentShiftData, staffDetails, staffLists) {
    const daysInMonth = new Date(year, month, 0).getDate();

    // Fetch Previous Month Data (Cached if possible)
    let prevMonthAssignments = shiftState.prevMonthCache;
    if (!prevMonthAssignments) {
        prevMonthAssignments = {};
        const prevDate = new Date(year, month - 1, 0);
        const prevY = prevDate.getFullYear();
        const prevM = prevDate.getMonth() + 1;
        const prevDocId = `${prevY}-${String(prevM).padStart(2,'0')}`;
        try {
            const docRef = doc(db, "shift_submissions", prevDocId);
            const snap = await getDoc(docRef);
            if(snap.exists()) {
                const data = snap.data();
                Object.keys(data).forEach(key => {
                    if (data[key] && data[key].assignments) {
                        prevMonthAssignments[key] = data[key].assignments;
                    }
                });
            }
        } catch(e) {
            console.warn("Could not fetch prev month data", e);
        }
        shiftState.prevMonthCache = prevMonthAssignments; // Update Cache
    }

    const prevDate = new Date(year, month - 1, 0);
    const prevDaysCount = prevDate.getDate();

    // Prepare Staff Objects
    const staffNames = [
        ...staffLists.employees,
        ...staffLists.alba_early,
        ...staffLists.alba_late
    ];

    const staffObjects = staffNames.map(name => {
        const d = staffDetails[name] || {};
        const s = currentShiftData[name] || {};
        const m = s.monthly_settings || {};
        const assignments = s.assignments || {};

        // Build History (Last 7 days of prev month)
        const history = {};
        const prevAssigns = prevMonthAssignments[name] || {};
        for(let i=0; i<7; i++) {
            const offset = -i; // 0, -1, -2... (0 = prev last day)
            const dVal = prevDaysCount - i;
            const role = prevAssigns[dVal];
            history[offset] = (role && role !== '公休');
        }

        // Build assignedDays array from current assignments
        // assignedDays = Contract Days (Work + Paid + Special)
        // physicalWorkDays = Physical Presence (Work only)

        const assignedDays = [];
        const physicalWorkDays = [];

        for(let day=1; day<=daysInMonth; day++) {
            const role = assignments[day];

            // Skip Public Holiday ('公休') and Slash ('/')
            // Note: Undefined/Null is usually treated as 'Not assigned yet', but usually implies 'Work' if we are counting towards contract?
            // Wait, undefined usually means "Empty slot", which in this system defaults to "Day off" if not filled?
            // Actually, in this system, unassigned slots are usually filled by AI.
            // But if we are counting "Assigned Days", we only count what is set.
            // The requirement says: "assignedDays (契約用): 物理出勤('出勤','') + 有休 + 特休".
            // So we must count '' (Empty String) which is "Cleared but counts as work".
            // We skip '公休', '/', and undefined (truly empty).

            if (role === '公休' || role === '/' || role === undefined) continue;

            // All others (Work, Blank '', Paid, Special) count for contract
            assignedDays.push(day);

            // Physical Work: Work ('出勤') and Blank (''). Paid/Special excluded.
            if (role !== '有休' && role !== 'PAID' && role !== '特休' && role !== 'SPECIAL') {
                physicalWorkDays.push(day);
            }
        }

        return {
            name,
            rank: d.rank || '一般',
            type: d.type || 'byte',
            contractDays: d.contract_days || 20,
            maxConsecutive: d.max_consecutive_days || 5,
            allowedRoles: d.allowed_roles || [],
            shiftType: m.shift_type || d.basic_shift || 'A',
            requests: {
                work: s.work_days || [],
                off: s.off_days || [],
                types: s.shift_requests || {}
            },
            assignedDays: assignedDays,
            physicalWorkDays: physicalWorkDays,
            history,
            roleCounts: {
                [ROLES.MONEY]: 0,
                [ROLES.MONEY_SUB]: 0,
                [ROLES.HALL_RESP]: 0,
                [ROLES.WAREHOUSE]: 0,
                [ROLES.HALL]: 0
            }
        };
    });

    return { staffObjects, daysInMonth, prevMonthAssignments, prevDaysCount };
}

// --- SHARED HELPER: CHECK ASSIGNMENT CONSTRAINT ---
// Can we assign 'day' to 'staff'?
function checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, strictContractMode = false, isAdjustmentMode = false) {
    // Helper: Check Work Status (Physical Work Only) for Consecutive Checks
    // UPDATED: Pre-month Paid/Special counts as NO WORK (false)
    const checkPhysicalWork = (s, d) => {
        if (d <= 0) {
            // Check History (Prev Month)
            // history[d] was boolean (true if worked).
            // We need to know if it was PAID/SPECIAL to return false.
            // But currently history only stores boolean "isWork".
            // However, prepareShiftAnalysisContext logic:
            // "const role = prevAssigns[dVal]; history[offset] = (role && role !== '公休');"
            // This is problematic. We need to check exact role in prev assignments.

            const prevD = prevDaysCount + d; // d is negative or 0
            const role = prevMonthAssignments[s.name]?.[prevD];

            // Logic: Count as Physical Work unless it's explicitly Leave, Public Holiday, Slash, or Undefined (Empty Slot).
            // Manual Clear ('') COUNTS as Work.

            if (role === undefined || role === '公休' || role === '/' || role === '有休' || role === 'PAID' || role === '特休' || role === 'SPECIAL') return false;

            // If role is '' (empty string), it falls through and returns true (Work).
            // If role is '出勤', '金メ', etc., it returns true (Work).
            return true;
        }
        return s.physicalWorkDays.includes(d);
    };

    // 0. Absolute Request Protection (Move to TOP)
    // どんなモード（厳格モード）であっても、本人の希望休は絶対に出勤にしない
    if (staff.requests.off.includes(day)) return false;

    // 1. Strict Contract Enforcement (Highest Priority)
    // Uses assignedDays (includes Paid/Special)
    if (!strictContractMode && !isAdjustmentMode && staff.assignedDays.length >= staff.contractDays) return false;

    // 2. Strict Interval (Absolute): No Late -> Early
    // Uses physicalWorkDays for "Prev Day" check? Or assignedDays?
    // Usually Paid Leave doesn't cause interval issues. So use physicalWorkDays.
    // If I took Paid Leave yesterday, I can work Early today regardless of my shift type.

    if (day > 1) {
        if (staff.physicalWorkDays.includes(day - 1)) {
                let prevEffective = staff.shiftType;
                if (staff.requests.types[day-1] === 'early') prevEffective = 'A';
                if (staff.requests.types[day-1] === 'late') prevEffective = 'B';

                let currentEffective = staff.shiftType;
                if (staff.requests.types[day] === 'early') currentEffective = 'A';
                if (staff.requests.types[day] === 'late') currentEffective = 'B';

                if (prevEffective === 'B' && currentEffective === 'A') return false;
        }
    } else if (day === 1) {
            // Check Prev Month Last Day
            const lastRole = prevMonthAssignments[staff.name]?.[prevDaysCount];
            // Only strictly forbid if last day was Late WORK. (Not Paid/Special)
            if (lastRole && (lastRole.includes('遅') || lastRole.includes('B'))) {
                // If it was Paid/Special, lastRole wouldn't include '遅'/'B' usually unless role string is messy.
                // Assuming '有休' doesn't contain '遅'.
                if (lastRole !== '有休' && lastRole !== 'PAID' && lastRole !== '特休' && lastRole !== 'SPECIAL') {
                    let currentEffective = staff.shiftType;
                    if (staff.requests.types[day] === 'early') currentEffective = 'A';
                    if (staff.requests.types[day] === 'late') currentEffective = 'B';
                    if (currentEffective === 'A') return false;
                }
            }
    }

    // 3. Consecutive Days (UPDATED: Uses physicalWorkDays)
    let currentSeq = 1;
    // Scan Backwards
    let b = day - 1;
    while(checkPhysicalWork(staff, b)) {
        currentSeq++;
        b--;
        if (day - b > 30) break;
    }
    // Scan Forwards
    let f = day + 1;
    while(checkPhysicalWork(staff, f)) {
        currentSeq++;
        f++;
    }

    if (currentSeq > staff.maxConsecutive) return false;

    // HARD CONSTRAINT: Absolutely Block 6 Consecutive Days (Max Streak = 5)
    // regardless of user settings.
    // If assigning this day results in 6 days streak, return false.
    if (currentSeq >= 6) return false;

    // 4. Sandwich Check (Removed as per new requirements)
    // AI or Logic is allowed to create Sandwich shifts if necessary.
    // if (!checkPhysicalWork(staff, day - 1)) { ... }

    // 5. Already assigned (Check assignedDays to prevent double booking even with Paid)
    if (staff.assignedDays.includes(day)) return false;

    return true;
}

// --- NEW AUTO SHIFT LOGIC (AI) ---
async function generateAutoShift() {
    showConfirmModal(
        "AI自動作成",
        `${shiftState.currentYear}年${shiftState.currentMonth}月のシフトを自動作成します。\n既存の確定済みシフトは上書きされます（希望休などは保持）。\nよろしいですか？`,
        () => executeAutoShiftLogic()
    );
}

async function executeAutoShiftLogic(isPreview = true) {
    if (isPreview) {
        pushHistory();
        showLoading();
    }

    try {
        const Y = shiftState.currentYear;
        const M = shiftState.currentMonth;
        // Import getHolidays locally if it's not globally available in scope, assume imported at top
        const holidays = getHolidays(Y, M);
        const shifts = shiftState.shiftDataCache;
        const dailyTargets = shiftState.shiftDataCache._daily_targets || {};

        // 1. Prepare Context (Reusing Shared Logic)
        const context = await prepareShiftAnalysisContext(Y, M, shifts, shiftState.staffDetails, shiftState.staffListLists);
        const { staffObjects, daysInMonth, prevMonthAssignments, prevDaysCount } = context;

        // Clear assignments for simulation
        staffObjects.forEach(s => {
            const oldAssignments = shifts[s.name]?.assignments || {};
            const newAssignments = {};
            const newAssignedDays = [];
            const newPhysicalWorkDays = [];

            Object.keys(oldAssignments).forEach(dayKey => {
                const day = parseInt(dayKey);
                const role = oldAssignments[dayKey];

                // Keep everything except '/' or empty
                if (role && role !== '/') {
                    newAssignments[dayKey] = role;

                    // Count for contract (everything except Holiday)
                    if (role !== '公休') {
                        newAssignedDays.push(day);

                        // Physical Work (everything except Leave/Holiday)
                        if (role !== '有休' && role !== '特休' && role !== 'PAID' && role !== 'SPECIAL') {
                            newPhysicalWorkDays.push(day);
                        }
                    }
                }
            });

            s.assignedDays = newAssignedDays;
            s.physicalWorkDays = newPhysicalWorkDays;
            if(!shifts[s.name]) shifts[s.name] = {};
            shifts[s.name].assignments = newAssignments;
        });

        const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

        // Wrapper for shared constraint check
        const canAssign = (staff, day, strictContractMode = false) => {
            return checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, strictContractMode);
        };

        // Helper: Is Responsible?
        // UPDATED: Use Rank instead of Allowed Roles for Responsibility Check
        const isResponsible = (s) => ['マネージャー', '主任', '副主任'].includes(s.rank);

        // Helper: Get Target for Day
        const getTarget = (day, type) => {
            const date = new Date(Y, M - 1, day);
            const dayOfWeek = date.getDay();
            const isHol = holidays.includes(day);
            const defaultTarget = (dayOfWeek === 0 || dayOfWeek === 6 || isHol) ? 10 : 9;

            const t = dailyTargets[day] || {};
            const saved = type === 'A' ? t.A : t.B;
            return saved !== undefined ? saved : defaultTarget;
        };

        // --- PHASE 1: Employee Baseline (Ensure Responsibility) ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                // Determine target count: 2 for Sat/Sun/Holiday, 1 for Weekday
                const dateObj = new Date(Y, M - 1, d);
                const dayOfWeek = dateObj.getDay(); // 0:Sun, 6:Sat
                const isHoliday = holidays.includes(d);
                const targetRespCount = (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) ? 2 : 1;

                // Check current responsible count
                let currentRespCount = staffObjects.filter(s =>
                    s.shiftType === st && isResponsible(s) && s.physicalWorkDays.includes(d)
                ).length;

                if (currentRespCount < targetRespCount) {
                    // Try to find responsible employees to fill the gap
                    const candidates = staffObjects.filter(s =>
                        s.shiftType === st && isResponsible(s) && canAssign(s, d)
                    );
                    // Sort by request priority, then by fewer assignments
                    candidates.sort((a,b) => {
                        const reqA = a.requests.work.includes(d) ? 1 : 0;
                        const reqB = b.requests.work.includes(d) ? 1 : 0;
                        if (reqA !== reqB) return reqB - reqA;
                        return a.assignedDays.length - b.assignedDays.length;
                    });

                    for (const cand of candidates) {
                        if (currentRespCount >= targetRespCount) break;
                        // Avoid double assignment if not handled by canAssign (it is handled but safe to check)
                        if (!cand.assignedDays.includes(d)) {
                            cand.assignedDays.push(d);
                            cand.physicalWorkDays.push(d);
                            currentRespCount++;
                        }
                    }
                }
            });
        });

        // --- PHASE 2: Fill Employees to Baseline (Approx 4) ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                let count = staffObjects.filter(s => s.shiftType === st && s.type === 'employee' && s.physicalWorkDays.includes(d)).length;
                if (count < 4) {
                     const candidates = staffObjects.filter(s =>
                        s.shiftType === st && s.type === 'employee' && canAssign(s, d)
                    );
                     candidates.sort((a,b) => {
                         const reqA = a.requests.work.includes(d) ? 1 : 0;
                         const reqB = b.requests.work.includes(d) ? 1 : 0;
                         if (reqA !== reqB) return reqB - reqA;
                         return a.assignedDays.length - b.assignedDays.length;
                     });
                     for (const c of candidates) {
                         if (count >= 4) break;
                         if (c.assignedDays.length >= c.contractDays) continue;
                         c.assignedDays.push(d);
                         c.physicalWorkDays.push(d);
                         count++;
                     }
                }
            });
        });

        // Helper: Calculate potential streak if assigned
        // Note: canAssign already calls checkAssignmentConstraint which checks HARD limits (>=6).
        // This helper is for SOFT limit (avoid 5 if possible).
        const getPotentialStreak = (staff, day) => {
            // Need access to checkPhysicalWork logic. We can reuse the one from context if we extract it or just duplicate simple logic.
            // Simplified Streak Calc:
            // Backwards
            let seq = 1;
            let b = day - 1;
            while(true) {
                if (b <= 0) {
                    // History check
                    const prevD = prevDaysCount + b;
                    const role = prevMonthAssignments[staff.name]?.[prevD];
                    if (role === undefined || role === '公休' || role === '/' || role === '有休' || role === 'PAID' || role === '特休' || role === 'SPECIAL') break;
                    // else it is Work or ''(deleted -> wait, deleted is undefined in history obj? No, history obj is from DB).
                    // In DB '' is stored as ''. undefined is missing key.
                    // If DB has '', it is work. If DB has no key, it is undefined -> break.
                    seq++;
                    b--;
                } else {
                    if (staff.physicalWorkDays.includes(b)) {
                        seq++;
                        b--;
                    } else {
                        break;
                    }
                }
            }
            // Forwards
            let f = day + 1;
            while(staff.physicalWorkDays.includes(f)) {
                seq++;
                f++;
            }
            return seq;
        };

        // --- PHASE 3: Employee Contract Fill (Normal) ---
        let changed = true;
        while(changed) {
            changed = false;
            const needy = staffObjects.filter(s => s.type === 'employee' && s.assignedDays.length < s.contractDays);
            needy.sort((a,b) => (a.contractDays - a.assignedDays.length) - (b.contractDays - b.assignedDays.length)).reverse();

            for (const emp of needy) {
                 if (emp.assignedDays.length >= emp.contractDays) continue;
                 let validDays = days.filter(d => emp.requests.work.includes(d) && canAssign(emp, d));
                 if (validDays.length === 0) {
                     validDays = days.filter(d => !emp.requests.work.includes(d) && canAssign(emp, d));
                 }
                 if (validDays.length > 0) {
                     // Filter/Sort by Streak Preference (Avoid 5)
                     // Soft Constraint: Prefer days where streak <= 4. Backup: Streak == 5.
                     // (Streak >= 6 blocked by canAssign)

                     validDays.sort((d1, d2) => {
                         const s1 = getPotentialStreak(emp, d1);
                         const s2 = getPotentialStreak(emp, d2);
                         const bad1 = s1 >= 5 ? 1 : 0;
                         const bad2 = s2 >= 5 ? 1 : 0;
                         if (bad1 !== bad2) return bad1 - bad2; // Prioritize low streak

                         const t1 = getTarget(d1, emp.shiftType);
                         const c1 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d1)).length;
                         const fill1 = c1 / t1;
                         const t2 = getTarget(d2, emp.shiftType);
                         const c2 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d2)).length;
                         const fill2 = c2 / t2;
                         return fill1 - fill2;
                     });

                     const bestDay = validDays[0];
                     emp.assignedDays.push(bestDay);
                     // Update physicalWorkDays if not leave (here we assume Work for contract fill)
                     emp.physicalWorkDays.push(bestDay);
                     changed = true;
                 }
            }
        }

        // --- PHASE 4: Alba Fill (Target based) ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                const target = getTarget(d, st);
                let current = staffObjects.filter(s => s.shiftType === st && s.physicalWorkDays.includes(d)).length;

                if (current < target) {
                     const candidates = staffObjects.filter(s =>
                        s.shiftType === st && s.type === 'byte' && canAssign(s, d)
                    );
                     candidates.sort((a,b) => {
                         // Primary Sort: Streak Preference (Soft Limit)
                         const sA = getPotentialStreak(a, d);
                         const sB = getPotentialStreak(b, d);
                         const badA = sA >= 5 ? 1 : 0;
                         const badB = sB >= 5 ? 1 : 0;
                         if (badA !== badB) return badA - badB;

                         const reqA = a.requests.work.includes(d) ? 1 : 0;
                         const reqB = b.requests.work.includes(d) ? 1 : 0;
                         if(reqA !== reqB) return reqB - reqA;
                         const needA = a.contractDays - a.assignedDays.length;
                         const needB = b.contractDays - b.assignedDays.length;
                         return needB - needA;
                     });

                     for(const c of candidates) {
                         if (current >= target) break;
                         if (c.assignedDays.length >= c.contractDays) continue;
                         c.assignedDays.push(d);
                         c.physicalWorkDays.push(d); // Track physical work
                         current++;
                     }
                }
            });
        });

        // --- PHASE 5: Alba Contract Fill (Force) ---
        changed = true;
        while(changed) {
            changed = false;
            const needy = staffObjects.filter(s => s.type === 'byte' && s.assignedDays.length < s.contractDays);
            for(const alba of needy) {
                const validDays = days.filter(d => canAssign(alba, d));
                 if (validDays.length > 0) {
                     validDays.sort((d1, d2) => {
                         const c1 = staffObjects.filter(s => s.shiftType === alba.shiftType && s.assignedDays.includes(d1)).length;
                         const c2 = staffObjects.filter(s => s.shiftType === alba.shiftType && s.assignedDays.includes(d2)).length;
                         return c1 - c2;
                     });
                     alba.assignedDays.push(validDays[0]);
                     alba.physicalWorkDays.push(validDays[0]);
                     changed = true;
                 }
            }
        }

        // --- PHASE 6: STRICT CONTRACT ENFORCEMENT (Employees Only) ---
        const needyEmployees = staffObjects.filter(s => s.type === 'employee' && s.assignedDays.length < s.contractDays);
        for (const emp of needyEmployees) {
            while (emp.assignedDays.length < emp.contractDays) {
                const candidates = days.filter(d => canAssign(emp, d, true)); // strictContractMode = true
                if (candidates.length === 0) break;
                 candidates.sort((d1, d2) => {
                     const c1 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d1)).length;
                     const c2 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d2)).length;
                     return c1 - c2;
                 });
                 emp.assignedDays.push(candidates[0]);
                 emp.physicalWorkDays.push(candidates[0]);
            }
        }

        // --- PHASE 7: Role Assignment ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                // Identify all staff assigned to this day (Contract fulfilled)
                const allAssigned = staffObjects.filter(s => s.shiftType === st && s.assignedDays.includes(d));

                const leaveGroup = [];
                let workGroup = [];

                // Split into Leave vs Work based on Requests
                allAssigned.forEach(s => {
                    const req = s.requests.types[d];
                    // Check if already has a fixed assignment (from carryover)
                    const existing = shifts[s.name].assignments[d];

                    if (req === 'PAID') {
                        leaveGroup.push(s);
                        shifts[s.name].assignments[d] = '有休';
                    } else if (req === 'SPECIAL') {
                        leaveGroup.push(s);
                        shifts[s.name].assignments[d] = '特休';
                    } else {
                        // Only add to workGroup for AI role assignment if no existing fixed assignment
                        if (!existing) {
                            workGroup.push(s);
                        }
                    }
                });

                // Helper to assign role (Operates on workGroup only)
                const assign = (roleKey, filterFn) => {
                    const candidates = workGroup.filter(filterFn);
                    if (candidates.length === 0) return;
                    candidates.sort((a,b) => a.roleCounts[roleKey] - b.roleCounts[roleKey]);
                    const picked = candidates[0];
                    shifts[picked.name].assignments[d] = roleKey;
                    picked.roleCounts[roleKey]++;
                    workGroup = workGroup.filter(u => u !== picked); // Remove from pool
                };

                // 1. Money Main
                if (shiftState.autoShiftSettings.money) {
                    assign(ROLES.MONEY, s => s.allowedRoles.includes('money_main'));
                }

                // 2. Money Sub
                if (shiftState.autoShiftSettings.money) {
                    assign(ROLES.MONEY_SUB, s => s.allowedRoles.includes('money_sub'));
                }

                // 3. Hall Resp
                if (shiftState.autoShiftSettings.hall_resp) {
                    assign(ROLES.HALL_RESP, s => s.allowedRoles.includes('hall_resp'));
                }

                // 4. Warehouse
                if (shiftState.autoShiftSettings.warehouse) {
                    assign(ROLES.WAREHOUSE, s => {
                        if (!s.allowedRoles.includes('warehouse')) return false;
                        if (shiftState.earlyWarehouseMode && s.type === 'employee' && s.shiftType === 'A') return false;
                        return true;
                    });
                }

                // 5. Others -> Work ('出勤')
                workGroup.forEach(s => {
                    shifts[s.name].assignments[d] = '出勤';
                });

                // Mark Off days (Anyone NOT in allAssigned)
                const offStaff = staffObjects.filter(s => s.shiftType === st && !s.assignedDays.includes(d));
                offStaff.forEach(s => {
                    // Only set if not already set (though usually undefined here)
                    if (!shifts[s.name].assignments[d]) {
                        shifts[s.name].assignments[d] = '/';
                    }
                });
            });
        });

        // Cleanup and Save
        const staffNames = [
            ...shiftState.staffListLists.employees,
            ...shiftState.staffListLists.alba_early,
            ...shiftState.staffListLists.alba_late
        ];

        staffNames.forEach(name => {
            if (!shifts[name]) shifts[name] = {};
            if (!shifts[name].assignments) shifts[name].assignments = {};
            for (let d = 1; d <= daysInMonth; d++) {
                if (!shifts[name].assignments[d]) {
                    shifts[name].assignments[d] = '/';
                }
            }
        });

        // --- Post-Generation Check ---
        const missingResponsibility = [];
        for (let d = 1; d <= daysInMonth; d++) {
             ['A', 'B'].forEach(type => {
                 const hasResponsible = staffObjects.some(s =>
                     s.shiftType === type &&
                     s.assignedDays.includes(d) &&
                     s.allowedRoles.includes('money_main')
                 );
                 if (!hasResponsible) {
                     missingResponsibility.push(`・${d}日 (${type === 'A' ? '早番' : '遅番'})`);
                 }
             });
        }

        if (missingResponsibility.length > 0) {
            alert(`⚠️ 以下の日程で責任者（金銭メイン）が不足しています。手動で調整してください。\n\n${missingResponsibility.join('\n')}`);
        }

        // --- Calculate Stats for Preview ---
        let filledCount = 0;
        let staffSet = new Set();
        Object.keys(shifts).forEach(name => {
             // Compare with previous state (from history)
             const prevData = shiftState.historyStack[shiftState.historyStack.length - 1][name] || { assignments: {} };
             const currAssign = shifts[name].assignments || {};
             Object.keys(currAssign).forEach(d => {
                 if (currAssign[d] !== '公休' && prevData.assignments?.[d] !== currAssign[d]) {
                     filledCount++;
                     staffSet.add(name);
                 }
             });
        });

        if (isPreview) {
            showAutoShiftPreviewModal(filledCount, staffSet.size);
        }

    } catch(e) {
        console.error("Auto Generation Error:", e);
        if (isPreview) alert("自動作成中にエラーが発生しました:\n" + e.message);
        else throw e;
    } finally {
        if (isPreview) hideLoading();
    }
}

// --- NEW FEATURE: ADJUSTMENT CANDIDATE SEARCH ---
async function openAdjustmentCandidateModal(day, currentStaffName, currentRole) {
    showLoading();

    // 1. Prepare Data
    const Y = shiftState.currentYear;
    const M = shiftState.currentMonth;
    const context = await prepareShiftAnalysisContext(Y, M, shiftState.shiftDataCache, shiftState.staffDetails, shiftState.staffListLists);
    const { staffObjects, prevMonthAssignments, prevDaysCount } = context;

    // Identify target details
    const targetStaffObj = staffObjects.find(s => s.name === currentStaffName);

    // ★Fix: データ不整合時のガード処理を追加 (Null Safety)
    if (!targetStaffObj) {
        console.error(`Staff not found: ${currentStaffName}`);
        alert("エラー: 選択されたスタッフのマスタデータが見つかりません。");
        hideLoading();
        return;
    }

    const shiftType = targetStaffObj.shiftType || 'A'; // Default to A if not found

    // 2. Filter Candidates
    // Requirements:
    // 1. Current assignment is Undefined OR '' OR '/'
    // 2. Not requested Off (Public Holiday Request)

    const candidates = staffObjects.filter(staff => {
        if (staff.name === currentStaffName) return false;

        // Condition 1: Must be "Available" (No valid assignment)
        // assignedDays includes Work, Paid, Special.
        // If I am working, I can't be a candidate.
        // Wait, "adjustment candidate" means someone who can TAKE the shift.
        // So they shouldn't be working that day.

        // Check actual assignment string
        const currentAssign = shiftState.shiftDataCache[staff.name]?.assignments?.[day];
        // Strictly: Undefined, '', or '/' (removed '公休' per rigorous requirement)
        const isFree = (currentAssign === undefined || currentAssign === '' || currentAssign === '/');

        // Note: '公休' (Holiday) assignment is usually because they Requested Off or were just not assigned.
        // Requirement says: "かつ、公休希望を出していないこと" (And must NOT have requested Off).

        // Condition 2: No Public Holiday Request
        const requestedOff = staff.requests.off.includes(day);

        if (!isFree) return false;
        if (requestedOff) return false;

        // シフトタイプ(A/B)が違う人は候補に出さない（ここは維持）
        if (staff.shiftType !== shiftType) return false;

        // Check Constraints (Consecutive days, interval, etc)
        // Passing isAdjustmentMode = true to ignore Contract Limits
        return checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, false, true);
    });

    // 3. Render Modal
    const modalDesc = document.getElementById('adj-modal-desc');
    modalDesc.textContent = `${M}/${day} (${shiftType}番) ${currentStaffName} さんの代わりを選択してください`;

    const listContainer = document.getElementById('adj-candidate-list');
    listContainer.innerHTML = '';

    if (candidates.length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-center text-slate-400 py-4">条件を満たす候補者はいません</p>';
    } else {
        candidates.sort((a,b) => {
            const remA = a.contractDays - a.assignedDays.length;
            const remB = b.contractDays - b.assignedDays.length;
            return remB - remA;
        });

        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 cursor-pointer transition";
            div.onclick = () => showAdjustmentConfirmModal(day, currentStaffName, c.name, currentRole);
            const rem = c.contractDays - c.assignedDays.length;

            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm shadow-sm">👤</div>
                    <div>
                        <div class="font-bold text-slate-700 text-sm">${c.name}</div>
                        <div class="text-[10px] text-slate-400 font-bold">${c.rank} / 残り枠:${rem}</div>
                    </div>
                </div>
                <button class="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-indigo-700">交代</button>
            `;
            listContainer.appendChild(div);
        });
    }

    document.getElementById('adjustment-candidate-modal').classList.remove('hidden');
    hideLoading();
}

function showAdjustmentConfirmModal(day, oldStaff, newStaff, role) {
    document.getElementById('adj-confirm-old').textContent = oldStaff;
    document.getElementById('adj-confirm-new').textContent = newStaff;

    const btn = document.getElementById('btn-exec-adjustment');
    btn.onclick = () => finalizeAdjustmentReplacement(day, oldStaff, newStaff, role);

    document.getElementById('adjustment-confirm-modal').classList.remove('hidden');
}

async function finalizeAdjustmentReplacement(day, oldStaff, newStaff, role) {
    document.getElementById('adjustment-confirm-modal').classList.add('hidden');
    pushHistory();

    // Update Old Staff -> Off
    if (!shiftState.shiftDataCache[oldStaff].assignments) shiftState.shiftDataCache[oldStaff].assignments = {};
    shiftState.shiftDataCache[oldStaff].assignments[day] = '公休';

    // Update New Staff -> Assigned (Inherit Role or ShiftType Default)
    if (!shiftState.shiftDataCache[newStaff]) shiftState.shiftDataCache[newStaff] = { assignments: {} };
    if (!shiftState.shiftDataCache[newStaff].assignments) shiftState.shiftDataCache[newStaff].assignments = {};

    shiftState.shiftDataCache[newStaff].assignments[day] = role; // Transfer the role

    // Save
    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);

    const update = {};
    update[oldStaff] = shiftState.shiftDataCache[oldStaff];
    update[newStaff] = shiftState.shiftDataCache[newStaff];

    try {
        await setDoc(docRef, update, { merge: true });

        document.getElementById('adjustment-candidate-modal').classList.add('hidden');
        renderShiftAdminTable();
        showToast(`${newStaff} さんに交代しました`);

        // ★追加: 代休提案モーダルを開く
        setTimeout(() => {
            showCompensatoryOffModal(newStaff);
        }, 500);

    } catch(e) {
        alert("保存エラー: " + e.message);
    }
}

async function clearShiftAssignments() {
    showConfirmModal("割り振りクリア", "割り振りを全てクリアしますか？", async () => {
        pushHistory();
        Object.keys(shiftState.shiftDataCache).forEach(name => {
            if(shiftState.shiftDataCache[name]) {
                shiftState.shiftDataCache[name].assignments = {};
            }
        });
        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        await setDoc(doc(db, "shift_submissions", docId), shiftState.shiftDataCache);
        renderShiftAdminTable();
        showToast("クリアしました");
    }, 'bg-rose-600');
}

export async function saveShiftSubmission() {
    if (shiftState.isAdminMode) return;
    const name = shiftState.selectedStaff;
    const remarks = document.getElementById('shift-remarks-input').value;
    if(shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name].remarks = remarks;
    await saveShiftToFirestore(name);
    showToast("提出しました");
    backToShiftList();
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
    else if(shiftState.selectedStaff) renderShiftCalendar();
}

window.showActionSelectModal = showActionSelectModal;
window.closeShiftActionModal = closeShiftActionModal;
window.clearShiftAssignments = clearShiftAssignments;
window.generateAutoShift = generateAutoShift;

// --- Rank Options Logic ---
window.updateRankOptions = () => {
    const type = document.getElementById('se-type').value;
    const rankSelect = document.getElementById('se-rank');
    rankSelect.innerHTML = '';
    const options = type === 'employee' ? RANKS.EMPLOYEE : RANKS.BYTE;
    options.forEach(r => {
        const op = document.createElement('option');
        op.value = r;
        op.textContent = r;
        rankSelect.appendChild(op);
    });
};

// --- Staff Sort Reset ---
window.resetStaffSort = async () => {
    showConfirmModal("並び順リセット", "現在の並び順を役職・ランク順にリセットしますか？", async () => {
        _executeResetStaffSort();
    });
};

async function _executeResetStaffSort() {
    showLoading();

    // Sort Helper
    const sortList = (list, isEmployee) => {
        const ranks = isEmployee ? RANKS.EMPLOYEE : RANKS.BYTE;
        return list.sort((a,b) => {
            const dA = shiftState.staffDetails[a] || {};
            const dB = shiftState.staffDetails[b] || {};
            const rA = dA.rank || '一般';
            const rB = dB.rank || 'レギュラー';
            const iA = ranks.indexOf(rA);
            const iB = ranks.indexOf(rB);
            if(iA !== iB) return iA - iB; // Lower index is higher rank
            return a.localeCompare(b);
        });
    };

    shiftState.staffListLists.employees = sortList(shiftState.staffListLists.employees, true);
    shiftState.staffListLists.alba_early = sortList(shiftState.staffListLists.alba_early, false);
    shiftState.staffListLists.alba_late = sortList(shiftState.staffListLists.alba_late, false);

    await saveStaffOrder();
    renderStaffMasterList();
    renderShiftAdminTable();
    hideLoading();
    showToast("並び順をリセットしました");
};

window.openStaffMasterModal = () => {
    renderStaffMasterList();
    document.getElementById('staff-master-modal').classList.remove('hidden');
};

window.openStaffEditModal = (name) => {
    const modal = document.getElementById('staff-edit-modal');
    modal.classList.remove('hidden');
    document.getElementById('staff-edit-title').textContent = name ? "スタッフ編集" : "追加";

    const nameInput = document.getElementById('se-name');
    nameInput.value = name || "";
    nameInput.setAttribute('data-original-name', name || "");

    const details = (name ? shiftState.staffDetails[name] : {}) || {};

    // Set Fields
    document.getElementById('se-type').value = details.type || 'byte';
    document.getElementById('se-basic-shift').value = details.basic_shift || 'A';
    document.getElementById('se-contract-days').value = details.contract_days || 20;
    document.getElementById('se-max-consecutive').value = details.max_consecutive_days || 5;

    // Update Ranks based on type, then select
    window.updateRankOptions();
    if(details.rank) document.getElementById('se-rank').value = details.rank;

    // Checkboxes
    const allowed = details.allowed_roles || [];
    document.getElementById('se-allow-money-main').checked = allowed.includes('money_main');
    document.getElementById('se-allow-money-sub').checked = allowed.includes('money_sub');
    document.getElementById('se-allow-warehouse').checked = allowed.includes('warehouse');
    document.getElementById('se-allow-hall-resp').checked = allowed.includes('hall_resp');
    document.getElementById('se-allow-nakaban').checked = allowed.includes('nakaban');
};

// --- Staff List Rendering with Reorder ---
window.moveStaff = (listKey, index, direction) => {
    const list = shiftState.staffListLists[listKey];
    if (!list) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];

    // Save Immediate
    saveStaffOrder().then(() => {
        renderStaffMasterList();
        renderShiftAdminTable(); // Reflect order in matrix
    });
};

async function saveStaffOrder() {
    const docRef = doc(db, 'masters', 'staff_data');
    try {
        await setDoc(docRef, {
            employees: shiftState.staffListLists.employees,
            alba_early: shiftState.staffListLists.alba_early,
            alba_late: shiftState.staffListLists.alba_late
        }, { merge: true });
    } catch(e) {
        console.error("Order Save Error", e);
        showToast("順序保存エラー");
    }
}

function renderStaffMasterList() {
    const listContainer = document.getElementById('staff-master-list');
    listContainer.innerHTML = '';

    const createItem = (name, type, listKey, index, total) => {
        const details = shiftState.staffDetails[name] || {};
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm mb-2";

        // Up/Down buttons
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const upDisabled = isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200';
        const downDisabled = isLast ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200';

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="flex flex-col gap-1">
                    <button class="w-6 h-6 rounded flex items-center justify-center bg-slate-100 text-slate-500 font-bold text-xs ${upDisabled}" onclick="window.moveStaff('${listKey}', ${index}, -1)">↑</button>
                    <button class="w-6 h-6 rounded flex items-center justify-center bg-slate-100 text-slate-500 font-bold text-xs ${downDisabled}" onclick="window.moveStaff('${listKey}', ${index}, 1)">↓</button>
                </div>
                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">👤</div>
                <div>
                    <div class="font-bold text-slate-700 text-sm">${name}</div>
                    <div class="text-[10px] text-slate-400 font-bold">${type === 'employee' ? '社員' : 'アルバイト'} / ${details.rank || '-'}</div>
                    ${renderRoleBadges(details.allowed_roles)}
                </div>
            </div>
            <button class="px-3 py-1.5 bg-slate-50 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-100 border border-slate-200 transition edit-staff-btn">編集</button>
        `;
        div.querySelector('.edit-staff-btn').onclick = () => openStaffEditModal(name);
        listContainer.appendChild(div);
    };

    const renderGroup = (key, typeLabel) => {
        const list = shiftState.staffListLists[key];
        const header = document.createElement('div');
        header.className = "text-xs font-bold text-slate-400 mt-4 mb-2 ml-1 uppercase tracking-widest";
        header.textContent = typeLabel;
        listContainer.appendChild(header);
        list.forEach((name, i) => createItem(name, key==='employees'?'employee':'byte', key, i, list.length));
    };

    renderGroup('employees', 'Employee (社員)');
    renderGroup('alba_early', 'Part-time (早番)');
    renderGroup('alba_late', 'Part-time (遅番)');
}

async function saveStaffDetails() {
    const oldName = document.getElementById('se-name').getAttribute('data-original-name');
    const newName = document.getElementById('se-name').value.trim();
    if(!newName) return alert("名前を入力してください");

    // Gather data from form
    const type = document.getElementById('se-type').value;
    const basicShift = document.getElementById('se-basic-shift').value;
    const rank = document.getElementById('se-rank').value;
    const contractDays = parseInt(document.getElementById('se-contract-days').value) || 0;
    const maxConsecutive = parseInt(document.getElementById('se-max-consecutive').value) || 5;

    const allowedRoles = [];
    if(document.getElementById('se-allow-money-main').checked) allowedRoles.push('money_main');
    if(document.getElementById('se-allow-money-sub').checked) allowedRoles.push('money_sub');
    if(document.getElementById('se-allow-warehouse').checked) allowedRoles.push('warehouse');
    if(document.getElementById('se-allow-hall-resp').checked) allowedRoles.push('hall_resp');
    if(document.getElementById('se-allow-nakaban').checked) allowedRoles.push('nakaban');

    const newDetails = {
        rank, type, basic_shift: basicShift,
        contract_days: contractDays,
        max_consecutive_days: maxConsecutive,
        allowed_roles: allowedRoles
    };

    let targetListKey = 'employees';
    if(type === 'byte') {
        targetListKey = basicShift === 'A' ? 'alba_early' : 'alba_late';
    }

    showLoading();

    // 1. Update State (Details & Shift Cache)
    if (oldName && oldName !== newName) {
        delete shiftState.staffDetails[oldName];
        // ★Fix: シフト表の名前キーも移行
        if (shiftState.shiftDataCache[oldName]) {
            shiftState.shiftDataCache[newName] = shiftState.shiftDataCache[oldName];
            delete shiftState.shiftDataCache[oldName];
        }
    }
    shiftState.staffDetails[newName] = newDetails;

    // 2. Update Lists
    let oldListKey = null;
    let oldIndex = -1;
    ['employees', 'alba_early', 'alba_late'].forEach(k => {
        const idx = shiftState.staffListLists[k].indexOf(oldName);
        if(idx !== -1) { oldListKey = k; oldIndex = idx; }
    });

    if (oldListKey === targetListKey) {
        if (oldName !== newName && oldIndex !== -1) {
            shiftState.staffListLists[targetListKey][oldIndex] = newName;
        }
    } else {
        if (oldListKey && oldIndex !== -1) {
            shiftState.staffListLists[oldListKey].splice(oldIndex, 1);
        }
        shiftState.staffListLists[targetListKey].push(newName);
    }

    // Save
    try {
        // マスタ保存
        await setDoc(doc(db, 'masters', 'staff_data'), {
            employees: shiftState.staffListLists.employees,
            alba_early: shiftState.staffListLists.alba_early,
            alba_late: shiftState.staffListLists.alba_late,
            staff_details: shiftState.staffDetails
        });

        // ★Fix: 名前の変更があった場合、当月のシフトデータも更新
        // 古い名前を消すため、merge: true を使わずにドキュメント全体を上書きする
        if (oldName && oldName !== newName) {
            const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
            const docRef = doc(db, "shift_submissions", docId);
            await setDoc(docRef, shiftState.shiftDataCache); // Overwrite to remove old key
        }

        showToast("保存しました");
        document.getElementById('staff-edit-modal').classList.add('hidden');
        renderStaffMasterList();
        renderShiftAdminTable();
    } catch(e) {
        alert("保存エラー: " + e.message);
    }
    hideLoading();
}

async function deleteStaff() {
    const name = document.getElementById('se-name').getAttribute('data-original-name');
    if(!name) return;

    showConfirmModal("スタッフ削除", `スタッフ「${name}」を削除しますか？\nこの操作は取り消せません。`, async () => {
        _executeDeleteStaff(name);
    }, 'bg-rose-600');
}

async function _executeDeleteStaff(name) {
    showLoading();

    delete shiftState.staffDetails[name];
    ['employees', 'alba_early', 'alba_late'].forEach(k => {
        shiftState.staffListLists[k] = shiftState.staffListLists[k].filter(n => n !== name);
    });

    try {
        await setDoc(doc(db, 'masters', 'staff_data'), {
            employees: shiftState.staffListLists.employees,
            alba_early: shiftState.staffListLists.alba_early,
            alba_late: shiftState.staffListLists.alba_late,
            staff_details: shiftState.staffDetails
        });
        showToast("削除しました");
        document.getElementById('staff-edit-modal').classList.add('hidden');
        renderStaffMasterList();
        renderShiftAdminTable();
    } catch(e) {
        alert("削除エラー: " + e.message);
    }
    hideLoading();
}

window.openDailyTargetModal = (day) => {
    shiftState.selectedDay = day;
    document.getElementById('daily-target-title').textContent = `${shiftState.currentMonth}/${day} 定員設定`;
    const targets = shiftState.shiftDataCache._daily_targets || {};
    const t = targets[day] || {};
    document.getElementById('target-a-input').value = t.A !== undefined ? t.A : 9;
    document.getElementById('target-b-input').value = t.B !== undefined ? t.B : 9;
    document.getElementById('daily-target-modal').classList.remove('hidden');
};

window.saveDailyTarget = async () => {
    const day = shiftState.selectedDay;
    if(!day) return;
    const valA = parseInt(document.getElementById('target-a-input').value) || 0;
    const valB = parseInt(document.getElementById('target-b-input').value) || 0;

    if (!shiftState.shiftDataCache._daily_targets) shiftState.shiftDataCache._daily_targets = {};
    shiftState.shiftDataCache._daily_targets[day] = { A: valA, B: valB };

    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        await setDoc(docRef, { _daily_targets: shiftState.shiftDataCache._daily_targets }, { merge: true });
        showToast("定員を保存しました");
        document.getElementById('daily-target-modal').classList.add('hidden');
        renderShiftAdminTable();
    } catch(e) {
        alert("保存失敗: " + e.message);
    }
};

// --- New Inline Saving Logic ---
window.saveDailyTargetInline = async (day, type, inputElement) => {
    const val = parseInt(inputElement.value) || 0;
    if (!shiftState.shiftDataCache._daily_targets) shiftState.shiftDataCache._daily_targets = {};
    if (!shiftState.shiftDataCache._daily_targets[day]) shiftState.shiftDataCache._daily_targets[day] = {};

    // Check if changed to avoid unnecessary writes
    const current = shiftState.shiftDataCache._daily_targets[day][type];

    if (current === val) return;

    // Ensure object structure
    if(shiftState.shiftDataCache._daily_targets[day].A === undefined) shiftState.shiftDataCache._daily_targets[day].A = 9;
    if(shiftState.shiftDataCache._daily_targets[day].B === undefined) shiftState.shiftDataCache._daily_targets[day].B = 9;

    shiftState.shiftDataCache._daily_targets[day][type] = val;

    const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        // Silent Save
        await setDoc(docRef, { _daily_targets: shiftState.shiftDataCache._daily_targets }, { merge: true });
    } catch(e) {
        console.error("Inline Save Error:", e);
        showToast("定員保存エラー", "red");
    }
};

window.handleDailyTargetKeydown = (event, day, type) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur(); // Trigger save via blur

        // Find next input
        const nextDay = day + 1;
        const nextInput = document.getElementById(`target-input-${type}-${nextDay}`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
};

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
window.closeAdminNoteModal = closeAdminNoteModal;
window.showAdminNoteModal = showAdminNoteModal;

// --- COMPENSATORY OFF SUGGESTION (NEW) ---
async function showCompensatoryOffModal(staffName) {
    showLoading();

    const Y = shiftState.currentYear;
    const M = shiftState.currentMonth;
    const daysInMonth = new Date(Y, M, 0).getDate();
    const holidays = getHolidays(Y, M);

    // データ準備
    const shifts = shiftState.shiftDataCache;
    const targets = shifts._daily_targets || {};
    const staffData = shifts[staffName] || {};
    const assignments = staffData.assignments || {};
    const details = shiftState.staffDetails[staffName] || {};
    const staffShiftType = (staffData.monthly_settings?.shift_type) || details.basic_shift || 'A';

    const listContainer = document.getElementById('comp-off-list');
    listContainer.innerHTML = '';

    document.getElementById('comp-off-desc').textContent = `${staffName} さんの出勤日一覧`;

    // 候補日を算出
    const candidates = [];

    for(let d=1; d<=daysInMonth; d++) {
        const role = assignments[d];
        if(role && role !== '公休') {

            // 1. その日の「同シフトタイプ」の人数をカウント
            let count = 0;
            const allNames = [...shiftState.staffListLists.employees, ...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late];

            allNames.forEach(n => {
                const s = shifts[n] || {};
                const r = s.assignments?.[d];
                const type = (s.monthly_settings?.shift_type) || (shiftState.staffDetails[n]?.basic_shift) || 'A';

                if(r && r !== '公休' && type === staffShiftType) {
                    count++;
                }
            });

            // 2. 定員チェック (自分が1人抜けた後でも、目標以上か？)
            const targetObj = targets[d] || {};
            const targetNum = (staffShiftType === 'A' ? targetObj.A : targetObj.B) || 9;
            const isSafe = (count - 1) >= targetNum;

            candidates.push({
                day: d,
                role: role,
                isSafe: isSafe,
                count: count,
                target: targetNum
            });
        }
    }

    // 表示生成
    if(candidates.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-slate-400 text-xs py-4">出勤日がありません</p>';
    } else {
        candidates.sort((a,b) => {
            if (a.isSafe !== b.isSafe) return b.isSafe ? 1 : -1;
            return 0;
        });

        candidates.forEach(c => {
            const date = new Date(Y, M-1, c.day);
            const dayName = ['日','月','火','水','木','金','土'][date.getDay()];
            const isHol = holidays.includes(c.day) || date.getDay() === 0;
            const color = isHol ? 'text-rose-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-slate-700';

            let borderClass = c.isSafe ? 'border-emerald-200' : 'border-orange-200';
            let bgClass = c.isSafe ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-white hover:bg-orange-50';
            let badge = c.isSafe
                ? '<span class="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded font-bold">推奨◎</span>'
                : '<span class="text-[10px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded font-bold border border-orange-100">人手不足△</span>';

            const btn = document.createElement('button');
            btn.className = `w-full flex items-center justify-between p-3 rounded-xl border ${borderClass} ${bgClass} mb-2 transition text-left group`;
            btn.onclick = () => applyCompensatoryOff(staffName, c.day);

            btn.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold font-num w-8 text-center ${color}">${c.day}<span class="text-[10px] ml-0.5">(${dayName})</span></span>
                    <div>
                        <div class="text-xs font-bold text-slate-700">現在のシフト: ${c.role}</div>
                        <div class="text-[10px] text-slate-400 group-hover:text-slate-500">
                            現在 ${c.count}人 <span class="text-slate-300 mx-1">/</span> 目標 ${c.target}人
                        </div>
                    </div>
                </div>
                ${badge}
            `;
            listContainer.appendChild(btn);
        });
    }

    document.getElementById('compensatory-off-modal').classList.remove('hidden');
    hideLoading();
}

async function applyCompensatoryOff(name, day) {
    showConfirmModal("代休設定", `${day}日を代休（公休）に変更しますか？`, async () => {
        // 公休に変更
        shiftState.shiftDataCache[name].assignments[day] = '公休';

        // 保存
        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        const docRef = doc(db, "shift_submissions", docId);

        await setDoc(docRef, { [name]: shiftState.shiftDataCache[name] }, { merge: true });

        showToast(`${day}日を代休に設定しました`);
        document.getElementById('compensatory-off-modal').classList.add('hidden');
        renderShiftAdminTable();
    });
}

window.closeCompensatoryModal = () => {
    document.getElementById('compensatory-off-modal').classList.add('hidden');
};

window.showAutoShiftPreviewModal = (filled, staffCount) => {
    document.getElementById('preview-filled-count').textContent = filled;
    document.getElementById('preview-staff-count').textContent = staffCount + '名';
    document.getElementById('auto-shift-preview-modal').classList.remove('hidden');
};

window.cancelAutoShift = () => {
    document.getElementById('auto-shift-preview-modal').classList.add('hidden');
    // Revert local changes from history without saving to DB (since we never saved)
    if(shiftState.historyStack.length > 0) {
        shiftState.shiftDataCache = shiftState.historyStack.pop();
        // Hide Undo button if stack empty (it was pushed just for this op)
        if(shiftState.historyStack.length === 0) document.getElementById('btn-undo-action').classList.add('hidden');
        renderShiftAdminTable();
    }
};

window.finalizeAutoShift = async () => {
    showLoading();
    try {
        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        const docRef = doc(db, "shift_submissions", docId);
        await setDoc(docRef, shiftState.shiftDataCache, { merge: true });
        showToast("AIシフト自動作成完了！");
        document.getElementById('auto-shift-preview-modal').classList.add('hidden');
        renderShiftAdminTable();
    } catch(e) {
        alert("保存エラー: " + e.message);
    } finally {
        hideLoading();
    }
};
window.activateShiftAdminMode = activateShiftAdminMode;

// ヘルパー関数群 (ハイブリッド・Chat共用)
function gatherFullShiftContext(year, month, daysInMonth, holidays) {
    const dailyTargets = {};
    for(let d=1; d<=daysInMonth; d++) {
        const t = (shiftState.shiftDataCache._daily_targets && shiftState.shiftDataCache._daily_targets[d]) || {};
        dailyTargets[d] = { A: t.A !== undefined ? t.A : 9, B: t.B !== undefined ? t.B : 9 };
    }
    const staffList = [...shiftState.staffListLists.employees, ...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late];
    const staffData = {};
    staffList.forEach(name => {
        const sData = shiftState.shiftDataCache[name] || {};
        const details = shiftState.staffDetails[name] || {};
        staffData[name] = {
            type: (sData.monthly_settings && sData.monthly_settings.shift_type) || details.basic_shift || 'A',
            contract_target: details.contract_days || 20,
            allowedRoles: details.allowed_roles || [],
            requests: { off: sData.off_days || [], work: sData.work_days || [] },
            assignments: sData.assignments || {} // Include assignments for Hybrid/Chat context
        };
    });
    return { meta: { year, month, days_in_month: daysInMonth, holidays, daily_targets: dailyTargets }, staff: staffData };
}

function applyAiShiftResult(generatedShift) {
    Object.keys(generatedShift).forEach(name => {
        if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = {};
        if (!shiftState.shiftDataCache[name].assignments) shiftState.shiftDataCache[name].assignments = {};
        const schedule = generatedShift[name];
        Object.keys(schedule).forEach(day => {
            shiftState.shiftDataCache[name].assignments[day] = schedule[day];
        });
    });
}

// ============================================================
//  🤖⚡ ハイブリッド自動作成機能
// ============================================================

async function generateHybridShift() {
    showConfirmModal(
        "🤖⚡ ハイブリッド自動作成",
        "まずルールベースで土台を作成し、その後AIが人員配置を最適化します。\n（平日余剰 → 土日不足への移動など）\n\n実行しますか？",
        async () => {
            await executeHybridShiftLogic();
        },
        'bg-gradient-to-r from-cyan-600 to-blue-600'
    );
}

async function executeHybridShiftLogic() {
    showLoading();
    pushHistory(); // Save state before starting

    // Helper to update loading text
    const updateLoadingText = (text) => {
        const loadingEl = document.getElementById('shift-loading-overlay');
        if (loadingEl) {
            let textEl = loadingEl.querySelector('p');
            if (!textEl) {
                textEl = document.createElement('p');
                textEl.className = "absolute mt-16 text-white font-bold text-lg drop-shadow-md";
                loadingEl.appendChild(textEl);
            }
            textEl.textContent = text;
        }
    };

    try {
        const Y = shiftState.currentYear;
        const M = shiftState.currentMonth;
        const daysInMonth = new Date(Y, M, 0).getDate();
        const holidays = getHolidays(Y, M);

        // 1. 土台作成 (Rule-based Base)
        await executeAutoShiftLogic(false);
        renderShiftAdminTable(); // Update UI to show base

        // 2. 3分割最適化 (上旬:1-10, 中旬:11-20, 下旬:21-End)
        const periods = [
            { start: 1, end: 10, label: "上旬", progress: 33 },
            { start: 11, end: 20, label: "中旬", progress: 66 },
            { start: 21, end: daysInMonth, label: "下旬", progress: 100 }
        ];

        for (let i = 0; i < periods.length; i++) {
            const period = periods[i];
            updateLoadingText(`AI最適化中... (${period.progress}% ${period.label}作成中)`);

            // Gather Context (Always get latest including previous updates)
            const contextData = gatherFullShiftContext(Y, M, daysInMonth, holidays);

            const isLast = (i === periods.length - 1);

            // Construct Prompt
            const prompt = `
以下のシフトデータ(JSON)をもとに、修正版のシフト表を作成してください。
【対象期間】
${period.start}日 〜 ${period.end}日
※この期間のみを最適化してください。

【重要方針】
月全体の目標（target）とバランスを考慮しつつ、指定期間（${period.start}日〜${period.end}日）を最適化してください。
${isLast ? "これまでの期間の勤務状況を踏まえて、月全体の最終調整を行ってください。" : "後続の期間のために人員を使いすぎないよう、全体最適を意識して配分してください。"}

【絶対厳守の制約】
1. **【固定・変更禁止】** 現在割り当てられている「有休」「特休」は、移動・変更・削除を一切禁止します。これらは既に確定した予定として扱い、絶対にいじらないでください。
2. **【固定・変更禁止】** 本人の希望休（requests.off）に基づく「公休」は、絶対に出勤に変更しないでください。
3. **【操作許容範囲】** あなたが操作してよいのは、上記以外の「出勤」と「（希望ではない）公休」の入れ替え、および「中番」への変更のみです。
4. 契約日数（target）を超過させないこと。
5. 6連勤以上（physical work streak >= 6）を発生させないこと。
6. 基本的なシフト区分（A/B）は勝手に変更しないこと（中番への変更は除く）。

【推奨・調整ルール】
1. **中番（Nakaban）の活用ルール（絶対遵守）:**
   - 中番を提案してよいのは、\`allowedRoles\` に "nakaban" が含まれているスタッフのみです。
   - **【早番(A)のスタッフの場合】:**
     - 「連勤の最後」かつ「翌日が休み」の場合のみ、その連勤最終日を中番にできます。
     - 条件: 当日が「中番」 AND 翌日が「公休」
     - （意図: 連勤の締めくくりとして中番に入り、翌日から休むパターンのみ許可）
   - **【遅番(B)のスタッフの場合】:**
     - 「休みの翌日」の場合のみ、中番にできます。
     - 条件: 前日が「公休」 AND 当日が「中番」
     - （意図: 休み明けの初日、または単発出勤として中番に入るパターンのみ許可）
   - ※これら以外のタイミング（例：連勤の途中など）で中番を入れることは禁止します。
2. **サンドイッチ出勤:** 飛び石連休（出-休-出）はなるべく避けてくださいが、人員確保のために必要な場合は許容します。
3. **連勤の平準化:** 特定の人に連勤が集中しないよう、全体を見て分散させてください。

【出力形式】
JSONのみを出力してください。
キーはスタッフ名、値は { "日付": "出勤" or "公休" or "中番" } の形式。
`;

            const res = await fetch('/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    contextData: JSON.stringify(contextData),
                    mode: 'shift_hybrid',
                    stream: true
                })
            });

            if (!res.ok) {
                let errMsg = res.statusText;
                try {
                    const errJson = await res.json();
                    if (errJson.error) errMsg = errJson.error;
                } catch(e) {}
                throw new Error(`${period.label}作成エラー: ` + errMsg);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                updateLoadingText(`AI最適化中... (${period.label}生成中: ${fullText.length}文字)`);
            }
            fullText += decoder.decode(); // Flush

            // --- JSON Auto-Repair & Extraction ---
            let jsonString = null;
            let generatedShift = null;

            // 1. Markdown extraction
            const codeBlockMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
            } else {
                // 2. Fallback: find { and }
                const firstBrace = fullText.indexOf('{');
                const lastBrace = fullText.lastIndexOf('}');

                if (firstBrace !== -1) {
                    if (lastBrace !== -1 && lastBrace > firstBrace) {
                        jsonString = fullText.substring(firstBrace, lastBrace + 1);
                    } else {
                        // If no closing brace found (or it's before start?), take to end
                        // This enables repair logic to work on truncated JSON
                        jsonString = fullText.substring(firstBrace);
                    }
                }
            }

            // 3. Parse and Repair
            if (jsonString) {
                try {
                    generatedShift = JSON.parse(jsonString);
                } catch (e) {
                    console.warn("JSON Parse Error. Attempting repair...", e);
                    try {
                        generatedShift = JSON.parse(jsonString + "}");
                    } catch (e2) {
                        try {
                             generatedShift = JSON.parse(jsonString + "]}");
                        } catch (e3) {
                             try {
                                 generatedShift = JSON.parse(jsonString + "\"}");
                             } catch (e4) {
                                 console.error("AI Response Text:", fullText);
                                 throw new Error(`${period.label}のJSONパースに失敗しました (修復不可): ` + e.message);
                             }
                        }
                    }
                }
            } else {
                console.error("AI Response Text:", fullText);
                throw new Error(`${period.label}のAI応答からJSONが見つかりませんでした。`);
            }

            if (generatedShift) {
                applyAiShiftResult(generatedShift);
            }
        }

        // Completion

        // Save to Firestore
        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        const docRef = doc(db, "shift_submissions", docId);
        await setDoc(docRef, shiftState.shiftDataCache, { merge: true });

        renderShiftAdminTable();
        showToast("🤖⚡ ハイブリッド作成完了！(保存しました)");

    } catch (e) {
        console.error("Hybrid Gen Error:", e);
        alert("ハイブリッド作成エラー: " + e.message);
        undoShiftAction(); // Revert to before base creation (clean slate)
    } finally {
        hideLoading();
        // Clean up loading text
        const loadingEl = document.getElementById('shift-loading-overlay');
        if (loadingEl) {
             const textEl = loadingEl.querySelector('p');
             if(textEl) textEl.remove();
        }
    }
}

// ============================================================
//  💬 AIシフト相談チャット
// ============================================================

let shiftChatHistory = [];

async function openShiftAiChat() {
    // UPDATED: Right Sidebar Slide-in
    const modal = document.getElementById('shift-ai-chat-modal');
    modal.classList.remove('translate-x-full');

    // Init Chat
    const msgContainer = document.getElementById('shift-ai-messages');
    msgContainer.innerHTML = '';
    shiftChatHistory = [];

    addShiftAiMessageUI('ai', 'こんにちは！現在のシフト状況を読み込みました。\n「20日の人が足りない」や「Aさんのシフトを確認して」など、何でも聞いてください。');
}

window.closeShiftAiChat = () => {
    // UPDATED: Right Sidebar Slide-out
    document.getElementById('shift-ai-chat-modal').classList.add('translate-x-full');
};

window.sendShiftAiMessage = async () => {
    const input = document.getElementById('shift-ai-input');
    const msg = input.value.trim();
    if(!msg) return;

    input.value = '';
    addShiftAiMessageUI('user', msg);

    // Loading
    const loadingId = addShiftAiMessageUI('ai', '思考中...', true);

    try {
        // Gather Context
        const Y = shiftState.currentYear;
        const M = shiftState.currentMonth;
        const daysInMonth = new Date(Y, M, 0).getDate();
        const holidays = getHolidays(Y, M);
        const contextData = gatherFullShiftContext(Y, M, daysInMonth, holidays);

        // Prepare Payload
        const payload = {
            prompt: msg,
            contextData: JSON.stringify(contextData),
            history: shiftChatHistory,
            mode: 'shift_chat'
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // Remove Loading
        document.getElementById(loadingId).remove();

        if (result.error) {
            addShiftAiMessageUI('ai', 'エラー: ' + result.error);
        } else {
            addShiftAiMessageUI('ai', result.reply);
            shiftChatHistory.push({ role: 'user', parts: [{ text: msg }] });
            shiftChatHistory.push({ role: 'model', parts: [{ text: result.reply }] });
        }

    } catch(e) {
        console.error(e);
        document.getElementById(loadingId).remove();
        addShiftAiMessageUI('ai', '通信エラーが発生しました。');
    }
};

function addShiftAiMessageUI(role, text, isLoading = false) {
    const container = document.getElementById('shift-ai-messages');
    const div = document.createElement('div');
    const id = 'msg-' + Date.now() + Math.random();
    div.id = id;
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;

    const bg = role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none';

    const bubble = document.createElement('div');
    bubble.className = `max-w-[85%] p-3 rounded-2xl text-sm font-bold shadow-sm ${bg}`;

    if (role === 'user') {
        bubble.textContent = text;
    } else {
        // AI message - simple HTML escaping
        const safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        bubble.innerHTML = safeText.replace(/\n/g, '<br>');
    }

    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

window.generateHybridShift = generateHybridShift;
window.openShiftAiChat = openShiftAiChat;
window.shiftState = shiftState;
