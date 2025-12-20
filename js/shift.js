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
    selectedDay: null,
    adminSortMode: 'roster', // 'roster' or 'shift'
    viewMode: 'table', // 'table' or 'list' (for mobile)
    staffDetails: {},
    staffListLists: { employees: [], alba_early: [], alba_late: [] },
    historyStack: [] // For Undo
};

// --- Definitions ---
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
    OFF: '公休'
};

// --- Loading Helper ---
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

// --- DOM Injection & Initialization ---

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
                        <span id="shift-staff-name" class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-1 inline-block"></span>
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
                            元に戻す
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
                                        名前 <span class="text-[10px] font-normal text-slate-400 ml-1">ランク/連勤</span>
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

    <!-- NEW SHIFT ACTION PANEL -->
    <div id="shift-action-modal" class="modal-overlay hidden" style="z-index: 70;">
        <div class="modal-content p-0 w-full max-w-[340px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div class="bg-slate-800 text-white p-5 text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
                <h3 id="shift-action-title" class="text-lg font-black tracking-widest font-num mb-1"></h3>
                <div id="shift-action-status" class="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-slate-700/80 backdrop-blur-sm border border-slate-600 mt-1"></div>
            </div>

            <div class="p-6 grid grid-cols-3 gap-3">
                 <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition" data-role="公休">
                    <span class="text-xl">🏖️</span>
                    <span class="text-[10px] font-bold">公休</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition" data-role="work_req">
                    <span class="text-xl">🙋‍♂️</span>
                    <span class="text-[10px] font-bold">出勤希望</span>
                </button>
                <button class="action-btn-role flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-200 transition" data-role="clear">
                    <span class="text-xl">🔄</span>
                    <span class="text-[10px] font-bold">クリア</span>
                </button>
            </div>

            <div id="admin-role-grid" class="hidden px-6 pb-2 grid grid-cols-4 gap-2">
                 <button class="role-btn bg-yellow-50 text-yellow-700 border border-yellow-200 font-bold py-2 rounded-lg text-[10px]" data-role="金メ">金メ</button>
                 <button class="role-btn bg-amber-50 text-amber-700 border border-amber-200 font-bold py-2 rounded-lg text-[10px]" data-role="金サブ">金サブ</button>
                 <button class="role-btn bg-orange-50 text-orange-700 border border-orange-200 font-bold py-2 rounded-lg text-[10px]" data-role="ホ責">ホ責</button>
                 <button class="role-btn bg-blue-50 text-blue-700 border border-blue-200 font-bold py-2 rounded-lg text-[10px]" data-role="倉庫">倉庫</button>
            </div>

            <div class="px-6 pb-4">
                <label class="block text-[10px] font-bold text-slate-400 mb-1 ml-1">備考 (入力で即時保存)</label>
                <div class="relative">
                    <textarea id="shift-action-daily-input" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition" rows="2" placeholder="早退・遅刻予定など..."></textarea>
                    <div class="absolute bottom-2 right-2 text-slate-300 text-[10px]">📝</div>
                </div>
            </div>

            <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button onclick="closeShiftActionModal()" class="px-4 py-2 rounded-lg text-slate-400 font-bold text-xs hover:bg-slate-100 transition">閉じる</button>
                <div class="flex items-center gap-2">
                    <div id="admin-ab-toggle" class="hidden">
                        <button id="btn-toggle-ab" class="px-3 py-1.5 bg-white border border-slate-200 shadow-sm text-slate-600 rounded-lg text-[10px] font-black hover:text-indigo-600 transition">A/B 切替</button>
                    </div>
                    <button id="btn-action-next" class="pl-4 pr-2 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-1">
                        次の日 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
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
    document.querySelectorAll('.action-btn-role').forEach(btn => {
        btn.onclick = () => {
            const role = btn.dataset.role;
            handleActionPanelClick(role);
        };
    });
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.onclick = () => {
            handleActionPanelClick(btn.dataset.role);
        };
    });
    $('#btn-action-next').onclick = moveToNextDay;
    $('#btn-toggle-ab').onclick = toggleShiftAB;
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

    if (!shiftState.shiftDataCache[shiftState.selectedStaff]) {
        shiftState.shiftDataCache[shiftState.selectedStaff] = { off_days: [], work_days: [], assignments: {} };
    }
    const staffData = shiftState.shiftDataCache[shiftState.selectedStaff];
    const offDays = staffData.off_days || [];
    const workDays = staffData.work_days || [];
    const assignments = staffData.assignments || {};

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
        const assignedRole = assignments[d];
        const isSelected = d === shiftState.selectedDay;
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        let numColor = "text-slate-700";
        if (dayOfWeek === 0) numColor = "text-rose-500";
        if (dayOfWeek === 6) numColor = "text-blue-500";

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
                bgClass = "bg-blue-400 opacity-80";
                label = '<span class="text-[10px] text-white font-bold leading-none mt-1">出勤希</span>';
                statusText = '出勤希望';
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
        const color = dayOfWeek===0?'text-rose-500':dayOfWeek===6?'text-blue-500':'text-slate-600';
        th.className = `p-2 border-b border-r border-slate-200 min-w-[30px] text-center ${color} font-num`;
        th.textContent = d;
        headerRow.appendChild(th);
    }

    const tbody = document.getElementById('shift-admin-body');
    tbody.innerHTML = '';

    const createSection = (title, list, bgClass) => {
        if(!list || list.length === 0) return;
        const trTitle = document.createElement('tr');
        trTitle.innerHTML = `<td class="sticky left-0 z-20 p-2 font-bold text-xs ${bgClass} border-b border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" colspan="${daysInMonth+1}">${title}</td>`;
        tbody.appendChild(trTitle);

        list.forEach(name => {
            const tr = document.createElement('tr');
            const data = shiftState.shiftDataCache[name] || { off_days: [], work_days: [], assignments: {} };
            const details = shiftState.staffDetails[name] || {};
            const monthlySettings = (data.monthly_settings) || {};
            const currentType = monthlySettings.shift_type || details.basic_shift || 'A';
            const hasAnyRemark = (data.remarks && data.remarks.trim() !== "") || (data.daily_remarks && Object.keys(data.daily_remarks).length > 0);
            const tdName = document.createElement('td');
            tdName.className = "sticky left-0 z-20 bg-white p-2 border-b border-r border-slate-300 font-bold text-slate-700 text-xs truncate max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";

            const nameSpan = document.createElement('div');
            nameSpan.className = "flex flex-col mb-1";
            nameSpan.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="leading-tight ${hasAnyRemark ? 'text-indigo-600' : ''}">${name} ${hasAnyRemark ? '📝' : ''}</span>
                    <button class="w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${currentType==='A'?'bg-slate-50 text-slate-400':'bg-slate-800 text-white'} toggle-type-btn" data-name="${name}" data-type="${currentType}">${currentType}</button>
                </div>
                <span class="text-[9px] text-slate-300 font-normal leading-none block mt-0.5">連:${details.max_consecutive_days||5}</span>
            `;
            nameSpan.querySelector('.toggle-type-btn').onclick = (e) => { e.stopPropagation(); toggleStaffShiftType(name, currentType); };
            if(hasAnyRemark) nameSpan.onclick = () => showAdminNoteModal(name, data.remarks, data.daily_remarks);

            tdName.appendChild(nameSpan);
            tr.appendChild(tdName);

            for(let d=1; d<=daysInMonth; d++) {
                const td = document.createElement('td');
                const isOffReq = data.off_days && data.off_days.includes(d);
                const isWorkReq = data.work_days && data.work_days.includes(d);
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
                         if(assignment.includes('金メ')) { bgCell = 'bg-yellow-50'; roleColor = 'text-yellow-600'; }
                         else if(assignment.includes('金サブ')) { bgCell = 'bg-amber-50'; roleColor = 'text-amber-600'; }
                         else if(assignment.includes('ホ責')) { bgCell = 'bg-orange-50'; roleColor = 'text-orange-600'; }
                         else if(assignment.includes('倉庫')) { bgCell = 'bg-blue-50'; roleColor = 'text-blue-600'; }
                         else { bgCell = 'bg-white'; }

                         const typeLabel = currentType === 'A' ? 'A早' : 'B遅';
                         cellContent = `
                            <div class="flex flex-col items-center justify-center leading-none -mt-0.5">
                                <span class="text-[7px] text-slate-300 font-normal transform scale-90">${typeLabel}</span>
                                <span class="${roleColor} font-bold text-[10px] -mt-px">${assignment}</span>
                            </div>
                         `;
                    }
                } else {
                    if (isOffReq) { bgCell = 'bg-rose-50 hover:bg-rose-100'; cellContent = '<span class="text-rose-500 font-bold text-[10px] select-none">(休)</span>'; }
                    else if (isWorkReq) { bgCell = 'bg-slate-50 hover:bg-slate-100'; cellContent = '<span class="text-blue-300 font-bold text-[10px]">(出)</span>'; }
                }

                if (dailyRemark) cellContent += `<span class="absolute top-0 right-0 text-[8px] text-yellow-600">●</span>`;

                td.className = `border-b border-r border-slate-200 text-center cursor-pointer transition relative ${bgCell}`;
                td.innerHTML = cellContent;
                td.onclick = () => {
                     shiftState.selectedStaff = name;
                     showActionSelectModal(d, assignment || (isOffReq ? '公休希望' : isWorkReq ? '出勤希望' : '未設定'));
                };
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
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
    const adminToggle = document.getElementById('admin-ab-toggle');
    if (shiftState.isAdminMode) {
        adminRoles.classList.remove('hidden');
        adminToggle.classList.remove('hidden');
        const type = (staffData.monthly_settings?.shift_type) || (shiftState.staffDetails[name]?.basic_shift) || 'A';
        document.getElementById('btn-toggle-ab').textContent = `${type}番 (切替)`;
    } else {
        adminRoles.classList.add('hidden');
        adminToggle.classList.add('hidden');
    }
}

export function closeShiftActionModal() {
    document.getElementById('shift-action-modal').classList.add('hidden');
    if (shiftState.isAdminMode && shiftState.selectedStaff) {
         saveShiftToFirestore(shiftState.selectedStaff);
    }
}

function handleActionPanelClick(role) {
    const day = shiftState.selectedDay;
    const name = shiftState.selectedStaff;
    if (role === 'work_req') {
        toggleShiftRequest(day, 'work');
    } else if (role === 'clear') {
        if (!shiftState.shiftDataCache[name]) return;
        if (shiftState.isAdminMode) {
             delete shiftState.shiftDataCache[name].assignments[day];
             delete shiftState.shiftDataCache[name].daily_remarks[day];
        } else {
             shiftState.shiftDataCache[name].work_days = shiftState.shiftDataCache[name].work_days.filter(d => d !== day);
             shiftState.shiftDataCache[name].off_days = shiftState.shiftDataCache[name].off_days.filter(d => d !== day);
        }
        updateViewAfterAction();
    } else if (role === '公休') {
        if(shiftState.isAdminMode) setAdminRole('公休');
        else toggleShiftRequest(day, 'off');
    } else {
        if(shiftState.isAdminMode) setAdminRole(role);
    }
    closeShiftActionModal();
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

async function toggleShiftRequest(day, type) {
    const name = shiftState.selectedStaff;
    if (!shiftState.shiftDataCache[name]) shiftState.shiftDataCache[name] = { off_days: [], work_days: [], assignments: {} };
    let offList = shiftState.shiftDataCache[name].off_days || [];
    let workList = shiftState.shiftDataCache[name].work_days || [];
    if (type === 'off') {
        if (offList.includes(day)) offList = offList.filter(d => d !== day);
        else { offList.push(day); workList = workList.filter(d => d !== day); }
    } else if (type === 'work') {
        if (workList.includes(day)) workList = workList.filter(d => d !== day);
        else { workList.push(day); offList = offList.filter(d => d !== day); }
    }
    shiftState.shiftDataCache[name].off_days = offList;
    shiftState.shiftDataCache[name].work_days = workList;
    updateViewAfterAction();
}

function moveToNextDay() {
    if(!shiftState.selectedDay) return;
    const nextDay = shiftState.selectedDay + 1;
    const daysInMonth = new Date(shiftState.currentYear, shiftState.currentMonth, 0).getDate();
    closeShiftActionModal();
    if (nextDay > daysInMonth) { showToast("月の最終日です"); return; }
    setTimeout(() => {
        const name = shiftState.selectedStaff;
        const data = shiftState.shiftDataCache[name] || {};
        const isOff = data.off_days?.includes(nextDay);
        const isWork = data.work_days?.includes(nextDay);
        const assign = data.assignments?.[nextDay];
        const status = assign || (isOff ? '公休希望' : isWork ? '出勤希望' : '未設定');
        showActionSelectModal(nextDay, status);
    }, 200);
}

function toggleShiftAB() {
    const name = shiftState.selectedStaff;
    const data = shiftState.shiftDataCache[name] || {};
    const current = (data.monthly_settings?.shift_type) || (shiftState.staffDetails[name]?.basic_shift) || 'A';
    toggleStaffShiftType(name, current);
    const newType = current === 'A' ? 'B' : 'A';
    document.getElementById('btn-toggle-ab').textContent = `${newType}番 (切替)`;
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

// --- Restore Full Auto Shift Logic ---
async function generateAutoShift() {
    if(!confirm(`${shiftState.currentYear}年${shiftState.currentMonth}月のシフトを自動作成します。\n既存の確定済みシフトは上書きされます（希望休などは保持）。\nよろしいですか？`)) return;

    pushHistory();
    showLoading();

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
            maxConsecutive: d.max_consecutive_days || 5,
            allowedRoles: d.allowed_roles || [],
            shiftType: m.shift_type || d.basic_shift || 'A',
            requests: {
                work: s.work_days || [],
                off: s.off_days || []
            },
            assignedDays: [],
            roleCounts: {
                [ROLES.MONEY]: 0,
                [ROLES.MONEY_SUB]: 0,
                [ROLES.HALL_RESP]: 0,
                [ROLES.WAREHOUSE]: 0,
                [ROLES.HALL]: 0
            }
        };
    };

    let staffObjects = staffNames.map(getS);

    // Clear existing
    staffObjects.forEach(s => {
        if(!shifts[s.name]) shifts[s.name] = {};
        shifts[s.name].assignments = {};
        s.requests.work.forEach(d => {
            if (!s.requests.off.includes(d)) {
                s.assignedDays.push(d);
            }
        });
    });

    const isResponsible = (s) => s.allowedRoles.includes('money_main');
    const canWork = (s, day) => {
        if (s.requests.off.includes(day)) return false;
        if (s.assignedDays.includes(day)) return true;
        const tempDays = [...s.assignedDays, day].sort((a,b) => a-b);
        let streak = 0;
        let maxStreak = 0;
        let prev = -1;
        for (const d of tempDays) {
            if (d === prev + 1) { streak++; } else { streak = 1; }
            if (streak > s.maxConsecutive) return false;
            maxStreak = Math.max(maxStreak, streak);
            prev = d;
        }
        return maxStreak <= s.maxConsecutive;
    };

    const countStaff = (day, shiftType, typeFilter = null) => {
        return staffObjects.filter(s =>
            s.shiftType === shiftType &&
            s.assignedDays.includes(day) &&
            (!typeFilter || s.type === typeFilter)
        ).length;
    };
    const countTotalStaff = (day, shiftType) => {
        return staffObjects.filter(s => s.shiftType === shiftType && s.assignedDays.includes(day)).length;
    };
    const hasResponsibleOnDay = (day, shiftType) => {
        return staffObjects.some(s =>
            s.shiftType === shiftType &&
            s.assignedDays.includes(day) &&
            isResponsible(s)
        );
    };

    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

    // Phase 1: Employee Baseline
    ['A', 'B'].forEach(st => {
        days.forEach(d => {
            if (!hasResponsibleOnDay(d, st)) {
                const candidates = staffObjects.filter(s =>
                    s.shiftType === st && s.type === 'employee' && isResponsible(s) && !s.assignedDays.includes(d) && canWork(s, d)
                );
                if (candidates.length > 0) {
                    candidates.sort((a,b) => a.assignedDays.length - b.assignedDays.length);
                    candidates[0].assignedDays.push(d);
                }
            }
            let currentEmpCount = countStaff(d, st, 'employee');
            if (currentEmpCount < 4) {
                const candidates = staffObjects.filter(s =>
                    s.shiftType === st && s.type === 'employee' && !s.assignedDays.includes(d) && canWork(s, d)
                );
                candidates.sort((a,b) => a.assignedDays.length - b.assignedDays.length);
                for (const cand of candidates) {
                    if (currentEmpCount >= 4) break;
                    cand.assignedDays.push(d);
                    currentEmpCount++;
                }
            }
        });
    });

    // Phase 2: Employee Contract Fill
    let changed = true;
    while (changed) {
        changed = false;
        const needy = staffObjects.filter(s => s.type === 'employee' && s.assignedDays.length < s.contractDays);
        needy.sort((a,b) => (a.contractDays - a.assignedDays.length) - (b.contractDays - b.assignedDays.length)).reverse();
        for (const emp of needy) {
            const validDays = days.filter(d => !emp.assignedDays.includes(d) && canWork(emp, d));
            if (validDays.length === 0) continue;
            validDays.sort((d1, d2) => countStaff(d1, emp.shiftType, 'employee') - countStaff(d2, emp.shiftType, 'employee'));
            emp.assignedDays.push(validDays[0]);
            changed = true;
        }
    }

    // Phase 3: Alba Baseline
    const dailyTargets = shiftState.shiftDataCache._daily_targets || {};
    ['A', 'B'].forEach(st => {
        days.forEach(d => {
            const t = dailyTargets[d] || { A: 9, B: 9 };
            const TARGET_TOTAL = st === 'A' ? (t.A !== undefined ? t.A : 9) : (t.B !== undefined ? t.B : 9);
            let currentTotal = countTotalStaff(d, st);
            if (currentTotal < TARGET_TOTAL) {
                const candidates = staffObjects.filter(s =>
                    s.shiftType === st && s.type === 'byte' && !s.assignedDays.includes(d) && canWork(s, d)
                );
                candidates.sort((a,b) => (a.contractDays - a.assignedDays.length) - (b.contractDays - b.assignedDays.length)).reverse();
                for (const cand of candidates) {
                    if (currentTotal >= TARGET_TOTAL) break;
                    cand.assignedDays.push(d);
                    currentTotal++;
                }
            }
        });
    });

    // Phase 4: Alba Contract Fill
    changed = true;
    while (changed) {
        changed = false;
        const needy = staffObjects.filter(s => s.type === 'byte' && s.assignedDays.length < s.contractDays);
        for (const alba of needy) {
            const validDays = days.filter(d => !alba.assignedDays.includes(d) && canWork(alba, d));
            if (validDays.length === 0) continue;
            validDays.sort((d1, d2) => countTotalStaff(d1, alba.shiftType) - countTotalStaff(d2, alba.shiftType));
            alba.assignedDays.push(validDays[0]);
            changed = true;
        }
    }

    // Finalize Roles
    ['A', 'B'].forEach(st => {
        days.forEach(d => {
            const workers = staffObjects.filter(s => s.shiftType === st && s.assignedDays.includes(d));
            let unassigned = [...workers];
            const assign = (roleKey, filterFn) => {
                const candidates = unassigned.filter(filterFn);
                if (candidates.length === 0) return;
                candidates.sort((a,b) => a.roleCounts[roleKey] - b.roleCounts[roleKey]);
                const picked = candidates[0];
                shifts[picked.name].assignments[d] = roleKey;
                picked.roleCounts[roleKey]++;
                unassigned = unassigned.filter(u => u !== picked);
            };
            assign(ROLES.MONEY, s => s.allowedRoles.includes('money_main'));
            assign(ROLES.MONEY_SUB, s => s.allowedRoles.includes('money_sub'));
            assign(ROLES.HALL_RESP, s => s.allowedRoles.includes('hall_resp'));
            assign(ROLES.WAREHOUSE, s => s.allowedRoles.includes('warehouse'));
            unassigned.forEach(s => {
                shifts[s.name].assignments[d] = '出勤';
            });
            const offStaff = staffObjects.filter(s => s.shiftType === st && s.requests.off.includes(d));
            offStaff.forEach(s => {
                shifts[s.name].assignments[d] = '公休';
            });
        });
    });

    staffNames.forEach(name => {
        if (!shifts[name]) shifts[name] = {};
        if (!shifts[name].assignments) shifts[name].assignments = {};
        for (let d = 1; d <= daysInMonth; d++) {
            if (!shifts[name].assignments[d]) {
                shifts[name].assignments[d] = '公休';
            }
        }
    });

    const docId = `${Y}-${String(M).padStart(2,'0')}`;
    const docRef = doc(db, "shift_submissions", docId);
    try {
        await setDoc(docRef, shifts, { merge: true });
        showToast("シフト自動作成完了！ (パズル方式)");
        renderShiftAdminTable();
    } catch(e) {
        alert("自動作成保存失敗: " + e.message);
    }
    hideLoading();
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
window.updateRankOptions = () => {};
window.resetStaffSort = async () => {};
window.openStaffMasterModal = () => document.getElementById('staff-master-modal').classList.remove('hidden');
window.openStaffEditModal = (name) => {
    document.getElementById('staff-edit-modal').classList.remove('hidden');
    document.getElementById('staff-edit-title').textContent = name ? "スタッフ編集" : "追加";
    document.getElementById('se-name').value = name || "";
};
async function saveStaffDetails() {}
async function deleteStaff() {}
window.saveDailyTarget = async () => { };
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
