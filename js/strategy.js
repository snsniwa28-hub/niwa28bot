import { db, app } from './firebase.js';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal } from './ui.js';
import { parseFile } from './file_parser.js';

// --- State ---
let strategies = [];
let editingId = null; // nullなら新規作成
let currentCategory = 'all'; // 'all', 'pachinko', 'slot', 'cs', 'strategy'
let isStrategyAdmin = false;
let isKnowledgeMode = false;
let tempPdfImages = []; // Stores images converted from PDF

// --- Firestore Operations ---
export async function loadStrategies() {
    const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStrategyList();
}

// Function to trigger global summary update
async function updateCategorySummary(category) {
    if (!category || category === 'all') return; // Cannot summarize 'all', must be specific

    try {
        showToast("AIが全体サマリーを更新中...", 5000);

        // 1. Fetch ALL valid strategies for this category
        // Valid = No Date (Timeless) OR Future Date (Today+)
        const todayStr = new Date().toISOString().split('T')[0];
        const q = query(collection(db, "strategies"), where("category", "==", category));
        const snapshot = await getDocs(q);

        const validDocs = snapshot.docs.map(d => d.data()).filter(d => {
            // Filter out old dates
            if (d.relevant_date && d.relevant_date < todayStr) return false;
            return true;
        });

        if (validDocs.length === 0) {
            // Clear summary if no docs
             await setDoc(doc(db, "category_summaries", category), {
                short: "現在、共有されている情報はありません。",
                full: "現在、共有されている情報はありません。",
                updatedAt: serverTimestamp()
            });
            return;
        }

        // 2. Aggregate Data
        let aggregatedContext = "";
        let aggregatedImages = [];

        validDocs.forEach(d => {
            aggregatedContext += `\n--- [${d.title}] (${d.relevant_date || "日付なし"}) ---\n`;
            if (d.ai_context) aggregatedContext += d.ai_context + "\n";
            if (d.text_content) aggregatedContext += d.text_content + "\n"; // Manual text

            // Limit images to avoid payload limits (e.g., take 1 from each doc, max 10 total)
            if (d.ai_images && d.ai_images.length > 0) {
                 if (aggregatedImages.length < 10) {
                     aggregatedImages.push(d.ai_images[0]);
                 }
            }
        });

        // 3. Call Gemini
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
            const summaryData = JSON.parse(cleanJson);

            // 4. Save to Firestore
            await setDoc(doc(db, "category_summaries", category), {
                short: summaryData.short || "",
                full: summaryData.full || "",
                updatedAt: serverTimestamp()
            });
            showToast("全体サマリー更新完了！");
        }

    } catch (e) {
        console.error("Summary Update Failed:", e);
        // Don't block the UI, just log it
    }
}

export async function saveStrategy() {
    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');
    const textInput = document.getElementById('strategy-editor-text'); // Manual text
    const aiContextInput = document.getElementById('strategy-ai-context'); // Hidden buffer

    // Default to 'strategy' if select is missing (fallback)
    const category = categorySelect ? categorySelect.value : 'strategy';
    const type = 'article';

    if (!titleInput.value.trim()) return alert("タイトルを入力してください");

    let data = {
        title: titleInput.value,
        category: category,
        type: type,
        updatedAt: serverTimestamp(),
        author: "Admin",
        isKnowledge: true // Always true
    };

    // Text Content
    if (textInput && textInput.value.trim()) {
        data.text_content = textInput.value;
    }

    // AI Context (File content)
    if (aiContextInput && aiContextInput.value.trim()) {
        data.ai_context = aiContextInput.value;
    }

    // Images (PDF converted or otherwise)
    if (tempPdfImages.length > 0) {
        data.ai_images = tempPdfImages.slice(0, 10);
    }

    // Validation
    const hasContent = data.text_content || data.ai_context;
    if (!hasContent) return alert("テキストを入力するか、資料をアップロードしてください");

    // --- AI Analysis for Single Doc (Optional, but good for metadata) ---
    try {
        showToast("保存中...", 2000);

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
                let cleanJson = resData.reply.replace(/```json/g, '').replace(/```/g, '').trim();
                const analysis = JSON.parse(cleanJson);
                if (analysis) {
                    data.relevant_date = analysis.relevant_date || null;
                }
             } catch(e) {}
        }

        const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
        await setDoc(docRef, data, { merge: true });

        // --- Trigger Global Summary Update ---
        await updateCategorySummary(category);

        closeStrategyEditor();
        loadStrategies();
    } catch (e) {
        console.error(e);
        alert("保存エラー: " + e.message);
    }
}

