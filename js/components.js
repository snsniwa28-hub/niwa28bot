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
    <div class="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-4 sm:p-6 shadow-sm border border-blue-100 h-full">
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
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
    <div class="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-4 sm:p-6 shadow-sm border border-purple-100 h-full">
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
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

        <div class="p-4 sm:p-6 flex-1 space-y-6">
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
                <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku3.jpg" class="w-full sm:w-24 h-auto object-cover sm:object-contain rounded shadow-sm shrink-0" alt="Week 1-2">
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
                <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku4.jpg" class="w-full sm:w-24 h-auto object-cover sm:object-contain rounded shadow-sm shrink-0" alt="Week 3">
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
                <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <img src="senryaku5.jpg" class="w-full sm:w-24 h-auto object-cover sm:object-contain rounded shadow-sm shrink-0" alt="Week 4">
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

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6">
                 <div class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-4 bg-amber-500 rounded-full"></span> 注目機種管理
                    </div>
                    <button id="btn-add-machine-detail" class="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">+ 機種を追加</button>
                </div>
                <div id="machine-details-input-container" class="space-y-3">
                    <!-- Dynamic rows will be added here -->
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
2.js/strategy.js
このファイルでは、renderStrategyList 関数内のHTML生成部分を変更し、スマホ画面で一覧のテキストが横並びのボタンに圧迫されないよう、アイテムとボタンの配置を縦積み（flex-col sm:flex-row）に変更しました。

import { db, app } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal, showLoadingOverlay, hideLoadingOverlay, updateLoadingMessage } from './ui.js';
import { parseFile } from './file_parser.js';

// --- State ---
let strategies = [];
let editingId = null; // nullなら新規作成
// currentCategoryは「表示フィルタ」としては廃止するが、
// 以前のコードとの互換性や管理モード(isKnowledgeMode)の判定用に一応変数は残す（基本使わない）
let currentCategory = 'all';
let isStrategyAdmin = false;
let isKnowledgeMode = false;
let tempPdfImages = []; // Stores images converted from PDF
let knowledgeFilter = 'all'; // 知識モード用のフィルタ

// --- Firestore Operations ---
export async function loadStrategies() {
    // 常に全件取得（フィルタなし）
    const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStrategyList();
}

