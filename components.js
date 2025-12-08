
export function renderInfoSections() {
    const container = document.getElementById('info-sections-container');
    if (!container) return;

    // --- 1. PACHINKO TEAM (Blue) ---
    const section1 = `
    <div class="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 shadow-sm border border-blue-100 h-full">
        <div class="flex items-center gap-3 mb-6">
            <div class="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-200">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
                <h3 class="text-xl font-black text-slate-800 tracking-tight">パチンコチーム共有</h3>
                <p class="text-xs font-bold text-blue-500">Pachinko Team Info</p>
            </div>
        </div>

        <div class="space-y-4">
            <!-- 4円パチンコ -->
            <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div class="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2 pl-3">
                    <h4 class="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">エヴァ & 話題の新台</h4>
                    <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">4円パチンコ</span>
                </div>
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3">
                    平日・週末ともにエヴァ推奨。話題の新台「暴凶星」「アズールレーン」も動くのでしっかり案内を実施！
                </p>
            </div>

            <!-- 時差開放 -->
            <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
                <div class="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <div class="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2 pl-3">
                    <h4 class="font-bold text-slate-800 text-lg group-hover:text-purple-600 transition-colors">金曜時差 & バラエティ</h4>
                    <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">時差開放</span>
                </div>
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3">
                    金曜時差は継続。増台した「ブルロ」「炎炎」がメイン。週末は炎炎2・からくり2・リゼロ2など選り取り見取り感を演出。
                </p>
            </div>

            <!-- 1円パチンコ -->
            <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-yellow-400 transition-colors">
                <div class="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                <div class="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2 pl-3">
                    <h4 class="font-bold text-slate-800 text-lg group-hover:text-yellow-600 transition-colors">海物語配置変更 & エヴァ17</h4>
                    <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">1円パチンコ</span>
                </div>
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3">
                    入口最前列を「海物語」に変更し盛況感UP。スマパチ増台。1円「エヴァ17」導入に伴い週末から販促強化で期待感を作ります。
                </p>
            </div>
        </div>
    </div>`;

    // --- 2. SLOT TEAM (Purple) ---
    const section2 = `
    <div class="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 shadow-sm border border-purple-100 h-full">
        <div class="flex items-center gap-3 mb-6">
            <div class="bg-purple-600 p-2 rounded-lg shadow-lg shadow-purple-200">
                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
                <h3 class="text-xl font-black text-slate-800 tracking-tight">スロットチーム共有</h3>
                <p class="text-xs font-bold text-purple-500">Slot Team Info</p>
            </div>
        </div>

        <div class="space-y-4">
             <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <ul class="space-y-3 text-sm text-slate-700 font-medium">
                    <li class="pl-2 border-l-4 border-indigo-500">
                        <span class="font-bold text-indigo-700">8日 (日):</span> 【八潮上空 × おすしさん夜来店】周年月間初回の上空！喰種筆頭にメイン機種を。夜稼働も強化。※9日は競合周年のため新装告知を徹底。
                    </li>
                    <li class="pl-2 border-l-4 border-indigo-500">
                        <span class="font-bold text-indigo-700">9日 (月):</span> 【新装開店 × 七咲ななさん夜来店】暴凶星・アズレン・化物語導入！競合周年に負けず、期待感の高い新台をアピール。
                    </li>
                    <li class="pl-2 border-l-4 border-slate-300">
                        <span class="font-bold text-slate-600">10日(火)・11日(水):</span> 【耐える期間】イベント無し。新台と喰種を埋めつつ、平日はジャグラーで常連様を囲い込み再遊技を促進。
                    </li>
                    <li class="pl-2 border-l-4 border-indigo-500">
                        <span class="font-bold text-indigo-700">12日 (木):</span> 【八潮上空 × よっしー＆烏丸シュウジ × おにくさん夜来店】BASHtv恒例来店！最優先は東京喰種。夜はおにくさん＝サミー系＆モンハンへ誘導。
                    </li>
                    <li class="pl-2 border-l-4 border-pink-500">
                         <span class="font-bold text-pink-700">13日 (金):</span> 【マッティさん来店】出玉期待度大。メインから少数台までチャンスあり。翌日「for埼玉」の告知＋出玉アピールを徹底。
                    </li>
                    <li class="pl-2 border-l-4 border-emerald-500">
                         <span class="font-bold text-emerald-700">14日 (土):</span> 【スロパチ for 埼玉】ジャグラーは「列」か「全体」を意識。並びでの出玉感も演出。常連様へ周年への期待感を醸成。
                    </li>
                </ul>
                <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">
                    【重要周知】W周年月間表記NGにより、真の周年日は「12/27」となります。お客様への案内ミスなきよう注意！
                </div>
            </div>
        </div>
    </div>`;

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>${section1}</div>
            <div>${section2}</div>
        </div>
    `;
}

export function renderModals() {
    const container = document.getElementById('modals-container');
    if (!container) return;

    container.innerHTML = `
    <div id="operations-modal" class="modal-overlay hidden">
        <div class="modal-content p-6 max-w-lg">
            <h3 class="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <span class="text-2xl">📝</span> 稼働実績の入力
            </h3>

            <div class="space-y-6 max-h-[60vh] overflow-y-auto px-1">
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div class="text-sm font-bold text-indigo-600 mb-3 flex items-center gap-2">
                        <span class="w-2 h-4 bg-indigo-500 rounded-full"></span> 15:00 の数値
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="op-input-group col-span-2">
                            <label>目標数 (全体)</label>
                            <input type="number" id="in_target_15" class="op-input" placeholder="目標">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="op-input-group">
                            <label class="text-blue-500">4円パチンコ</label>
                            <input type="number" id="in_4p_15" class="op-input" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-yellow-600">1円パチンコ</label>
                            <input type="number" id="in_1p_15" class="op-input" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-emerald-600">20円スロット</label>
                            <input type="number" id="in_20s_15" class="op-input" placeholder="0">
                        </div>
                    </div>
                </div>

                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div class="text-sm font-bold text-purple-600 mb-3 flex items-center gap-2">
                        <span class="w-2 h-4 bg-purple-500 rounded-full"></span> 19:00 の数値
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="op-input-group col-span-2">
                            <label>目標数 (全体)</label>
                            <input type="number" id="in_target_19" class="op-input" placeholder="目標">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="op-input-group">
                            <label class="text-blue-500">4円パチンコ</label>
                            <input type="number" id="in_4p_19" class="op-input" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-yellow-600">1円パチンコ</label>
                            <input type="number" id="in_1p_19" class="op-input" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-emerald-600">20円スロット</label>
                            <input type="number" id="in_20s_19" class="op-input" placeholder="0">
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 flex gap-3">
                <button onclick="closeOpInput()" class="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">キャンセル</button>
                <button onclick="saveOpData()" class="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700">保存する</button>
            </div>
        </div>
    </div>

    <div id="calendar-modal" class="modal-overlay hidden">
        <div class="modal-content p-6 w-full max-w-4xl h-[85vh] flex flex-col">
            <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span class="text-2xl">📅</span> 12月 月間稼働推移
                </h3>
                <button onclick="closeMonthlyCalendar()" class="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <div id="calendar-grid-body" class="flex-1 overflow-y-auto pr-1">
                </div>
        </div>
    </div>

    <div id="qscModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"><div class="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0"><div class="flex items-center gap-2"><h3 class="font-bold text-xl text-slate-800">QSC チェックリスト</h3><div class="flex bg-slate-100 p-1 rounded-lg"><button id="qscTabUnfinished" class="px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm">未実施</button><button id="qscTabFinished" class="px-3 py-1 text-xs font-bold rounded-md text-slate-400">完了済</button></div></div><div class="flex items-center gap-2"><button id="qscEditButton" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition">⚙️ 管理</button><button id="closeQscModal" class="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div></div><div class="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6"><div id="qscAddForm" class="hidden mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100"><h4 class="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-widest">新規項目</h4><div class="flex flex-col gap-2"><div class="grid grid-cols-3 gap-2"><input type="number" id="newQscNo" placeholder="No." class="border border-slate-200 rounded p-2 text-sm" min="1"><input type="text" id="newQscArea" placeholder="エリア" class="col-span-2 border border-slate-200 rounded p-2 text-sm"></div><input type="text" id="newQscContent" placeholder="内容" class="border border-slate-200 rounded p-2 text-sm"><button onclick="addQscItem()" class="bg-indigo-600 text-white font-bold text-sm py-2 rounded-lg">追加</button></div></div><div id="qscListContainer" class="space-y-3"></div></div><div class="p-3 bg-white border-t border-slate-100 text-center"><p class="text-xs text-slate-400 font-bold">チェックを入れると全員に反映されます</p></div></div></div>
    <div id="newOpeningModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"><div class="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0"><h3 class="font-bold text-xl text-slate-800">導入機種リスト</h3><button id="closeNewOpeningModal" class="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div id="newOpeningInfo" class="p-5 overflow-y-auto bg-slate-50/50"></div></div></div>
    <div id="machineDetailModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"><div class="bg-slate-800 p-6 sm:p-8 flex justify-between items-start shrink-0"><h3 id="detailName" class="text-xl sm:text-2xl font-bold text-white leading-tight pr-4"></h3><button id="closeDetailModal" class="text-slate-400 hover:text-white"><svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div class="p-6 sm:p-8 overflow-y-auto"><div class="mb-8 bg-slate-50 rounded-2xl p-6 border border-slate-200 relative overflow-hidden"><div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div><h4 class="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">SALES POINT</h4><p id="detailPitch" class="text-slate-700 text-base sm:text-lg font-medium leading-loose whitespace-pre-line"></p></div><div class="grid sm:grid-cols-2 gap-6"><div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100"><div class="flex items-center gap-2 mb-3 text-emerald-700 font-bold">GOOD</div><ul id="detailPros" class="space-y-2 text-sm font-bold text-emerald-800"></ul></div><div class="bg-rose-50 p-5 rounded-2xl border border-rose-100"><div class="flex items-center gap-2 mb-3 text-rose-700 font-bold">BAD</div><ul id="detailCons" class="space-y-2 text-sm font-bold text-rose-800"></ul></div></div></div></div></div>

    <div id="password-modal" class="modal-overlay hidden"><div class="modal-content p-8 text-center"><h3 class="text-xl font-bold text-slate-800 mb-2">管理者認証</h3><p class="text-sm text-slate-500 mb-6">パスワードを入力してください。</p><input id="password-input" type="password" class="w-full p-3 border border-slate-200 rounded-lg mb-4 bg-slate-50 text-center font-bold focus:border-indigo-500 focus:outline-none" placeholder="Password"><p id="password-error" class="text-rose-500 text-xs font-bold mb-4 hidden">パスワードが違います</p><div class="flex gap-3 justify-center"><button onclick="closePasswordModal()" class="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">キャンセル</button><button onclick="checkPassword()" class="px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">認証</button></div></div></div>

    <div id="select-modal" class="select-modal-overlay hidden">
        <div class="select-modal-content flex flex-col max-h-[85vh]">
            <div class="p-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                <span class="font-black text-slate-700 text-lg" id="select-modal-title">選択</span>
                <button onclick="closeSelectModal()" class="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div id="select-modal-body" class="select-modal-body flex-1 overflow-y-auto bg-slate-50 p-2"></div>
            <div class="select-modal-footer shrink-0">
                <button onclick="closeSelectModal()" class="text-sm font-bold text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100">キャンセル</button>
                <button id="select-confirm-btn" onclick="confirmSelection()" class="confirm-btn" disabled>決定する</button>
            </div>
        </div>
    </div>

    <div id="bulk-delete-modal" class="modal-overlay hidden">
        <div class="modal-content p-6 max-w-lg">
            <h3 class="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <span class="text-2xl">🗑️</span> 一斉削除メニュー
            </h3>
            <div class="delete-menu-grid">
                <div class="delete-menu-section">
                    <div class="delete-menu-title"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> ☀ 早番 (開店)</div>
                    <div class="delete-menu-buttons">
                        <button onclick="requestBulkDelete('bulk_tasks', 'open')" class="btn-delete-task">タスクのみクリア</button>
                        <button onclick="requestBulkDelete('bulk_staff', 'open')" class="btn-delete-staff">人員ごと削除</button>
                    </div>
                </div>
                <div class="delete-menu-section">
                    <div class="delete-menu-title"><span class="w-2 h-2 rounded-full bg-purple-500"></span> 🌙 遅番 (閉店)</div>
                    <div class="delete-menu-buttons">
                        <button onclick="requestBulkDelete('bulk_tasks', 'close')" class="btn-delete-task">タスクのみクリア</button>
                        <button onclick="requestBulkDelete('bulk_staff', 'close')" class="btn-delete-staff">人員ごと削除</button>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-slate-100 pt-6">
                 <button onclick="requestBulkDelete('reset_all', 'all')" class="btn-reset-all">
                    ⚠️ 1日分をすべて完全削除
                </button>
            </div>
            <button onclick="closeBulkDeleteModal()" class="w-full mt-4 py-3 text-slate-400 font-bold hover:text-slate-600">キャンセル</button>
        </div>
    </div>

    <div id="delete-modal" class="modal-overlay hidden">
        <div class="modal-content p-8 text-center">
            <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-2">削除の確認</h3>
            <p id="delete-modal-message" class="text-sm text-slate-500 mb-6 whitespace-pre-line"></p>
            <div class="flex gap-3 justify-center">
                <button onclick="cancelDelete()" class="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">キャンセル</button>
                <button onclick="confirmDelete()" class="px-6 py-2.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200">削除する</button>
            </div>
        </div>
    </div>

    <div id="remarks-modal" class="modal-overlay hidden"><div class="modal-content p-6"><h3 class="text-lg font-bold text-slate-800 mb-1" id="remarks-modal-task"></h3><p class="text-xs font-bold text-slate-400 mb-4" id="remarks-modal-time"></p><div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm font-medium leading-relaxed mb-6" id="remarks-modal-text"></div><button onclick="closeRemarksModal()" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">閉じる</button></div></div>
    `;
}