export async function deleteStrategy(id) {
    showConfirmModal("削除確認", "この記事を削除しますか？", async () => {
        // Get category before deleting to update summary
        const item = strategies.find(s => s.id === id);
        const category = item ? item.category : null;

        await deleteDoc(doc(db, "strategies", id));
        showToast("削除しました");

        if (category) {
            await updateCategorySummary(category);
        }

        loadStrategies();
    });
}

// --- UI Rendering (Viewer) ---
export function setStrategyCategory(category) {
    isKnowledgeMode = false;
    currentCategory = category;
    renderStrategyList();
    updateHeaderUI();
}

export function toggleKnowledgeList() {
    isKnowledgeMode = !isKnowledgeMode;
    renderStrategyList();
    updateHeaderUI();
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
        const config = {
            'pachinko': { title: 'パチンコ共有', icon: '🅿️', color: 'text-pink-600', bg: 'bg-pink-50' },
            'slot': { title: 'スロット共有', icon: '🎰', color: 'text-purple-600', bg: 'bg-purple-50' },
            'cs': { title: 'CSチーム共有', icon: '🤝', color: 'text-orange-600', bg: 'bg-orange-50' },
            'strategy': { title: '月間戦略', icon: '📈', color: 'text-red-600', bg: 'bg-red-50' },
            'all': { title: '社内共有・戦略', icon: '📋', color: 'text-slate-800', bg: 'bg-slate-50' }
        };

        const c = config[currentCategory] || config['all'];

        if(titleEl) {
            titleEl.textContent = c.title;
            titleEl.className = `font-black text-lg ${c.color}`;
        }
        if(iconEl) iconEl.textContent = c.icon;

        if(knowledgeBtn) {
            knowledgeBtn.classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
            knowledgeBtn.classList.add('bg-white', 'text-slate-500');
        }
    }

    // AI Button Logic
    if (aiBtn) {
        aiBtn.onclick = () => window.toggleAIChat(currentCategory, isKnowledgeMode ? "知識ベース" : (currentCategory === 'all' ? '社内資料' : currentCategory));
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

    const filtered = strategies.filter(s => {
        if (!currentCategory || currentCategory === 'all') {
             if (isKnowledgeMode) return s.isKnowledge === true;
             return true;
        }
        const cat = s.category || 'strategy';
        const isCatMatch = cat === currentCategory;
        if (isKnowledgeMode) {
            return s.isKnowledge === true && isCatMatch;
        }
        return isCatMatch;
    });

    if (filtered.length === 0) {
        const msg = isKnowledgeMode ? "登録された知識データはありません" : "まだ記事がありません";
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50">
            <span class="text-4xl mb-2">📭</span>
            <p class="text-sm font-bold text-slate-400">${msg}</p>
        </div>`;
        return;
    }

    filtered.forEach(item => {
        const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-4 transition hover:shadow-xl animate-fade-in";
        const showControls = isStrategyAdmin || isKnowledgeMode;

        // Simplified Card for Management
        let html = `
            <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div class="flex items-center gap-3">
                     <span class="text-2xl">${item.relevant_date ? '📅' : '📌'}</span>
                     <div>
                        <h2 class="text-base font-black text-slate-800 leading-tight">${item.title}</h2>
                        <span class="text-[10px] font-bold text-slate-400">
                             ${item.relevant_date ? item.relevant_date : '日付指定なし'} | 更新: ${date}
                        </span>
                     </div>
                </div>
                ${showControls ? `
                <div class="flex gap-2 items-center">
                     <button class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-100 shadow-sm border border-indigo-100 transition" onclick="window.openStrategyEditor('${item.id}')">✏️ 編集</button>
                     <button class="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-100 shadow-sm border border-rose-100 transition" onclick="window.deleteStrategy('${item.id}')">🗑️ 削除</button>
                </div>
                ` : ''}
            </div>
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

    // Inject New Simplified Form
    editorContainer.innerHTML = `
        <div class="space-y-6">
            <!-- Category Selection -->
            <div>
                 <label class="block text-xs font-bold text-slate-400 mb-1">カテゴリー</label>
                 <select id="strategy-editor-category" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="pachinko">🅿️ パチンコ共有</option>
                    <option value="slot">🎰 スロット共有</option>
                    <option value="cs">🤝 CSチーム共有</option>
                    <option value="strategy">📈 月間戦略</option>
                 </select>
            </div>

            <!-- Manual Text Input -->
             <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">テキスト入力 (任意)</label>
                <textarea id="strategy-editor-text" class="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none" placeholder="伝えたい内容をここに入力..."></textarea>
            </div>

            <!-- File Upload -->
            <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label class="block text-xs font-bold text-indigo-600 mb-2">📂 資料アップロード (PDF / Excel / 画像)</label>
                <div class="flex gap-2 items-center mb-2">
                    <label class="cursor-pointer bg-white text-indigo-600 px-4 py-3 rounded-xl text-sm font-bold border border-indigo-200 hover:bg-indigo-50 transition shadow-sm flex items-center gap-2 w-full justify-center">
                        <span>📄 ファイルを選択</span>
                        <input type="file" accept=".pdf, .xlsx, .xls, image/*" class="hidden" onchange="window.handleContextFileUpload(this)">
                    </label>
                </div>
                <div id="file-status" class="text-xs text-slate-500 font-bold text-center h-5"></div>
            </div>

            <!-- Hidden Buffer for Extracted Text -->
            <textarea id="strategy-ai-context" class="hidden"></textarea>
        </div>
    `;

    // Initialize Values
    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');
    const textInput = document.getElementById('strategy-editor-text');
    const aiContextInput = document.getElementById('strategy-ai-context');
    const fileStatus = document.getElementById('file-status');

    tempPdfImages = [];

    // Handle Category Locking
    if (currentCategory && currentCategory !== 'all' && !id) {
        categorySelect.value = currentCategory;
        categorySelect.disabled = true;
        categorySelect.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        categorySelect.disabled = false;
        categorySelect.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    if (id) {
        const item = strategies.find(s => s.id === id);
        if (item) {
            titleInput.value = item.title;
            categorySelect.value = item.category || 'strategy';
            categorySelect.disabled = false;
            categorySelect.classList.remove('opacity-50');

            if (item.text_content) textInput.value = item.text_content;
            if (item.ai_context) aiContextInput.value = item.ai_context;

            if (item.ai_images && item.ai_images.length > 0) {
                 tempPdfImages = item.ai_images;
                 fileStatus.textContent = `既存の画像データあり (${item.ai_images.length}枚)`;
            }
        }
    } else {
        titleInput.value = '';
        textInput.value = '';
        aiContextInput.value = '';
        fileStatus.textContent = '';
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
        tempPdfImages = []; // Clear previous images

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
            } else if (file.type.startsWith('image/')) {
                 statusText += ` (画像)`;
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

window.openInternalSharedModal = (category = 'strategy') => {
    isStrategyAdmin = false;
    setStrategyCategory(category);
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

export function openStrategyAdmin(category) {
    isStrategyAdmin = true;
    isKnowledgeMode = true; // Force Knowledge Mode for Admin View from Chat
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

// --- Initialize ---
export function initStrategy() {
    loadStrategies();
    const createBtn = document.getElementById('btn-create-strategy');
    if(createBtn) createBtn.onclick = () => openStrategyEditor();
    const createBtnMobile = document.getElementById('btn-create-strategy-mobile');
    if(createBtnMobile) createBtnMobile.onclick = () => openStrategyEditor();
}