// Function to trigger global summary update
// 引数 category は互換性のために残すが、内部では無視して 'unified' を更新する
async function updateCategorySummary(category_ignored) {
    try {
        updateLoadingMessage("全チームの情報を統合中...");

        // 1. Fetch ALL valid strategies (直近50件)
        const todayStr = new Date().toISOString().split('T')[0];

        const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
        const snapshot = await getDocs(q);

        // 全データを対象とする（ゴミデータ除外程度）
        const validDocs = snapshot.docs.map(d => d.data()).filter(d => d.title);

        if (validDocs.length === 0) {
             await setDoc(doc(db, "category_summaries", "unified"), {
                short: "現在、共有されている情報はありません。",
                full: "現在、共有されている情報はありません。",
                updatedAt: serverTimestamp()
            });
            return;
        }

        // 2. Aggregate Data
        let aggregatedContext = "";
        let aggregatedImages = [];

        const categoryMap = {
            'pachinko': 'パチンコ',
            'slot': 'スロット',
            'strategy': '戦略'
        };

        validDocs.forEach(d => {
            const catName = categoryMap[d.category] || d.category || '未分類';
            aggregatedContext += `\n--- 【${catName}】${d.title} (${d.relevant_date || "日付なし"}) ---\n`;
            if (d.ai_context) aggregatedContext += d.ai_context + "\n";
            if (d.text_content) aggregatedContext += d.text_content + "\n";

            if (d.ai_images && d.ai_images.length > 0) {
                 if (aggregatedImages.length < 10) {
                     aggregatedImages.push(d.ai_images[0]);
                 }
            }
        });

        updateLoadingMessage("AIが全体サマリーを執筆中...");

        // 3. Call Gemini (常に unified モード)
        const payload = {
            contextData: aggregatedContext,
            contextImages: aggregatedImages,
            mode: 'update_category_summary',
            currentDate: todayStr
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (resData.reply) {
            let cleanJson = resData.reply.replace(/```json/g, '').replace(/```/g, '').trim();
            let summaryData = {};
            try {
                summaryData = JSON.parse(cleanJson);
            } catch (e) {
                summaryData = { short: resData.reply, full: resData.reply };
            }

            // 4. Save to Firestore (常に unified)
            await setDoc(doc(db, "category_summaries", "unified"), {
                short: summaryData.short || "",
                full: summaryData.full || "",
                updatedAt: serverTimestamp()
            });
        }

    } catch (e) {
        console.error("Summary Update Failed:", e);
        showToast("サマリー更新に失敗しました");
    }
}

export async function saveStrategy() {
    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');
    const textInput = document.getElementById('strategy-editor-text');
    const aiContextInput = document.getElementById('strategy-ai-context');

    const category = categorySelect ? categorySelect.value : '';
    const type = 'article';

    // --- 【変更点】カテゴリ必須チェック ---
    if (!category) {
        alert("【必須】共有するチーム（カテゴリ）を選択してください。");
        categorySelect.focus();
        return; // 保存中断
    }

    // Auto-generate title if empty
    let titleVal = titleInput.value.trim();
    const catMap = { 'pachinko': 'パチンコ', 'slot': 'スロット', 'strategy': '戦略' };

    if (!titleVal) {
        titleVal = `【${catMap[category] || category}】共有事項`;
    }

    let data = {
        title: titleVal,
        category: category,
        type: type,
        updatedAt: serverTimestamp(),
        author: "Admin",
        isKnowledge: true
    };

    if (textInput && textInput.value.trim()) data.text_content = textInput.value;
    if (aiContextInput && aiContextInput.value.trim()) data.ai_context = aiContextInput.value;
    if (tempPdfImages.length > 0) data.ai_images = tempPdfImages.slice(0, 10);

    const hasContent = data.text_content || data.ai_context;
    if (!hasContent) return alert("テキストを入力するか、資料をアップロードしてください");

    // --- Loading Start ---
    showLoadingOverlay("データ処理を開始します...");

    try {
        updateLoadingMessage("個別の資料を分析中...");

        // Simple analysis to get date
        const fullText = (data.text_content || "") + "\n" + (data.ai_context || "");

        const payload = {
            prompt: data.title,
            contextData: fullText,
            contextImages: data.ai_images || [],
            mode: 'analyze_strategy'
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.reply) {
             try {
                let cleanJson = resData.reply.trim();
                if (cleanJson.startsWith('```')) {
                    cleanJson = cleanJson.replace(/^```(json)?/, '').replace(/```$/, '').trim();
                }
                const jsonStart = cleanJson.indexOf('{');
                const jsonEnd = cleanJson.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
                }

                const analysis = JSON.parse(cleanJson);
                if (analysis) {
                    data.relevant_date = analysis.relevant_date || null;
                    data.ai_summary = analysis.ai_summary || "要約なし";
                    if(analysis.ai_details) data.ai_details = analysis.ai_details;
                }
             } catch(e) {
                 console.warn("JSON Parse Failed", e);
                 data.ai_summary = resData.reply.substring(0, 100) + "...";
                 data.ai_details = resData.reply;
                 data.relevant_date = null;
             }
        } else {
            data.ai_summary = "AI解析応答なし";
        }

        const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
        await setDoc(docRef, data, { merge: true });

        // --- Trigger Global Summary Update (Always Unified) ---
        await updateCategorySummary('unified');

        hideLoadingOverlay();
        closeStrategyEditor();
        loadStrategies();
    } catch (e) {
        console.error(e);
        hideLoadingOverlay();
        alert("保存エラー: " + e.message);
    }
}

