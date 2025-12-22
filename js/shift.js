import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showPasswordModal, closePasswordModal, showToast } from './ui.js';
import { $, getHolidays } from './utils.js';

let shiftState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    selectedStaff: null,
    shiftDataCache: {},
    isAdminMode: false,
    selectedDay: null,
    adminSortMode: 'roster',
    viewMode: 'table',
    staffDetails: {},
    staffListLists: { employees: [], alba_early: [], alba_late: [] },
    historyStack: [],
    earlyWarehouseMode: false,
    adjustmentMode: false, // New Switch State
    prevMonthCache: null
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
    GENERIC_B: 'B遅'
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
        el.className = 'fixed inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center';
        el.innerHTML = `<div class="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-500"></div>`;
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
                        <p class="text-slate-400 text-sm font-bold mb-8">ご自身の名前を選択してシフトを入力してください</p>
                        <div class="space-y-8 text-left">
                            <div>
                                <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Employee</h4>
                                <div id="shift-list-employees" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"></div>
                            </div>
                            <div>
                                <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Part-time</h4>
                                <div id="shift-list-alba" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"></div>
                            </div>
                        </div>
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
                         <label class="flex items-center gap-2 text-xs font-bold bg-slate-700 px-3 py-2 rounded-lg border border-slate-600 cursor-pointer select-none">
                            <input type="checkbox" id="chk-adjustment-mode" class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-600 bg-slate-600 border-slate-500">
                            <span>調整モード</span>
                         </label>
                         <label class="flex items-center gap-2 text-xs font-bold bg-slate-700 px-3 py-2 rounded-lg border border-slate-600 cursor-pointer select-none">
                            <input type="checkbox" id="chk-early-warehouse-auto" class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-600 bg-slate-600 border-slate-500">
                            <span>早番倉庫お任せ</span>
                         </label>
                         <button id="btn-undo-action" class="hidden flex items-center gap-1 text-xs font-bold bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-lg transition border border-slate-500">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        </button>
                        <div class="h-6 w-px bg-slate-600 mx-1"></div>
                        <button id="btn-shift-toggle-mode" class="whitespace-nowrap text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600">📂 名簿順</button>
                        <button id="btn-view-toggle" class="md:hidden whitespace-nowrap text-xs font-bold bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg border border-indigo-500">📱 カード表示</button>
                        <button id="btn-open-staff-master" class="whitespace-nowrap text-xs font-bold bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600">👥 スタッフ</button>
                    </div>
                </div>

                <div class="flex-1 overflow-hidden relative bg-white">
                    <div id="admin-table-container" class="h-full overflow-auto">
                        <table class="w-full border-collapse whitespace-nowrap text-sm">
                            <thead class="sticky top-0 z-30 bg-slate-100 text-slate-600 font-bold shadow-sm">
                                <tr id="shift-admin-header-row">
                                    <th class="sticky left-0 z-40 bg-slate-100 p-2 border-b border-r border-slate-300 min-w-[140px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        名前 <span class="text-[10px] font-normal text-slate-400 ml-1">ランク/連/契/実</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="shift-admin-body"></tbody>
                        </table>
                    </div>
                    <div id="admin-mobile-list" class="hidden h-full overflow-y-auto p-4 bg-slate-50 pb-24"></div>
                </div>

                <div class="md:hidden absolute bottom-6 right-6 z-50">
                    <button id="mobile-fab-menu" class="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-700 transition transform hover:scale-105">
                        <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                </div>

                <div class="hidden md:flex p-3 bg-white border-t border-slate-200 justify-end gap-3 shrink-0">
                    <button id="btn-clear-shift" class="text-xs font-bold text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-lg border border-rose-200 transition">🗑️ 割り振りクリア</button>
                    <button id="btn-auto-create-shift" class="text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2 rounded-lg shadow-md transition flex items-center gap-2">
                        <span>⚡</span> AI 自動作成
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
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-200 transition" data-role="clear">
                    <span class="text-xl">🔄</span>
                    <span class="text-[10px] font-bold">クリア</span>
                </button>
            </div>

            <!-- Admin Role Buttons -->
            <div id="admin-role-grid" class="hidden px-6 pb-2 grid grid-cols-4 gap-2 mt-4">
                 <button class="role-btn bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="A早">A (早)</button>
                 <button class="role-btn bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 rounded-lg text-[10px]" data-role="B遅">B (遅)</button>
                 <button class="role-btn bg-rose-50 text-rose-600 border border-rose-200 font-bold py-2 rounded-lg text-[10px]" data-role="公休">公休</button>
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

    <!-- Mobile Admin Menu -->
    <div id="mobile-admin-menu" class="modal-overlay hidden" style="z-index: 80; align-items: flex-end;">
        <div class="bg-white w-full rounded-t-3xl p-6 animate-fade-in-up">
            <h4 class="text-center font-black text-slate-800 mb-6">管理者メニュー</h4>
            <div class="grid grid-cols-1 gap-3">
                <button id="btn-mobile-clear" class="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100">割り振りをクリア</button>
                <button id="btn-mobile-auto" class="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200">AI 自動作成を実行</button>
                <button onclick="document.getElementById('mobile-admin-menu').classList.add('hidden')" class="w-full py-4 text-slate-400 font-bold">キャンセル</button>
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
    $('#btn-view-toggle').onclick = toggleMobileView;
    $('#btn-undo-action').onclick = undoShiftAction;
    $('#btn-clear-shift').onclick = clearShiftAssignments;
    $('#btn-auto-create-shift').onclick = generateAutoShift;
    $('#btn-mobile-clear').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); clearShiftAssignments(); };
    $('#btn-mobile-auto').onclick = () => { $('#mobile-admin-menu').classList.add('hidden'); generateAutoShift(); };
    $('#mobile-fab-menu').onclick = () => $('#mobile-admin-menu').classList.remove('hidden');
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
        btn.onclick = () => {
            const role = btn.dataset.role;
            if (role === 'clear') handleActionPanelClick('clear');
            else if (role === '公休') handleActionPanelClick('公休');
            else setAdminRole(role);
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
    showPasswordModal('shift_admin');
}

