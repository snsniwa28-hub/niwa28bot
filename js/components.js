
let currentStrategySlide = 0;
const strategyImages = [
    'senryaku1.jpg',
    'senryaku2.jpg',
    'senryaku3.jpg',
    'senryaku4.jpg',
    'senryaku5.jpg'
];

export function changeStrategySlide(direction) {
    const slides = document.querySelectorAll('.strategy-slide');
    if (slides.length === 0) return;

    // Update index
    currentStrategySlide += direction;
    if (currentStrategySlide >= slides.length) currentStrategySlide = 0;
    if (currentStrategySlide < 0) currentStrategySlide = slides.length - 1;

    // Update visibility
    slides.forEach((slide, index) => {
        if (index === currentStrategySlide) {
            slide.classList.remove('opacity-0', 'pointer-events-none');
            slide.classList.add('opacity-100', 'pointer-events-auto');
        } else {
            slide.classList.remove('opacity-100', 'pointer-events-auto');
            slide.classList.add('opacity-0', 'pointer-events-none');
        }
    });
}

export function renderInfoSections() {
    const container = document.getElementById('internalSharedModalBody');
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
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3 text-pretty">
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
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3 text-pretty">
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
                <p class="text-sm text-slate-600 font-medium leading-relaxed pl-3 text-pretty">
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

        <div class="grid grid-cols-1 gap-4">
            <!-- 8日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-1 rounded">8日 (日)</span>
                    <span class="text-xs font-bold text-slate-400">八潮上空 / 来店</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed text-pretty">
                    【八潮上空 × おすしさん夜来店】
                </p>
                <p class="text-sm text-slate-600 mt-1 text-pretty">
                    周年月間初回の上空！喰種筆頭にメイン機種を。夜稼働も強化。
                    <span class="block mt-1 text-xs text-slate-400">※9日は競合周年のため新装告知を徹底。</span>
                </p>
            </div>

            <!-- 9日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-1 rounded">9日 (月)</span>
                    <span class="text-xs font-bold text-slate-400">新装開店 / 来店</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed text-pretty">
                    【新装開店 × 七咲ななさん夜来店】
                </p>
                <p class="text-sm text-slate-600 mt-1 text-pretty">
                    暴凶星・アズレン・化物語導入！競合周年に負けず、期待感の高い新台をアピール。
                </p>
            </div>

            <!-- 10日・11日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-slate-300 shadow-sm hover:shadow-md transition-shadow">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="bg-slate-100 text-slate-600 text-xs font-black px-2 py-1 rounded">10(火)・11(水)</span>
                    <span class="text-xs font-bold text-slate-400">通常営業</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed">
                    【耐える期間】
                </p>
                 <p class="text-sm text-slate-600 mt-1 text-pretty">
                    イベント無し。新台と喰種を埋めつつ、平日はジャグラーで常連様を囲い込み再遊技を促進。
                </p>
            </div>

            <!-- 12日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-1 rounded">12日 (木)</span>
                    <span class="text-xs font-bold text-slate-400">八潮上空 / BASHtv</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed text-pretty">
                    【八潮上空 × よっしー＆烏丸シュウジ × おにくさん】
                </p>
                 <p class="text-sm text-slate-600 mt-1 text-pretty">
                    BASHtv恒例来店！最優先は東京喰種。夜はおにくさん＝サミー系＆モンハンへ誘導。
                </p>
            </div>

            <!-- 13日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-pink-500 shadow-sm hover:shadow-md transition-shadow">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="bg-pink-100 text-pink-700 text-xs font-black px-2 py-1 rounded">13日 (金)</span>
                    <span class="text-xs font-bold text-slate-400">来店イベント</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed">
                    【マッティさん来店】
                </p>
                 <p class="text-sm text-slate-600 mt-1 text-pretty">
                    出玉期待度大。メインから少数台までチャンスあり。翌日「for埼玉」の告知＋出玉アピールを徹底。
                </p>
            </div>

            <!-- 14日 -->
            <div class="bg-white rounded-xl p-4 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-1 rounded">14日 (土)</span>
                    <span class="text-xs font-bold text-slate-400">スロパチ / 週末</span>
                </div>
                <p class="text-sm text-slate-700 font-bold leading-relaxed">
                    【スロパチ for 埼玉】
                </p>
                 <p class="text-sm text-slate-600 mt-1 text-pretty">
                    ジャグラーは「列」か「全体」を意識。並びでの出玉感も演出。常連様へ周年への期待感を醸成。
                </p>
            </div>

            <!-- 重要周知 -->
            <div class="mt-2 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 shadow-sm">
                <span class="text-xl">⚠️</span>
                <div>
                    <h4 class="text-xs font-black text-red-700 uppercase tracking-widest mb-1">IMPORTANT NOTICE</h4>
                    <p class="text-sm font-bold text-red-800 leading-snug text-pretty">
                        W周年月間表記NGにより、真の周年日は「12/27」となります。お客様への案内ミスなきよう注意！
                    </p>
                </div>
            </div>
        </div>
    </div>`;

    // --- 3. STRATEGY DETAILS (Red/Special) - REVISED (SLIDESHOW + WEEKLY ACTIONS) ---
    // Generate slides HTML
    const slidesHtml = strategyImages.map((src, index) => {
        const isVisible = index === currentStrategySlide;
        const opacityClass = isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none';
        return `
            <div class="strategy-slide absolute top-0 left-0 w-full h-full transition-opacity duration-500 ease-in-out ${opacityClass} flex items-center justify-center bg-slate-50">
                <img src="${src}" class="w-full h-full object-contain" alt="Strategy Slide ${index + 1}">
            </div>
        `;
    }).join('');

    const sectionStrategy = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
        <!-- HEADER -->
        <div class="bg-gradient-to-r from-red-600 to-rose-500 p-4 text-white text-center shrink-0">
            <h3 class="text-xl font-black tracking-tight mb-1">12月戦略詳細</h3>
            <p class="text-xs font-bold opacity-90">周年月間 × エヴァ17大量導入「ヤシオ作戦」</p>
        </div>

        <div class="p-4 flex-1 space-y-6">
            <!-- SLIDESHOW CONTAINER -->
            <div id="strategy-slideshow-container" class="relative w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 group">
                ${slidesHtml}

                <!-- Controls -->
                <button data-action="strategy-slide-prev" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-10">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button data-action="strategy-slide-next" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 z-10">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <!-- MONTHLY GOALS -->
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 class="text-center text-sm font-black text-slate-800 mb-3 border-b border-slate-200 pb-2">
                    🎯 月間集客目標
                </h4>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-white p-2 rounded shadow-sm border border-slate-100">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">12/25</div>
                        <div class="text-sm font-black text-slate-800">300名</div>
                    </div>
                    <div class="bg-white p-2 rounded shadow-md border border-red-500 relative overflow-hidden">
                         <div class="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-bl"></div>
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">12/27</div>
                        <div class="text-lg font-black text-red-600">530名</div>
                    </div>
                    <div class="bg-white p-2 rounded shadow-sm border border-slate-100">
                        <div class="text-[10px] font-bold text-slate-500 mb-0.5">12/28</div>
                        <div class="text-sm font-black text-slate-800">700名</div>
                    </div>
                </div>
            </div>

            <!-- WEEKLY ACTIONS -->
            <div class="space-y-4 px-1">
                <!-- Week 1-2 -->
                <div class="flex gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku3.jpg" class="w-24 h-auto object-contain rounded shadow-sm shrink-0" alt="Week 1-2">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded">第1〜2週</span>
                            <span class="text-xs font-bold text-slate-500">導入・助走</span>
                        </div>
                        <p class="text-xs text-slate-700 font-bold leading-relaxed text-pretty">
                            エヴァ17・バジリスクなどの話題機導入で集客のベースを作る期間。
                        </p>
                    </div>
                </div>
                <!-- Week 3 -->
                <div class="flex gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku4.jpg" class="w-24 h-auto object-contain rounded shadow-sm shrink-0" alt="Week 3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded">第3週</span>
                            <span class="text-xs font-bold text-slate-500">本番・展開</span>
                        </div>
                        <p class="text-xs text-slate-700 font-bold leading-relaxed text-pretty">
                            12/27 周年本番！最大級の出玉と演出で地域No.1の稼働を目指す。
                        </p>
                    </div>
                </div>
                <!-- Week 4 -->
                <div class="flex gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku5.jpg" class="w-24 h-auto object-contain rounded shadow-sm shrink-0" alt="Week 4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded">第4週</span>
                            <span class="text-xs font-bold text-slate-500">クライマックス</span>
                        </div>
                        <p class="text-xs text-slate-700 font-bold leading-relaxed text-pretty">
                            年末年始営業へ突入。総力戦で2023年を締めくくり、良いスタートダッシュを。
                        </p>
                    </div>
                </div>
            </div>

            <!-- STAFF MISSION -->
            <div class="bg-indigo-900 rounded-xl p-5 text-white shadow-lg border border-indigo-800">
                <h4 class="text-center font-black text-yellow-400 tracking-widest border-b border-indigo-700 pb-2 mb-4 text-sm">STAFF MISSION</h4>
                <div class="space-y-4">
                    <div class="flex items-start gap-3">
                         <span class="bg-white text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5">早番</span>
                         <div>
                             <p class="font-bold text-sm leading-snug">「新台・オススメ」で稼働を作る。</p>
                             <p class="text-indigo-300 text-xs font-medium mt-0.5">お客様への積極的なお声がけを！</p>
                         </div>
                    </div>
                    <div class="flex items-start gap-3">
                         <span class="bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5">遅番</span>
                         <div>
                            <p class="font-bold text-sm leading-snug">「翌日・特日告知」で朝の並びを作る。</p>
                            <p class="text-indigo-300 text-xs font-medium mt-0.5">退店時のお客様へアピール！</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div class="h-full">${section1}</div>
            <div class="h-full">${section2}</div>
            <div class="col-span-1 md:col-span-2">${sectionStrategy}</div>
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
                        <div class="op-input-group">
                            <label>目標稼働</label>
                            <input type="number" id="in_target_15" class="op-input" placeholder="目標">
                        </div>
                        <div class="op-input-group">
                            <label class="text-indigo-600 font-bold">実際稼働</label>
                            <input type="number" id="in_today_target_15" class="op-input border-indigo-200 focus:border-indigo-500" placeholder="実績入力">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="op-input-group">
                            <label class="text-blue-500">4円パチンコ</label>
                            <input type="number" id="in_4p_15" class="op-input js-calc-trigger" data-time="15" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-yellow-600">1円パチンコ</label>
                            <input type="number" id="in_1p_15" class="op-input js-calc-trigger" data-time="15" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-emerald-600">20円スロット</label>
                            <input type="number" id="in_20s_15" class="op-input js-calc-trigger" data-time="15" placeholder="0">
                        </div>
                    </div>
                </div>

                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div class="text-sm font-bold text-purple-600 mb-3 flex items-center gap-2">
                        <span class="w-2 h-4 bg-purple-500 rounded-full"></span> 19:00 の数値
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="op-input-group">
                            <label>目標稼働</label>
                            <input type="number" id="in_target_19" class="op-input" placeholder="目標">
                        </div>
                        <div class="op-input-group">
                            <label class="text-indigo-600 font-bold">実際稼働</label>
                            <input type="number" id="in_today_target_19" class="op-input border-indigo-200 focus:border-indigo-500" placeholder="実績入力">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="op-input-group">
                            <label class="text-blue-500">4円パチンコ</label>
                            <input type="number" id="in_4p_19" class="op-input js-calc-trigger" data-time="19" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-yellow-600">1円パチンコ</label>
                            <input type="number" id="in_1p_19" class="op-input js-calc-trigger" data-time="19" placeholder="0">
                        </div>
                        <div class="op-input-group">
                            <label class="text-emerald-600">20円スロット</label>
                            <input type="number" id="in_20s_19" class="op-input js-calc-trigger" data-time="19" placeholder="0">
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 flex gap-3">
                <button id="btn-cancel-op-input" class="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">キャンセル</button>
                <button id="btn-save-op-data" class="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700">保存する</button>
            </div>
        </div>
    </div>

    <div id="calendar-modal" class="modal-overlay hidden">
        <div class="modal-content p-6 w-full max-w-4xl h-[85vh] flex flex-col">
            <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span class="text-2xl">📅</span> 12月 月間稼働推移
                </h3>
                <button id="btn-close-calendar" class="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <div id="calendar-grid-body" class="flex-1 overflow-y-auto pr-1">
                </div>
        </div>
    </div>

    <div id="qscModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"><div class="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0"><div class="flex items-center gap-2"><h3 class="font-bold text-xl text-slate-800">QSC チェックリスト</h3><div class="flex bg-slate-100 p-1 rounded-lg"><button id="qscTabUnfinished" class="px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm">未実施</button><button id="qscTabFinished" class="px-3 py-1 text-xs font-bold rounded-md text-slate-400">完了済</button></div></div><div class="flex items-center gap-2"><button id="qscEditButton" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition">⚙️ 管理</button><button id="closeQscModal" class="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div></div><div class="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6"><div id="qscAddForm" class="hidden mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100"><h4 class="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-widest">新規項目</h4><div class="flex flex-col gap-2"><div class="grid grid-cols-3 gap-2"><input type="number" id="newQscNo" placeholder="No." class="border border-slate-200 rounded p-2 text-sm" min="1"><input type="text" id="newQscArea" placeholder="エリア" class="col-span-2 border border-slate-200 rounded p-2 text-sm"></div><input type="text" id="newQscContent" placeholder="内容" class="border border-slate-200 rounded p-2 text-sm"><div class="flex gap-2"><input type="file" id="newQscImage" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white file:text-indigo-600 hover:file:bg-indigo-50"><button id="btn-add-qsc-item" class="bg-indigo-600 text-white font-bold text-sm py-2 px-6 rounded-lg whitespace-nowrap">追加</button></div></div></div><div id="qscListContainer" class="space-y-3"></div></div><div class="p-3 bg-white border-t border-slate-100 text-center"><p class="text-xs text-slate-400 font-bold">チェックを入れると全員に反映されます</p></div></div></div>
    <div id="newOpeningModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"><div class="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0"><h3 class="font-bold text-xl text-slate-800">導入機種リスト</h3><button id="closeNewOpeningModal" class="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div id="newOpeningInfo" class="p-5 overflow-y-auto bg-slate-50/50"></div></div></div>
    <div id="machineDetailModal" class="modal-overlay hidden"><div class="modal-content w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"><div class="bg-slate-800 p-6 sm:p-8 flex justify-between items-start shrink-0"><h3 id="detailName" class="text-xl sm:text-2xl font-bold text-white leading-tight pr-4"></h3><button id="closeDetailModal" class="text-slate-400 hover:text-white"><svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div class="p-6 sm:p-8 overflow-y-auto"><div class="mb-8 bg-slate-50 rounded-2xl p-6 border border-slate-200 relative overflow-hidden"><div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div><h4 class="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">SALES POINT</h4><p id="detailPitch" class="text-slate-700 text-base sm:text-lg font-medium leading-loose whitespace-pre-line"></p></div><div class="grid sm:grid-cols-2 gap-6"><div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100"><div class="flex items-center gap-2 mb-3 text-emerald-700 font-bold">GOOD</div><ul id="detailPros" class="space-y-2 text-sm font-bold text-emerald-800"></ul></div><div class="bg-rose-50 p-5 rounded-2xl border border-rose-100"><div class="flex items-center gap-2 mb-3 text-rose-700 font-bold">BAD</div><ul id="detailCons" class="space-y-2 text-sm font-bold text-rose-800"></ul></div></div></div></div></div>

    <div id="password-modal" class="modal-overlay hidden" style="z-index: 200;"><div class="modal-content p-8 text-center"><h3 class="text-xl font-bold text-slate-800 mb-2">管理者認証</h3><p class="text-sm text-slate-500 mb-6">パスワードを入力してください。</p><input id="password-input" type="password" class="w-full p-3 border border-slate-200 rounded-lg mb-4 bg-slate-50 text-center font-bold focus:border-indigo-500 focus:outline-none" placeholder="Password"><p id="password-error" class="text-rose-500 text-xs font-bold mb-4 hidden">パスワードが違います</p><div class="flex gap-3 justify-center"><button id="btn-cancel-password" class="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">キャンセル</button><button id="btn-check-password" class="px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">認証</button></div></div></div>

    <div id="select-modal" class="select-modal-overlay hidden">
        <div class="select-modal-content flex flex-col max-h-[85vh]">
            <div class="p-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                <span class="font-black text-slate-700 text-lg" id="select-modal-title">選択</span>
                <button id="btn-close-select-modal-top" class="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div id="select-modal-body" class="select-modal-body flex-1 overflow-y-auto bg-slate-50 p-2"></div>
            <div class="select-modal-footer shrink-0">
                <button id="btn-close-select-modal-bottom" class="text-sm font-bold text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100">キャンセル</button>
                <button id="select-confirm-btn" class="confirm-btn" disabled>決定する</button>
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
                        <button data-action="bulk-delete" data-type="bulk_tasks" data-shift="open" class="btn-delete-task">タスクのみクリア</button>
                        <button data-action="bulk-delete" data-type="bulk_staff" data-shift="open" class="btn-delete-staff">人員ごと削除</button>
                    </div>
                </div>
                <div class="delete-menu-section">
                    <div class="delete-menu-title"><span class="w-2 h-2 rounded-full bg-purple-500"></span> 🌙 遅番 (閉店)</div>
                    <div class="delete-menu-buttons">
                        <button data-action="bulk-delete" data-type="bulk_tasks" data-shift="close" class="btn-delete-task">タスクのみクリア</button>
                        <button data-action="bulk-delete" data-type="bulk_staff" data-shift="close" class="btn-delete-staff">人員ごと削除</button>
                    </div>
                </div>
            </div>
            <div class="mt-8 border-t border-slate-100 pt-6">
                 <button data-action="bulk-delete" data-type="reset_all" data-shift="all" class="btn-reset-all">
                    ⚠️ 1日分をすべて完全削除
                </button>
            </div>
            <button id="btn-close-bulk-delete" class="w-full mt-4 py-3 text-slate-400 font-bold hover:text-slate-600">キャンセル</button>
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
                <button id="btn-cancel-delete" class="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100">キャンセル</button>
                <button id="btn-confirm-delete" class="px-6 py-2.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200">削除する</button>
            </div>
        </div>
    </div>

    <div id="remarks-modal" class="modal-overlay hidden"><div class="modal-content p-6"><h3 class="text-lg font-bold text-slate-800 mb-1" id="remarks-modal-task"></h3><p class="text-xs font-bold text-slate-400 mb-4" id="remarks-modal-time"></p><div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 text-sm font-medium leading-relaxed mb-6" id="remarks-modal-text"></div><button id="close-remarks-modal-btn" class="w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">閉じる</button></div></div>
    `;
}