export async function deleteStrategy(id) {
    showConfirmModal("削除確認", "この記事を削除しますか？", async () => {
        await deleteDoc(doc(db, "strategies", id));
        showToast("削除しました");
        // カテゴリに関わらず全体サマリーを更新
        await updateCategorySummary('unified');
        loadStrategies();
    });
}

// --- UI Rendering (Viewer) ---
export function setStrategyCategory(category) {
    // カテゴリ変数は残すが、表示ロジックでは無視（全表示）する
    isKnowledgeMode = false;
    currentCategory = category;
    renderStrategyList();
    updateHeaderUI();
}

export function toggleKnowledgeList() {
    isKnowledgeMode = !isKnowledgeMode;
    if(isKnowledgeMode) knowledgeFilter = 'all';
    renderStrategyList();
    updateHeaderUI();
}

export function setKnowledgeFilter(filter) {
    knowledgeFilter = filter;
    renderStrategyList();
    updateKnowledgeFilterUI();
}

function updateKnowledgeFilterUI() {
    const filters = ['all', 'pachinko', 'slot', 'strategy'];
    filters.forEach(f => {
        const btn = document.getElementById(`k-filter-${f}`);
        if(btn) {
            if(f === knowledgeFilter) {
                btn.className = "px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition";
            } else {
                btn.className = "px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition";
            }
        }
    });
}