export function activateShiftAdminMode() {
    closePasswordModal();
    shiftState.isAdminMode = true;
    shiftState.viewMode = 'table';
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
    const render = (cid, list) => {
        const c = document.getElementById(cid);
        if(!c) return;
        c.innerHTML = '';
        list.forEach(name => {
            const btn = document.createElement('button');
            btn.className = "bg-white border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold py-4 px-2 rounded-2xl text-sm transition-all shadow-sm active:scale-95 flex flex-col items-center justify-center gap-1";
            btn.innerHTML = `<span class="text-2xl opacity-50">👤</span><span>${name}</span>`;
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

        if (assignedRole) {
            if (assignedRole === '公休') {
                numColor = "text-white";
                bgClass = "bg-rose-500";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">公休</span>';
                statusText = '公休';
            } else {
                numColor = "text-white";
                bgClass = "bg-indigo-600";
                label = `<span class="text-[10px] text-white font-bold leading-none mt-1">${assignedRole}</span>`;
                statusText = assignedRole;
            }
        } else {
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
    const isListView = isMobile || shiftState.viewMode === 'list';
    const toggleBtn = document.getElementById('btn-shift-toggle-mode');
    toggleBtn.textContent = shiftState.adminSortMode === 'roster' ? "📂 名簿順" : "⚡ シフト別";
    const undoBtn = document.getElementById('btn-undo-action');
    if(shiftState.historyStack.length > 0) undoBtn.classList.remove('hidden');
    else undoBtn.classList.add('hidden');

    if (isListView) {
        document.getElementById('admin-table-container').classList.add('hidden');
        document.getElementById('admin-mobile-list').classList.remove('hidden');
        renderAdminMobileList();
        return;
    } else {
        document.getElementById('admin-table-container').classList.remove('hidden');
        document.getElementById('admin-mobile-list').classList.add('hidden');
    }

    const headerRow = document.getElementById('shift-admin-header-row');
    while (headerRow.children.length > 1) headerRow.removeChild(headerRow.lastChild);
    for(let d=1; d<=daysInMonth; d++) {
        const th = document.createElement('th');
        const dayOfWeek = new Date(y, m-1, d).getDay();
        const isHoliday = holidays.includes(d);
        const color = (dayOfWeek===0 || isHoliday) ?'text-rose-500':dayOfWeek===6?'text-blue-500':'text-slate-600';
        th.className = `p-2 border-b border-r border-slate-200 min-w-[30px] text-center ${color} font-num`;
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
        trTitle.innerHTML = `<td class="sticky left-0 z-20 p-2 font-bold text-xs ${bgClass} border-b border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" colspan="${daysInMonth+1}">${title}</td>`;
        fragment.appendChild(trTitle);

        list.forEach(name => {
            const tr = document.createElement('tr');
            const data = shiftState.shiftDataCache[name] || { off_days: [], work_days: [], assignments: {} };
            const details = shiftState.staffDetails[name] || {};
            const monthlySettings = (data.monthly_settings) || {};
            const currentType = monthlySettings.shift_type || details.basic_shift || 'A';
            const hasAnyRemark = (data.remarks && data.remarks.trim() !== "") || (data.daily_remarks && Object.keys(data.daily_remarks).length > 0);

            // Calculate Actual Assigned Count
            const actualCount = Object.values(data.assignments || {}).filter(r => r !== '公休').length;

            const tdName = document.createElement('td');
            tdName.className = "sticky left-0 z-20 bg-white p-2 border-b border-r border-slate-300 font-bold text-slate-700 text-xs truncate max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";

            const nameSpan = document.createElement('div');
            nameSpan.className = "flex flex-col mb-1";
            nameSpan.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="leading-tight ${hasAnyRemark ? 'text-indigo-600' : ''}">${name} ${hasAnyRemark ? '📝' : ''}</span>
                    <button class="w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${currentType==='A'?'bg-slate-50 text-slate-400':'bg-slate-800 text-white'} toggle-type-btn" data-name="${name}" data-type="${currentType}">${currentType}</button>
                </div>
                ${renderRoleBadges(details.allowed_roles)}
                <span class="text-[9px] text-slate-300 font-normal leading-none block mt-0.5">連:${details.max_consecutive_days||5} / 契:${details.contract_days||20} / <span class="text-slate-500 font-bold">実:${actualCount}</span></span>
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

                if (assignment) {
                    if (assignment === '公休') {
                         if (isOffReq) { bgCell = 'bg-rose-50 hover:bg-rose-100'; cellContent = '<span class="text-rose-500 font-bold text-[10px] select-none">(休)</span>'; }
                         else { bgCell = 'bg-white hover:bg-slate-100'; cellContent = '<span class="text-slate-300 font-bold text-[10px] select-none">/</span>'; }
                    } else {
                         let roleColor = 'text-slate-800';

                         // Check for special roles
                         const isSpecial = assignment.includes('金メ') || assignment.includes('金サブ') || assignment.includes('ホ責') || assignment.includes('倉庫');

                         if (isSpecial) {
                             if(assignment.includes('金メ')) { bgCell = 'bg-yellow-50'; roleColor = 'text-yellow-600'; }
                             else if(assignment.includes('金サブ')) { bgCell = 'bg-amber-50'; roleColor = 'text-amber-600'; }
                             else if(assignment.includes('ホ責')) { bgCell = 'bg-orange-50'; roleColor = 'text-orange-600'; }
                             else if(assignment.includes('倉庫')) { bgCell = 'bg-blue-50'; roleColor = 'text-blue-600'; }

                             const typeLabel = currentType === 'A' ? 'A早' : 'B遅';
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none -mt-0.5">
                                    <span class="text-[7px] text-slate-300 font-normal transform scale-90">${typeLabel}</span>
                                    <span class="${roleColor} font-bold text-[10px] -mt-px">${assignment}</span>
                                </div>
                             `;
                         } else {
                             // Plain Shift (No specific role, or generic like 'ホ', '早番', 'A早', etc.)
                             // Force simplified style
                             bgCell = 'bg-white';
                             const displayLabel = currentType === 'A' ? 'A出勤' : 'B出勤';
                             cellContent = `
                                <div class="flex flex-col items-center justify-center leading-none -mt-0.5">
                                    <span class="text-slate-600 font-bold text-[10px] -mt-px">${displayLabel}</span>
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

                td.className = `border-b border-r border-slate-200 text-center cursor-pointer transition relative ${bgCell}`;
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
            if(role && role !== '公休') {
                if(shiftType === 'A') actualA[d]++;
                else actualB[d]++;
            }
        }
    });

    // Create Footer Rows Helper
    const createFooterRow = (title, type, counts, targets, isTargetRow = false) => {
        const tr = document.createElement('tr');
        const tdTitle = document.createElement('td');
        tdTitle.className = "sticky left-0 z-20 bg-slate-100 p-2 border-b border-r border-slate-300 font-bold text-xs text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
        tdTitle.textContent = title;
        tr.appendChild(tdTitle);

        for(let d=1; d<=daysInMonth; d++) {
            const td = document.createElement('td');
            const val = counts[d] || 0;
            const target = (targets[d] && targets[d][type]) !== undefined ? targets[d][type] : 9;

            let colorClass = "text-slate-600";
            if (val < target) colorClass = "text-rose-600 font-black";
            else if (val > target) colorClass = "text-blue-600";

            td.className = "border-b border-r border-slate-200 text-center font-bold text-xs p-1";

            if (isTargetRow) {
                 td.className += " cursor-pointer hover:bg-slate-100 bg-slate-50";
                 td.innerHTML = `<span class="text-slate-400 text-[10px]">(${target})</span>`;
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

    const trTarget = document.createElement('tr');
    trTarget.innerHTML = `<td class="sticky left-0 z-20 bg-slate-800 text-white p-2 border-b border-r border-slate-600 font-bold text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">定員設定 (A/B)</td>`;
    for(let d=1; d<=daysInMonth; d++) {
        const td = document.createElement('td');
        const t = dailyTargets[d] || {};
        const ta = t.A !== undefined ? t.A : 9;
        const tb = t.B !== undefined ? t.B : 9;
        td.className = "border-b border-r border-slate-200 text-center font-bold text-xs p-1 cursor-pointer hover:bg-indigo-50 bg-slate-50 transition";
        td.innerHTML = `<span class="text-slate-500">${ta}</span> / <span class="text-slate-500">${tb}</span>`;
        td.dataset.type = 'target-cell';
        td.dataset.day = d;
        trTarget.appendChild(td);
    }
    fragment.appendChild(trTarget);

    // Append the entire fragment to the table body
    tbody.appendChild(fragment);
}

function renderAdminMobileList() {
    const container = document.getElementById('admin-mobile-list');
    container.innerHTML = '';
    const allNames = [...shiftState.staffListLists.employees, ...shiftState.staffListLists.alba_early, ...shiftState.staffListLists.alba_late];
    allNames.forEach(name => {
        const details = shiftState.staffDetails[name] || {};
        const data = shiftState.shiftDataCache[name] || {};
        const type = (data.monthly_settings?.shift_type) || details.basic_shift || 'A';
        const assignmentCount = Object.keys(data.assignments || {}).filter(k => data.assignments[k] !== '公休').length;
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 flex items-center justify-between active:scale-95 transition-transform";
        card.onclick = () => selectShiftStaff(name);
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">👤</div>
                <div>
                    <h4 class="font-bold text-slate-800">${name}</h4>
                    <span class="text-xs text-slate-400 font-bold">${details.rank || '-'}</span>
                </div>
            </div>
            <div class="text-right">
                <span class="inline-block px-2 py-1 rounded text-xs font-bold ${type==='A'?'bg-amber-100 text-amber-700':'bg-indigo-100 text-indigo-700'} mb-1">${type}番</span>
                <p class="text-xs font-bold text-slate-500">${assignmentCount}日 出勤</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleMobileView() {
    shiftState.viewMode = shiftState.viewMode === 'table' ? 'list' : 'table';
    document.getElementById('btn-view-toggle').textContent = shiftState.viewMode === 'table' ? "📱 カード表示" : "📊 表形式";
    renderShiftAdminTable();
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
             if(shiftState.shiftDataCache[name]) {
                 delete shiftState.shiftDataCache[name].assignments[day];
                 delete shiftState.shiftDataCache[name].daily_remarks[day];
             }
             updateViewAfterAction();
             closeShiftActionModal();
        } else {
            setAdminRole(role);
            closeShiftActionModal();
        }
    } else {
        // User Mode
        updateShiftRequest(role); // 'early', 'late', 'any', 'off', 'clear'
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
            else if(isWork) status = req === 'early' ? '早番希望' : req === 'late' ? '遅番希望' : '出勤希望';
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
        const assignedDays = [];
        for(let day=1; day<=daysInMonth; day++) {
            if (assignments[day] && assignments[day] !== '公休') {
                assignedDays.push(day);
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
function checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, strictContractMode = false) {
    // Helper: Check Work Status (Current & History)
    const checkWork = (s, d) => {
        if (d <= 0) return !!s.history[d];
        return s.assignedDays.includes(d);
    };

    // 0. Strict Contract Enforcement (Highest Priority)
    if (!strictContractMode && staff.assignedDays.length >= staff.contractDays) return false;

    // 1. Strict Interval (Absolute): No Late -> Early
    if (day > 1) {
        if (staff.assignedDays.includes(day - 1)) {
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
            if (lastRole && (lastRole.includes('遅') || lastRole.includes('B'))) {
                let currentEffective = staff.shiftType;
                if (staff.requests.types[day] === 'early') currentEffective = 'A';
                if (staff.requests.types[day] === 'late') currentEffective = 'B';
                if (currentEffective === 'A') return false;
            }
    }

    // 2. Off Days Check
    if (!strictContractMode) {
            if (staff.requests.off.includes(day)) return false;
    }

    // 3. Consecutive Days (UPDATED for Cross-Month)
    let currentSeq = 1;
    // Scan Backwards
    let b = day - 1;
    while(checkWork(staff, b)) {
        currentSeq++;
        b--;
        if (day - b > 30) break;
    }
    // Scan Forwards
    let f = day + 1;
    while(checkWork(staff, f)) {
        currentSeq++;
        f++;
    }

    if (currentSeq > staff.maxConsecutive) return false;

    // 4. Sandwich Check
    if (!checkWork(staff, day - 1)) {
        // day-1 is a Gap. Check streak ending at day-2.
        let prevStreak = 0;
        let k = day - 2;
        while (checkWork(staff, k)) {
            prevStreak++;
            k--;
            if ((day - 2) - k > 30) break;
        }
        if (prevStreak >= staff.maxConsecutive) return false;
    }

    // 5. Already assigned
    if (staff.assignedDays.includes(day)) return false;

    return true;
}

// --- NEW AUTO SHIFT LOGIC (AI) ---
async function generateAutoShift() {
    if(!confirm(`${shiftState.currentYear}年${shiftState.currentMonth}月のシフトを自動作成します。\n既存の確定済みシフトは上書きされます（希望休などは保持）。\nよろしいですか？`)) return;

    pushHistory();
    showLoading();

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
            s.assignedDays = [];
            if(!shifts[s.name]) shifts[s.name] = {};
            shifts[s.name].assignments = {};
        });

        const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

        // Wrapper for shared constraint check
        const canAssign = (staff, day, strictContractMode = false) => {
            return checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, strictContractMode);
        };

        // Helper: Is Responsible?
        const isResponsible = (s) => s.allowedRoles.includes('money_main');

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
                const assignedResp = staffObjects.some(s =>
                    s.shiftType === st && s.type === 'employee' && isResponsible(s) && s.assignedDays.includes(d)
                );
                if (!assignedResp) {
                    const candidates = staffObjects.filter(s =>
                        s.shiftType === st && s.type === 'employee' && isResponsible(s) && canAssign(s, d)
                    );
                    candidates.sort((a,b) => {
                        const reqA = a.requests.work.includes(d) ? 1 : 0;
                        const reqB = b.requests.work.includes(d) ? 1 : 0;
                        return reqB - reqA;
                    });
                    if (candidates.length > 0) candidates[0].assignedDays.push(d);
                }
            });
        });

        // --- PHASE 2: Fill Employees to Baseline (Approx 4) ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                let count = staffObjects.filter(s => s.shiftType === st && s.type === 'employee' && s.assignedDays.includes(d)).length;
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
                         count++;
                     }
                }
            });
        });

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
                     validDays.sort((d1, d2) => {
                         const t1 = getTarget(d1, emp.shiftType);
                         const c1 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d1)).length;
                         const fill1 = c1 / t1;
                         const t2 = getTarget(d2, emp.shiftType);
                         const c2 = staffObjects.filter(s => s.shiftType === emp.shiftType && s.assignedDays.includes(d2)).length;
                         const fill2 = c2 / t2;
                         return fill1 - fill2;
                     });
                     emp.assignedDays.push(validDays[0]);
                     changed = true;
                 }
            }
        }

        // --- PHASE 4: Alba Fill (Target based) ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                const target = getTarget(d, st);
                let current = staffObjects.filter(s => s.shiftType === st && s.assignedDays.includes(d)).length;

                if (current < target) {
                     const candidates = staffObjects.filter(s =>
                        s.shiftType === st && s.type === 'byte' && canAssign(s, d)
                    );
                     candidates.sort((a,b) => {
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
            }
        }

        // --- PHASE 7: Role Assignment ---
        ['A', 'B'].forEach(st => {
            days.forEach(d => {
                const workers = staffObjects.filter(s => s.shiftType === st && s.assignedDays.includes(d));
                let unassigned = [...workers];

                // Helper to assign role
                const assign = (roleKey, filterFn) => {
                    const candidates = unassigned.filter(filterFn);
                    if (candidates.length === 0) return;
                    candidates.sort((a,b) => a.roleCounts[roleKey] - b.roleCounts[roleKey]);
                    const picked = candidates[0];
                    shifts[picked.name].assignments[d] = roleKey;
                    picked.roleCounts[roleKey]++;
                    unassigned = unassigned.filter(u => u !== picked);
                };

                // 1. Money Main
                assign(ROLES.MONEY, s => s.allowedRoles.includes('money_main'));

                // 2. Money Sub
                assign(ROLES.MONEY_SUB, s => s.allowedRoles.includes('money_sub'));

                // 3. Hall Resp
                assign(ROLES.HALL_RESP, s => s.allowedRoles.includes('hall_resp'));

                // 4. Warehouse
                assign(ROLES.WAREHOUSE, s => {
                    if (!s.allowedRoles.includes('warehouse')) return false;
                    if (shiftState.earlyWarehouseMode && s.type === 'employee' && s.shiftType === 'A') return false;
                    return true;
                });

                // 5. Others -> Hall or Generic
                unassigned.forEach(s => {
                    shifts[s.name].assignments[d] = 'ホ';
                });

                // Mark Off days
                const offStaff = staffObjects.filter(s => s.shiftType === st && !s.assignedDays.includes(d));
                offStaff.forEach(s => {
                    shifts[s.name].assignments[d] = '公休';
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
                    shifts[name].assignments[d] = '公休';
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

        const docId = `${Y}-${String(M).padStart(2,'0')}`;
        const docRef = doc(db, "shift_submissions", docId);

        await setDoc(docRef, shifts, { merge: true });
        showToast("AIシフト自動作成完了！ (厳格モード)");
        renderShiftAdminTable();

    } catch(e) {
        console.error("Auto Generation Error:", e);
        alert("自動作成中にエラーが発生しました:\n" + e.message);
    } finally {
        hideLoading();
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
    const shiftType = targetStaffObj ? targetStaffObj.shiftType : 'A'; // Default to A if not found

    // 2. Filter Candidates
    const candidates = staffObjects.filter(staff => {
        // Exclude self
        if (staff.name === currentStaffName) return false;

        // Exclude if already assigned on that day
        if (staff.assignedDays.includes(day)) return false;

        // Exclude if shift type mismatch (A replaces A, B replaces B)
        // Strictly speaking, we could allow cross-shift replacement if configured,
        // but for safety let's stick to same group replacement as per user context usually implies.
        // Actually, the request didn't specify strict shift type matching, but it makes sense.
        // Let's enforce Shift Type match to be safe.
        if (staff.shiftType !== shiftType) return false;

        // Check Constraints (Sandwich, Consecutive, etc.)
        // We pass strictContractMode = false, because we want to see VALID candidates.
        return checkAssignmentConstraint(staff, day, prevMonthAssignments, prevDaysCount, false);
    });

    // 3. Render Modal
    const modalDesc = document.getElementById('adj-modal-desc');
    modalDesc.textContent = `${M}/${day} (${shiftType}番) ${currentStaffName} さんの代わりを選択してください`;

    const listContainer = document.getElementById('adj-candidate-list');
    listContainer.innerHTML = '';

    if (candidates.length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-center text-slate-400 py-4">条件を満たす候補者はいません</p>';
    } else {
        // Sort candidates? Maybe by "Least Assigned" or "Contract fulfillment"?
        // Let's sort by "Days Remaining to Contract" descending (Needy first)
        candidates.sort((a,b) => {
            const remA = a.contractDays - a.assignedDays.length;
            const remB = b.contractDays - b.assignedDays.length;
            return remB - remA;
        });

        candidates.forEach(c => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 cursor-pointer transition";
            div.onclick = () => executeAdjustmentReplacement(day, currentStaffName, c.name, currentRole);

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

async function executeAdjustmentReplacement(day, oldStaff, newStaff, role) {
    if(!confirm(`${oldStaff} さんを ${newStaff} さんに交代しますか？\n(${oldStaff}さんは公休になります)`)) return;

    pushHistory();

    // Update Old Staff -> Off
    if (!shiftState.shiftDataCache[oldStaff].assignments) shiftState.shiftDataCache[oldStaff].assignments = {};
    shiftState.shiftDataCache[oldStaff].assignments[day] = '公休';

    // Update New Staff -> Assigned (Inherit Role or ShiftType Default)
    // If the role was a special role (like '金メ'), transfer it?
    // The prompt says "Vacancy -> Suggest Replacement".
    // Usually replacements take the same burden.
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
        showToast(`${newStaff} さんに交代しました`);
        document.getElementById('adjustment-candidate-modal').classList.add('hidden');
        renderShiftAdminTable();
    } catch(e) {
        alert("保存エラー: " + e.message);
    }
}

async function clearShiftAssignments() {
    if(!confirm("割り振りを全てクリアしますか？")) return;
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
    if(!confirm("現在の並び順を役職・ランク順にリセットしますか？")) return;
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

    // Gather data
    const type = document.getElementById('se-type').value; // 'employee' or 'byte'
    const basicShift = document.getElementById('se-basic-shift').value; // 'A' or 'B'
    const rank = document.getElementById('se-rank').value;
    const contractDays = parseInt(document.getElementById('se-contract-days').value) || 0;
    const maxConsecutive = parseInt(document.getElementById('se-max-consecutive').value) || 5;

    const allowedRoles = [];
    if(document.getElementById('se-allow-money-main').checked) allowedRoles.push('money_main');
    if(document.getElementById('se-allow-money-sub').checked) allowedRoles.push('money_sub');
    if(document.getElementById('se-allow-warehouse').checked) allowedRoles.push('warehouse');
    if(document.getElementById('se-allow-hall-resp').checked) allowedRoles.push('hall_resp');

    const newDetails = {
        rank,
        type,
        basic_shift: basicShift,
        contract_days: contractDays,
        max_consecutive_days: maxConsecutive,
        allowed_roles: allowedRoles
    };

    // Determine target list
    let targetListKey = 'employees';
    if(type === 'byte') {
        targetListKey = basicShift === 'A' ? 'alba_early' : 'alba_late';
    }

    showLoading();

    // Update State
    // 1. Details
    if (oldName && oldName !== newName) {
        delete shiftState.staffDetails[oldName];
    }
    shiftState.staffDetails[newName] = newDetails;

    // 2. Lists
    let oldListKey = null;
    let oldIndex = -1;
    ['employees', 'alba_early', 'alba_late'].forEach(k => {
        const idx = shiftState.staffListLists[k].indexOf(oldName);
        if(idx !== -1) {
            oldListKey = k;
            oldIndex = idx;
        }
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
        await setDoc(doc(db, 'masters', 'staff_data'), {
            employees: shiftState.staffListLists.employees,
            alba_early: shiftState.staffListLists.alba_early,
            alba_late: shiftState.staffListLists.alba_late,
            staff_details: shiftState.staffDetails
        });
        showToast("保存しました");
        document.getElementById('staff-edit-modal').classList.add('hidden');
        renderStaffMasterList();
        renderShiftAdminTable(); // refresh matrix
    } catch(e) {
        alert("保存エラー: " + e.message);
    }
    hideLoading();
}

async function deleteStaff() {
    const name = document.getElementById('se-name').getAttribute('data-original-name');
    if(!name) return;
    if(!confirm(`スタッフ「${name}」を削除しますか？\nこの操作は取り消せません。`)) return;

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
