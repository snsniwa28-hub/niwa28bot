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
    <div id="shift-main-view" class="fullscreen-view font-main font-sans z-[60]">

        <header class="view-header shrink-0 z-20 shadow-sm px-4 sm:px-6">
            <div class="flex items-center gap-3">
                <button id="close-shift-view-btn" class="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div class="flex items-center gap-2">
                    <div class="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h2 class="font-black text-slate-800 text-lg sm:text-xl tracking-tight">シフト管理</h2>
                </div>
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
                    <button id="btn-clear-shift" class="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-lg border border-rose-200 transition">🗑️ 全クリア</button>

                    <button id="btn-clear-work-only" class="text-xs font-bold text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 transition">🧹 出勤のみクリア</button>

                    <button id="btn-clear-roles-only" class="text-xs font-bold text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 transition">🧹 役職のみクリア</button>

                    <button id="btn-shift-settings" class="text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition flex items-center gap-2">
                        <span>⚙️</span> 設定
                    </button>
                    <button id="btn-ai-early" class="text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 px-6 py-2 rounded-lg shadow-md transition flex items-center gap-2 ml-2">
                        <span>🤖</span> 早番(A)作成
                    </button>
                    <button id="btn-ai-late" class="text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 px-6 py-2 rounded-lg shadow-md transition flex items-center gap-2 ml-2">
                        <span>🤖</span> 遅番(B)作成
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


    <!-- Mobile Admin Menu -->
    <div id="mobile-admin-menu" class="modal-overlay hidden" style="z-index: 80; align-items: flex-end;">
        <div class="bg-white w-full rounded-t-3xl p-6 animate-fade-in-up">
            <h4 class="text-center font-black text-slate-800 mb-6">管理者メニュー</h4>
            <div class="grid grid-cols-1 gap-3">
                <button id="btn-mobile-clear" class="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100">割り振りをクリア</button>
                <button id="btn-mobile-settings" class="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-100">⚙️ 自動割り振り設定</button>
                <button id="btn-mobile-ai-early" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2">
                    <span>🤖</span> 早番(A)作成
                </button>
                <button id="btn-mobile-ai-late" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2">
                    <span>🤖</span> 遅番(B)作成
                </button>
                <button onclick="document.getElementById('mobile-admin-menu').classList.add('hidden')" class="w-full py-4 text-slate-400 font-bold">キャンセル</button>
            </div>
        </div>
    </div>

    <!-- AUTO SHIFT SETTINGS MODAL -->
    <div id="auto-shift-settings-modal" class="modal-overlay hidden" style="z-index: 100;">
        <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl">
            <h3 class="font-bold text-slate-800 text-lg mb-4">⚙️ 役職割り振り設定</h3>
            <p class="text-xs font-bold text-slate-400 mb-6">AIが割り振りを行う役割を選択してください。</p>

            <div class="space-y-4">
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">金銭業務 (金メ・金サブ)</span>
                    <input type="checkbox" id="chk-as-money" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
                </label>
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">倉庫番</span>
                    <input type="checkbox" id="chk-as-warehouse" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
                </label>
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">ホール責任者</span>
                    <input type="checkbox" id="chk-as-hall-resp" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
                </label>
                <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                    <span class="text-sm font-bold text-slate-700">早番倉庫お任せ</span>
                    <input type="checkbox" id="chk-early-warehouse-auto" class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500">
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

    `;

    document.body.insertAdjacentHTML('beforeend', html);
    setupShiftEventListeners();
}

function setupShiftEventListeners() {
    $('#btn-shift-admin-login').onclick = checkShiftAdminPassword;
    $('#close-shift-view-btn').onclick = closeShiftModal;
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
    $('#btn-mobile-clear').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); clearShiftAssignments(); };
    $('#btn-shift-settings').onclick = () => document.getElementById('auto-shift-settings-modal').classList.remove('hidden');
    $('#btn-mobile-settings').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); document.getElementById('auto-shift-settings-modal').classList.remove('hidden'); };

    // New AI Buttons
    // AI廃止 -> 高速ロジックへ直結 (executeAutoShiftLogic(isPreview, targetGroup))
    $('#btn-ai-early').onclick = () => { if(validateTargets('A')) executeAutoShiftLogic(true, 'A'); };
    $('#btn-ai-late').onclick = () => { if(validateTargets('B')) executeAutoShiftLogic(true, 'B'); };
    $('#btn-mobile-ai-early').onclick = () => { if(validateTargets('A')) { $('#mobile-admin-menu').classList.add('hidden'); executeAutoShiftLogic(true, 'A'); } };
    $('#btn-mobile-ai-late').onclick = () => { if(validateTargets('B')) { $('#mobile-admin-menu').classList.add('hidden'); executeAutoShiftLogic(true, 'B'); } };

    $('#mobile-fab-menu').onclick = () => $('#mobile-admin-menu').classList.remove('hidden');

    // Auto Shift Settings Listeners
    $('#chk-as-money').onchange = (e) => { shiftState.autoShiftSettings.money = e.target.checked; };
    $('#chk-as-warehouse').onchange = (e) => { shiftState.autoShiftSettings.warehouse = e.target.checked; };
    $('#chk-as-hall-resp').onchange = (e) => { shiftState.autoShiftSettings.hall_resp = e.target.checked; };

    $('#btn-clear-work-only').onclick = clearWorkOnly;
    $('#btn-clear-roles-only').onclick = clearRolesOnly;

    $('#btn-add-staff').onclick = () => openStaffEditModal(null);
    $('#btn-se-save').onclick = saveStaffDetails;
    $('#btn-se-delete').onclick = deleteStaff;
    $('#btn-save-daily-target').onclick = saveDailyTarget;
    $('#chk-early-warehouse-auto').onchange = (e) => { shiftState.earlyWarehouseMode = e.target.checked; };

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
                    shiftState.selectedStaff = name;
                    showActionSelectModal(day, status);
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
    const view = document.getElementById('shift-main-view');
    view.classList.add('active');

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
    document.getElementById('shift-main-view').classList.remove('active');
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
        const lastRole = prevMonthAssignments[staff.name]?.[prevDaysCount];

        // 明示的な遅番、または「出勤」かつ「B番スタッフ」の場合も遅番とみなす
        const isExplicitLate = lastRole && (lastRole.includes('遅') || lastRole.includes('B'));
        const isImplicitLate = lastRole &&
                               lastRole !== '公休' && lastRole !== '/' &&
                               lastRole !== '有休' && lastRole !== 'PAID' &&
                               lastRole !== '特休' && lastRole !== 'SPECIAL' &&
                               staff.shiftType === 'B';

        if (isExplicitLate || isImplicitLate) {
            let currentEffective = staff.shiftType;
            if (staff.requests.types[day] === 'early') currentEffective = 'A';

            // 遅番明けの早番(A)は禁止
            if (currentEffective === 'A') return false;
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

// ------------------------------------------------------------
// 1. バリデーション関数 (新規追加)
// ------------------------------------------------------------
function validateTargets(targetGroup) {
    const targets = shiftState.shiftDataCache._daily_targets || {};
    const daysInMonth = new Date(shiftState.currentYear, shiftState.currentMonth, 0).getDate();
    let hasTarget = false;

    for (let d = 1; d <= daysInMonth; d++) {
        const t = targets[d] || {};
        const val = targetGroup === 'A' ? t.A : t.B;
        if (val && parseInt(val) > 0) {
            hasTarget = true;
            break;
        }
    }

    if (!hasTarget) {
        alert(`⚠️ ${targetGroup === 'A' ? '早番' : '遅番'}の目標人数（定員）が設定されていません。\n自動作成を行うには、少なくとも1日分の定員を設定してください。`);
        return false;
    }
    return true;
}

// ------------------------------------------------------------
// 3. 自動ロジック本体 (executeAutoShiftLogic)
// ------------------------------------------------------------

async function executeAutoShiftLogic(isPreview = true, targetGroup = null) {
    if (isPreview) {
        pushHistory();
        showLoading();
    }

    try {
        const Y = shiftState.currentYear;
        const M = shiftState.currentMonth;
        const daysInMonth = new Date(Y, M, 0).getDate();
        const holidays = getHolidays(Y, M);
        const shifts = shiftState.shiftDataCache;
        const dailyTargets = shiftState.shiftDataCache._daily_targets || {};

        // 1. Context Preparation
        const context = await prepareShiftAnalysisContext(Y, M, shifts, shiftState.staffDetails, shiftState.staffListLists);
        const { staffObjects, prevMonthAssignments, prevDaysCount } = context;

        // --- 修正1: 対象グループのみをクリア ---
        staffObjects.forEach(s => {
            // targetGroup指定時、対象外のスタッフは何もしない（維持）
            if (targetGroup && s.shiftType !== targetGroup) return;

            const oldAssignments = shifts[s.name]?.assignments || {};
            const newAssignments = {};
            const newAssignedDays = [];
            const newPhysicalWorkDays = [];

            Object.keys(oldAssignments).forEach(dayKey => {
                const day = parseInt(dayKey);
                const role = oldAssignments[dayKey];
                // 公休・有休・特休は維持。それ以外の「出勤」「/」などはリセット対象
                if (role && role !== '/') {
                    newAssignments[dayKey] = role;
                    if (role !== '公休') {
                        newAssignedDays.push(day);
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

        // --- 修正2: 定員取得ロジック (空欄はスキップ=0) ---
        const getTarget = (day, type) => {
            const t = dailyTargets[day] || {};
            const val = type === 'A' ? t.A : t.B;
            return (val !== undefined && val !== "") ? parseInt(val) : 0;
        };

        // 制約チェック関数
        const canAssign = (staff, day, strictContractMode = false) => {
            const currentAssign = shifts[staff.name].assignments[day];
            if (currentAssign !== undefined && currentAssign !== '/') return false;
            return checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, strictContractMode);
        };

        const isResponsible = (s) => ['マネージャー', '主任', '副主任'].includes(s.rank);

        // 処理対象グループ
        const groupsToProcess = targetGroup ? [targetGroup] : ['A', 'B'];

        // =========================================================
        // PHASE 1: 責任者確保 (最低限の柱)
        // =========================================================
        groupsToProcess.forEach(st => {
            // ここはランダム順で分散させる
            const shuffledDays = [...days].sort(() => Math.random() - 0.5);

            shuffledDays.forEach(d => {
                // ターゲット0（休み設定）の日は責任者も不要とみなしてスキップ
                if (getTarget(d, st) === 0) return;

                const dateObj = new Date(Y, M - 1, d);
                const dayOfWeek = dateObj.getDay();
                const isHoliday = holidays.includes(d);

                // 土日祝は2人、平日は1人
                const baseReq = (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) ? 2 : 1;

                // ただし、そのグループに責任者がそもそも何人いるか？ (身の丈チェック)
                const totalResp = staffObjects.filter(s => s.shiftType === st && isResponsible(s)).length;
                const targetRespCount = Math.min(baseReq, totalResp); // いないなら仕方ない

                let currentRespCount = staffObjects.filter(s =>
                    s.shiftType === st && isResponsible(s) && s.physicalWorkDays.includes(d)
                ).length;

                if (currentRespCount < targetRespCount) {
                    const candidates = staffObjects.filter(s =>
                        s.shiftType === st && isResponsible(s) && canAssign(s, d)
                    );
                    // 契約日数に余裕がある順
                    candidates.sort((a,b) => (a.contractDays - a.assignedDays.length) - (b.contractDays - b.assignedDays.length)).reverse();

                    for (const cand of candidates) {
                        if (currentRespCount >= targetRespCount) break;
                        // 契約日数上限ガード (責任者とはいえ無理はさせない)
                        if (cand.assignedDays.length >= cand.contractDays) continue;

                        if (!cand.assignedDays.includes(d)) {
                            cand.assignedDays.push(d);
                            cand.physicalWorkDays.push(d);
                            currentRespCount++;
                        }
                    }
                }
            });
        });

        // =========================================================
        // PHASE 2 & 4統合: 全員でターゲットを埋める (充足率優先)
        // =========================================================
        // ※ 社員優先フェーズを分けず、PHASE 1で責任者を確保したら
        //    あとは「足りない日に、入れられる人を入れる」方式で一気に平準化する

        groupsToProcess.forEach(st => {
            const sortedDays = [...days];

            // 複数回パスを通して徐々に埋める（3回くらい回せば平均化される）
            for(let pass=0; pass<3; pass++) {

                // ★修正3: ①土日祝優先 ②充足率が低い順
                sortedDays.sort((a, b) => {
                    const tA = getTarget(a, st);
                    const tB = getTarget(b, st);
                    if (tA === 0) return 1;
                    if (tB === 0) return -1;

                    // 日付情報の取得
                    const dateA = new Date(Y, M - 1, a);
                    const dateB = new Date(Y, M - 1, b);
                    const isWeHolA = (dateA.getDay() === 0 || dateA.getDay() === 6 || holidays.includes(a));
                    const isWeHolB = (dateB.getDay() === 0 || dateB.getDay() === 6 || holidays.includes(b));

                    // 優先順位1: 土日祝 (Trueなら前へ)
                    if (isWeHolA !== isWeHolB) return isWeHolA ? -1 : 1;

                    // 優先順位2: 充足率 (低い順)
                    const cA = staffObjects.filter(s => s.shiftType === st && s.physicalWorkDays.includes(a)).length;
                    const cB = staffObjects.filter(s => s.shiftType === st && s.physicalWorkDays.includes(b)).length;
                    return (cA / tA) - (cB / tB);
                });

                sortedDays.forEach(d => {
                    const target = getTarget(d, st);
                    if (target === 0) return; // スキップ

                    let current = staffObjects.filter(s => s.shiftType === st && s.physicalWorkDays.includes(d)).length;

                    // ★修正2: 身の丈キャップ (スタッフ総数以上は求めない)
                    const totalStaff = staffObjects.filter(s => s.shiftType === st).length;
                    const effectiveTarget = Math.min(target, totalStaff);

                    if (current < effectiveTarget) {
                        const candidates = staffObjects.filter(s =>
                            s.shiftType === st && canAssign(s, d)
                        );

                        // 候補者の選び方:
                        // 1. 契約日数不足が多い人 (働きたがっている人)
                        // 2. 連勤リスクが低い人 (getPotentialStreakは重いので、ここでは簡易的に前日休み優先とかでもいいが、既存ロジックを使う)
                        candidates.sort((a,b) => {
                             const needA = a.contractDays - a.assignedDays.length;
                             const needB = b.contractDays - b.assignedDays.length;
                             return needB - needA; // 不足が大きい順
                        });

                        for(const c of candidates) {
                             if (current >= effectiveTarget) break;
                             if (c.assignedDays.length >= c.contractDays) continue; // 契約守る

                             c.assignedDays.push(d);
                             c.physicalWorkDays.push(d);
                             current++;
                        }
                    }
                });
            }
        });

        // =========================================================
        // PHASE 3: 契約日数強制消化 (Contract Fill - 身の丈無視の絶対ノルマ)
        // =========================================================
        // 定員が埋まっていても、契約日数が足りないスタッフを「ねじ込む」
        groupsToProcess.forEach(st => {
            const hungryStaff = staffObjects.filter(s =>
                s.shiftType === st && s.assignedDays.length < s.contractDays
            );

            // 不足日数が多い順（必死な順）に処理
            hungryStaff.sort((a,b) => (a.contractDays - a.assignedDays.length) - (b.contractDays - b.assignedDays.length)).reverse();

            hungryStaff.forEach(s => {
                let safetyLoop = 0;
                while (s.assignedDays.length < s.contractDays && safetyLoop < 100) {
                    safetyLoop++;
                    // 入れる日を探す（制約チェックOK かつ まだ入っていない日）
                    // 優先順位: ターゲットに対する充足率が低い日（まだマシな日）
                    const candidates = days.filter(d => canAssign(s, d));

                    if (candidates.length === 0) break; // もう物理的に入れる日がない

                    candidates.sort((a, b) => {
                        const tA = getTarget(a, st);
                        const tB = getTarget(b, st);
                        const cA = staffObjects.filter(obj => obj.shiftType === st && obj.physicalWorkDays.includes(a)).length;
                        const cB = staffObjects.filter(obj => obj.shiftType === st && obj.physicalWorkDays.includes(b)).length;
                        // ターゲット0の場合は分母0になるので回避
                        const rA = tA > 0 ? cA / tA : 999;
                        const rB = tB > 0 ? cB / tB : 999;
                        return rA - rB;
                    });

                    const bestDay = candidates[0];
                    s.assignedDays.push(bestDay);
                    s.physicalWorkDays.push(bestDay);
                }
            });
        });

        // =========================================================
        // PHASE 7: 役職割り振り (ここは変更なし)
        // =========================================================
        groupsToProcess.forEach(st => {
            days.forEach(d => {
                // targetGroup指定時は、そのグループのみ処理
                const allAssigned = staffObjects.filter(s => s.shiftType === st && s.assignedDays.includes(d));
                const leaveGroup = [];
                let workGroup = [];

                allAssigned.forEach(s => {
                    const req = s.requests.types[d];
                    const existing = shifts[s.name].assignments[d];
                    // 公休等は既に除外されているはずだが念のため
                    if (req === 'PAID') {
                        leaveGroup.push(s);
                        shifts[s.name].assignments[d] = '有休';
                    } else if (req === 'SPECIAL') {
                        leaveGroup.push(s);
                        shifts[s.name].assignments[d] = '特休';
                    } else {
                        if (!existing || existing === '/') {
                            workGroup.push(s);
                        }
                    }
                });

                const assign = (roleKey, filterFn) => {
                    const candidates = workGroup.filter(filterFn);
                    if (candidates.length === 0) return;
                    candidates.sort((a,b) => a.roleCounts[roleKey] - b.roleCounts[roleKey]);
                    const picked = candidates[0];
                    shifts[picked.name].assignments[d] = roleKey;
                    picked.roleCounts[roleKey]++;
                    workGroup = workGroup.filter(u => u !== picked);
                };

                if (shiftState.autoShiftSettings.money) assign('金メ', s => s.allowedRoles.includes('money_main'));
                if (shiftState.autoShiftSettings.money) assign('金サブ', s => s.allowedRoles.includes('money_sub'));
                if (shiftState.autoShiftSettings.hall_resp) assign('ホ責', s => s.allowedRoles.includes('hall_resp'));
                if (shiftState.autoShiftSettings.warehouse) {
                    assign('倉庫', s => {
                        if (!s.allowedRoles.includes('warehouse')) return false;
                        if (shiftState.earlyWarehouseMode && s.type === 'employee' && s.shiftType === 'A') return false;
                        return true;
                    });
                }

                // 残りは出勤
                workGroup.forEach(s => {
                    const current = shifts[s.name].assignments[d];
                    if (current === undefined || current === '/') {
                        shifts[s.name].assignments[d] = '出勤';
                    }
                });
            });
        });

        // 本人の希望休反映 (対象グループのみ)
        staffObjects.forEach(s => {
            if (targetGroup && s.shiftType !== targetGroup) return;
            if (s.requests && s.requests.off) {
                s.requests.off.forEach(day => {
                    const current = shifts[s.name].assignments[day];
                    if (!current || current === '/') {
                        shifts[s.name].assignments[day] = '公休';
                    }
                });
            }
        });

        // =========================================================
        // PHASE 8: 安全装置 (Safety Brake) - 契約超過分のスマート削除
        // =========================================================
        // 契約日数を超えている場合、余裕がある日（出勤人数が多い日）から削る

        staffObjects.forEach(s => {
            // targetGroup指定時、対象外はスキップ
            if (targetGroup && s.shiftType !== targetGroup) return;

            const contractTarget = s.contractDays;

            // 出勤日数のカウント & 出勤日の特定
            let workDayKeys = [];
            let workCount = 0; // 公休以外（出勤+有休+特休）

            // assignmentsは参照なので直接変更可能
            const assignments = shifts[s.name].assignments;

            days.forEach(d => {
                const role = assignments[d];
                if (role && role !== '/' && role !== '公休') {
                    workCount++;
                    if (role === '出勤') workDayKeys.push(d); // 削除対象は「出勤」のみ（有休は残す）
                }
            });

            if (workCount > contractTarget) {
                const removeCount = workCount - contractTarget;
                console.log(`🛡 Safety Brake: ${s.name} is over by ${removeCount}. Removing...`);

                // スマート削除: 「その日の出勤人数」が多い順（余裕がある順）にソートして消す
                workDayKeys.sort((d1, d2) => {
                    const getCnt = (d) => {
                        // その日の全スタッフの出勤数
                        return Object.values(shifts).filter(obj => {
                            const r = obj.assignments?.[d];
                            return r && r !== '/' && r !== '公休';
                        }).length;
                    };
                    return getCnt(d2) - getCnt(d1); // 降順（多い日＝消す候補）
                });

                for (let i = 0; i < removeCount; i++) {
                    if (workDayKeys[i]) {
                        assignments[workDayKeys[i]] = '/';
                    }
                }
            }
        });

        // Cleanup
        staffObjects.forEach(s => {
             if (targetGroup && s.shiftType !== targetGroup) return;
             const name = s.name;
             if (!shifts[name]) shifts[name] = {};
             if (!shifts[name].assignments) shifts[name].assignments = {};
             for (let d = 1; d <= daysInMonth; d++) {
                 if (shifts[name].assignments[d] === undefined) {
                     shifts[name].assignments[d] = '/';
                 }
             }
        });

        // Preview Stats
        let filledCount = 0;
        let staffSet = new Set();
        Object.keys(shifts).forEach(name => {
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


// ============================================================
// 3. ロジック実装 (ファイルの末尾に追加・置換)
// ============================================================

// 公休・有休・特休以外（出勤など）をクリアする関数
async function clearWorkOnly() {
    showConfirmModal("出勤のみクリア", "「公休」「有休」「特休」は残したまま、\n自動割り振りされた「出勤」や「/」のみをリセットしますか？", async () => {
        pushHistory();
        const protectedRoles = ['公休', '有休', '特休'];
        let count = 0;

        Object.keys(shiftState.shiftDataCache).forEach(name => {
            const data = shiftState.shiftDataCache[name];
            if (data && data.assignments) {
                Object.keys(data.assignments).forEach(day => {
                    const role = data.assignments[day];
                    // 保護対象以外の役職（出勤、/、金メなど）はすべてクリア
                    if (role && !protectedRoles.includes(role)) {
                        data.assignments[day] = '/';
                        count++;
                    }
                });
            }
        });

        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        await setDoc(doc(db, "shift_submissions", docId), shiftState.shiftDataCache, { merge: true });

        renderShiftAdminTable();
        showToast(`🧹 ${count}箇所の割り振りをリセットしました`);
    }, 'bg-orange-500');
}
window.clearWorkOnly = clearWorkOnly;

// --- 新機能: 役職のみクリア ---
async function clearRolesOnly() {
    showConfirmModal("役職クリア", "シフト（出勤/休み）は維持したまま、\n割り振られた役職（金メ・倉庫など）だけを解除して「出勤」に戻しますか？", async () => {
        pushHistory();
        const targetRoles = ['金メ', '金サブ', 'ホ責', '倉庫'];
        let count = 0;

        Object.keys(shiftState.shiftDataCache).forEach(name => {
            const data = shiftState.shiftDataCache[name];
            if (data && data.assignments) {
                Object.keys(data.assignments).forEach(day => {
                    if (targetRoles.includes(data.assignments[day])) {
                        data.assignments[day] = '出勤'; // 役職を剥奪
                        count++;
                    }
                });
            }
        });

        const docId = `${shiftState.currentYear}-${String(shiftState.currentMonth).padStart(2,'0')}`;
        await setDoc(doc(db, "shift_submissions", docId), shiftState.shiftDataCache, { merge: true });

        renderShiftAdminTable();
        showToast(`🧹 ${count}箇所の役職をクリアしました`);
    }, 'bg-orange-500');
}
window.clearRolesOnly = clearRolesOnly;
window.shiftState = shiftState;

// アプリ起動時にスタッフデータを読み込み、他モジュール（会員レース等）へ提供する
export async function initStaffData() {
    const staffDocRef = doc(db, 'masters', 'staff_data');
    try {
        const staffSnap = await getDoc(staffDocRef);
        if (staffSnap.exists()) {
            const data = staffSnap.data();
            // シフト機能用ステートへの保存
            shiftState.staffListLists = {
                employees: data.employees || [],
                alba_early: data.alba_early || [],
                alba_late: data.alba_late || []
            };
            shiftState.staffDetails = data.staff_details || {};

            // 【重要】他モジュール（member_race.js等）との互換性維持のためグローバルへ公開
            window.masterStaffList = shiftState.staffListLists;

            console.log("Staff data initialized via Shift module.");
        }
    } catch(e) {
        console.error("Staff Init Error:", e);
    }
}