function updateHeaderUI() {
    const header = document.querySelector('#internalSharedModal .modal-content > div:first-child');
    const titleEl = document.querySelector('#internalSharedModal h3');
    const iconEl = document.querySelector('#internalSharedModal span.text-2xl');
    const createBtn = document.getElementById('btn-create-strategy');
    const createBtnMobile = document.getElementById('btn-create-strategy-mobile');
    const aiBtn = document.getElementById('btn-category-ai');
    const knowledgeBtn = document.getElementById('btn-knowledge-list');

    if (header) header.className = "p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-10 shadow-sm bg-white";

    if (isKnowledgeMode) {
        if(titleEl) {
            titleEl.textContent = "🧠 知識データベース（管理）";
            titleEl.className = "font-black text-lg text-slate-800";
        }
        if(iconEl) iconEl.textContent = "📚";
        if(knowledgeBtn) {
            knowledgeBtn.classList.add('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
            knowledgeBtn.classList.remove('bg-white', 'text-slate-500');
        }
    } else {
        // --- 【変更点】統合ビューのタイトル固定 ---
        if(titleEl) {
            titleEl.textContent = "社内共有・戦略（全体）";
            titleEl.className = "font-black text-lg text-slate-800";
        }
        if(iconEl) iconEl.textContent = "📋";

        if(knowledgeBtn) {
            knowledgeBtn.classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
            knowledgeBtn.classList.add('bg-white', 'text-slate-500');
        }
    }

    // AI Button Logic - Always Unified
    if (aiBtn) {
        aiBtn.onclick = () => {
            // 常に全体サマリーを開く
            window.toggleAIChat('unified', '社内共有・戦略（全体）');
        };
    }

    if(createBtn) {
        if (isStrategyAdmin) {
            createBtn.classList.remove('hidden');
            createBtn.classList.add('inline-flex');
        } else {
            createBtn.classList.add('hidden');
            createBtn.classList.remove('inline-flex');
        }
    }
    if(createBtnMobile) {
        if (isStrategyAdmin) {
            createBtnMobile.classList.remove('hidden');
        } else {
            createBtnMobile.classList.add('hidden');
        }
    }
}

function renderStrategyList() {
    const container = document.getElementById('strategy-list-container');
    if (!container) return;
    container.innerHTML = '';

    // Knowledge Mode Filter
    if (isKnowledgeMode) {
        const filterBar = document.createElement('div');
        filterBar.className = "flex justify-center gap-2 mb-6";
        filterBar.innerHTML = `
            <button id="k-filter-all" data-action="filter-knowledge" data-filter="all">全て</button>
            <button id="k-filter-pachinko" data-action="filter-knowledge" data-filter="pachinko">パチンコ</button>
            <button id="k-filter-slot" data-action="filter-knowledge" data-filter="slot">スロット</button>
            <button id="k-filter-strategy" data-action="filter-knowledge" data-filter="strategy">戦略</button>
        `;
        container.appendChild(filterBar);
        setTimeout(updateKnowledgeFilterUI, 0);
    }

    const filtered = strategies.filter(s => {
        // Knowledge Modeではフィルタに従う
        if (isKnowledgeMode) {
            if (s.isKnowledge !== true) return false;
            if (knowledgeFilter === 'all') return true;
            return s.category === knowledgeFilter;
        }
        // --- 【変更点】通常モードは全件表示（フィルタなし） ---
        return true;
    });

    if (filtered.length === 0) {
        const msg = isKnowledgeMode ? "登録された知識データはありません" : "まだ記事がありません";
        const emptyDiv = document.createElement('div');
        emptyDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50">
            <span class="text-4xl mb-2">📭</span>
            <p class="text-sm font-bold text-slate-400">${msg}</p>
        </div>`;
        container.appendChild(emptyDiv);
        return;
    }

    filtered.forEach(item => {
        const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-4 transition hover:shadow-xl animate-fade-in";
        const showControls = isStrategyAdmin || isKnowledgeMode;

        const aiStatus = item.ai_summary
            ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">✅ AI把握済</span>'
            : '<span class="text-[10px] bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full border border-yellow-200">⚠️ 未解析</span>';

        // --- 【変更点】バッジ表示の強化（常時表示） ---
        const teamMap = { 'pachinko': 'パチンコ', 'slot': 'スロット', 'strategy': '戦略' };
        const teamName = teamMap[item.category] || item.category || '未分類';

        // カテゴリごとの色分け
        let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
        if (item.category === 'pachinko') badgeColor = "bg-pink-50 text-pink-600 border-pink-100";
        if (item.category === 'slot') badgeColor = "bg-purple-50 text-purple-600 border-purple-100";
        if (item.category === 'strategy') badgeColor = "bg-red-50 text-red-600 border-red-100";

        const categoryBadge = `<span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded-full border font-bold mr-2 align-middle">${teamName}</span>`;

        let html = `
            <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <div class="flex items-center gap-3 w-full overflow-hidden">
                     <span class="text-2xl shrink-0">${item.relevant_date ? '📅' : '📌'}</span>
                     <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            ${categoryBadge}
                            <h2 class="text-base font-black text-slate-800 leading-tight truncate">${item.title}</h2>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-400 shrink-0">
                                ${item.relevant_date ? item.relevant_date : '日付なし'} | 更新: ${date}
                            </span>
                            ${aiStatus}
                        </div>
                     </div>
                </div>
                ${showControls ? `
                <div class="flex gap-2 items-center shrink-0 w-full sm:w-auto justify-end sm:justify-start sm:ml-2">
                     <button class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-100 shadow-sm border border-indigo-100 transition" data-action="edit-strategy" data-id="${item.id}">✏️</button>
                     <button class="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-100 shadow-sm border border-rose-100 transition" data-action="delete-strategy" data-id="${item.id}">🗑️</button>
                </div>
                ` : ''}
            </div>
            ${item.ai_summary && item.ai_summary !== 'AI解析応答なし' ? `
            <div class="p-4 text-xs text-slate-600 bg-white leading-relaxed border-t border-slate-50">
                <span class="font-bold text-indigo-500">AI要約:</span> ${item.ai_summary.substring(0, 80)}...
            </div>
            ` : ''}
        `;
        card.innerHTML = html;
        container.appendChild(card);
    });
}

