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
            <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
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
                <div class="flex gap-2 items-center shrink-0 ml-2">
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