// --- UI Rendering (Editor) ---
export function openStrategyEditor(id = null) {
    editingId = id;
    const modal = document.getElementById('strategy-editor-modal');
    modal.classList.remove('hidden');

    const editorContainer = document.getElementById('strategy-article-editor');
    editorContainer.innerHTML = '';

    // --- 【変更点】カテゴリ選択の初期値を空（未選択）にし、必須化 ---
    editorContainer.innerHTML = `
        <div class="space-y-6">
            <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                 <label class="block text-xs font-bold text-indigo-600 mb-2">共有するチームを選択 <span class="text-rose-500">(必須)</span></label>
                 <select id="strategy-editor-category" class="w-full bg-white border border-indigo-200 rounded-lg px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
                    <option value="" disabled selected>▼ チームを選択してください</option>
                    <option value="pachinko">🅿️ パチンコチーム</option>
                    <option value="slot">🎰 スロットチーム</option>
                    <option value="strategy">📈 戦略チーム</option>
                 </select>
            </div>

             <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">件名 (省略可)</label>
                <input type="text" id="strategy-editor-title" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 mb-2" placeholder="未入力時は[チーム名]共有事項になります">

                <label class="block text-xs font-bold text-slate-400 mb-1">テキスト入力 (任意)</label>
                <textarea id="strategy-editor-text" class="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none" placeholder="伝えたい内容をここに入力..."></textarea>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label class="block text-xs font-bold text-slate-500 mb-2">📂 資料アップロード (PDF / Excel / 画像 / テキスト)</label>
                <div class="flex gap-2 items-center mb-2">
                    <label class="cursor-pointer bg-white text-slate-600 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-100 transition shadow-sm flex items-center gap-2 w-full justify-center">
                        <span>📄 ファイルを選択</span>
                        <input type="file" id="strategy-context-file" accept=".pdf, .xlsx, .xls, .txt, .md, .csv, image/*" class="hidden">
                    </label>
                </div>
                <div id="file-status" class="text-xs text-slate-500 font-bold text-center h-5"></div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label class="block text-xs font-bold text-indigo-600 mb-2">AIによる要約結果</label>
                <textarea id="strategy-editor-ai-summary" class="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm font-medium text-slate-700 outline-none h-24 resize-none" readonly placeholder="AIによる要約がここに表示されます..."></textarea>
            </div>

            <textarea id="strategy-ai-context" class="hidden"></textarea>
        </div>
    `;

    // Initialize Values
    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');
    const textInput = document.getElementById('strategy-editor-text');
    const aiContextInput = document.getElementById('strategy-ai-context');
    const aiSummaryInput = document.getElementById('strategy-editor-ai-summary');
    const fileStatus = document.getElementById('file-status');

    tempPdfImages = [];

    // 編集時は既存の値をセット（もしあれば）
    if (id) {
        const item = strategies.find(s => s.id === id);
        if (item) {
            titleInput.value = item.title;
            // 既存データにカテゴリがない場合のケアは必須だが、基本はある前提
            categorySelect.value = item.category || '';

            if (item.text_content) textInput.value = item.text_content;
            if (item.ai_context) aiContextInput.value = item.ai_context;
            if (item.ai_summary) aiSummaryInput.value = item.ai_summary;

            if (item.ai_images && item.ai_images.length > 0) {
                 tempPdfImages = item.ai_images;
                 fileStatus.textContent = `既存の画像データあり (${item.ai_images.length}枚)`;
            }
        }
    } else {
        // 新規作成時は空（HTML側で設定済み）
    }
}

export function closeStrategyEditor() {
    document.getElementById('strategy-editor-modal').classList.add('hidden');
}

// --- Global Handlers ---
window.handleContextFileUpload = async (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const statusEl = document.getElementById('file-status');
        const textarea = document.getElementById('strategy-ai-context');

        if(statusEl) statusEl.textContent = '読み込み中...';
        tempPdfImages = [];

        try {
            const { text, images, pageCount } = await parseFile(file);

            if(textarea) {
                textarea.value = text;
            }

            tempPdfImages = images || [];

            let statusText = '✅ 読み込み完了: ' + file.name;
            if (file.name.toLowerCase().endsWith('.pdf')) {
                statusText += ` (${pageCount}ページ, 画像${tempPdfImages.length}枚)`;
            } else if (file.name.match(/\.(xlsx|xls)$/i)) {
                 statusText += ` (Excel)`;
            } else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                 statusText += ` (画像)`;
            } else {
                 statusText += ` (テキスト)`;
            }
            if(statusEl) statusEl.textContent = statusText;

        } catch (e) {
            console.error(e);
            alert("ファイルの読み込みに失敗しました: " + e.message);
            if(statusEl) statusEl.textContent = 'エラー';
        }
    }
};

window.openStrategyEditor = openStrategyEditor;
window.closeStrategyEditor = closeStrategyEditor;
window.saveStrategy = saveStrategy;
window.deleteStrategy = deleteStrategy;
window.toggleKnowledgeList = toggleKnowledgeList;
window.setKnowledgeFilter = setKnowledgeFilter;
window.openStrategyAdmin = openStrategyAdmin;

window.openInternalSharedModal = (category = 'unified') => {
    isStrategyAdmin = false;
    // 常に統一カテゴリとして開く
    setStrategyCategory('unified');
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

export function openStrategyAdmin(category) {
    isStrategyAdmin = true;
    isKnowledgeMode = true;
    setStrategyCategory(category);
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function openStrategyAdminAuth(category) {
    showPasswordModal(() => openStrategyAdmin(category));
}

// 日次更新チェックも常に unified をターゲットにする
export async function checkAndTriggerDailyUpdate() {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const docRef = doc(db, "category_summaries", "unified");
        const docSnap = await getDoc(docRef);

        let needsUpdate = false;

        if (!docSnap.exists()) {
            needsUpdate = true;
        } else {
            const data = docSnap.data();
            if (!data.updatedAt) {
                needsUpdate = true;
            } else {
                const updatedTime = data.updatedAt.toDate().getTime();
                const todayStart = new Date().setHours(0,0,0,0);
                if (updatedTime < todayStart) {
                    needsUpdate = true;
                }
            }
            if (data.short === "現在、共有されている情報はありません。") {
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            const overlay = document.createElement('div');
            overlay.id = "daily-update-overlay";
            overlay.className = "fixed inset-0 z-[9999] bg-slate-100 flex flex-col items-center justify-center transition-opacity duration-500";
            overlay.innerHTML = `
                <div class="text-center animate-fade-in p-8">
                    <div class="inline-block relative mb-6">
                        <span class="text-6xl animate-bounce inline-block">🌅</span>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 mb-2">おはようございます</h2>
                    <p class="text-sm font-bold text-slate-500 mb-6">本日の全体情報を準備中...</p>

                    <div class="w-64 h-2 bg-slate-200 rounded-full overflow-hidden mx-auto mb-2">
                        <div class="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 animate-pulse w-full"></div>
                    </div>
                    <p class="text-[10px] text-slate-400 font-bold">1日1回のみ実行されます</p>
                </div>
            `;
            document.body.appendChild(overlay);

            // Execute Update (Unified)
            await updateCategorySummary('unified');

            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 500);
        }

    } catch (e) {
        console.error("Daily Check Error:", e);
        const el = document.getElementById("daily-update-overlay");
        if (el) el.remove();
    }
}

// --- Initialize ---
export function initStrategy() {
    loadStrategies();
    const createBtn = document.getElementById('btn-create-strategy');
    if(createBtn) createBtn.onclick = () => openStrategyEditor();
    const createBtnMobile = document.getElementById('btn-create-strategy-mobile');
    if(createBtnMobile) createBtnMobile.onclick = () => openStrategyEditor();
}
