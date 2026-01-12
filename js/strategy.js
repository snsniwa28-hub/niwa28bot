import { db, app } from './firebase.js';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal } from './ui.js';
import { parseFile } from './file_parser.js';

// --- State ---
let strategies = [];
let editingId = null; // nullなら新規作成
let currentCategory = 'all'; // 'all', 'pachinko', 'slot', 'cs', 'strategy'
let isStrategyAdmin = false;
let isKnowledgeMode = false;
let tempPdfImages = []; // Stores images converted from PDF

// --- Image Compression Logic (800px width, 60% quality) ---
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;

                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 圧縮率0.6 (JPEG)
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- Firestore Operations ---
export async function loadStrategies() {
    const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStrategyList();
}

export async function saveStrategy() {
    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');

    // Default to 'strategy' if select is missing (fallback)
    const category = categorySelect ? categorySelect.value : 'strategy';
    const type = 'article'; // Always article type now

    if (!titleInput.value.trim()) return alert("タイトルを入力してください");

    let data = {
        title: titleInput.value,
        category: category,
        type: type,
        updatedAt: serverTimestamp(),
        author: "Admin",
        isKnowledge: true // Always treat as Knowledge (Long-term memory)
    };

    // AI Context
    const aiContextInput = document.getElementById('strategy-ai-context');
    if (aiContextInput) {
        data.ai_context = aiContextInput.value;
    }

    // Block Data Collection & Image Gathering
    const blocksData = [];
    const blockElements = document.querySelectorAll('.strategy-block-item');
    const blockImages = [];

    blockElements.forEach(el => {
        const type = el.dataset.type;
        const importance = el.querySelector('.importance-select').value;
        const text = el.querySelector('.block-text').value;
        const imgPreview = el.querySelector('.block-img-preview');
        const image = (imgPreview && !imgPreview.classList.contains('hidden')) ? imgPreview.src : null;

        if (image) {
            blockImages.push(image);
        }

        blocksData.push({ type, importance, text, image });
    });

    // Validation: Require Title + (Blocks OR File)
    const hasBlocks = blocksData.length > 0;
    const hasContextFile = tempPdfImages.length > 0 || (aiContextInput && aiContextInput.value.trim().length > 0);

    if (!hasBlocks && !hasContextFile) return alert("少なくとも1つのブロックを追加するか、資料(PDF/Excel)を読み込んでください");
    data.blocks = blocksData;

    // Combine PDF images and Block images for AI (Max 10)
    let aiImages = [...tempPdfImages, ...blockImages];
    if (aiImages.length > 10) {
        aiImages = aiImages.slice(0, 10);
    }
    data.ai_images = aiImages;

    // --- AI Analysis (Generate Chat Content) ---
    try {
        showToast("AIが資料を分析中...", 3000); // Temporary toast

        // Construct Text Context for AI
        let fullText = "";
        if (data.ai_context) {
            fullText += data.ai_context + "\n\n";
        }
        if (data.blocks) {
            fullText += data.blocks.map(b => b.text || "").join("\n");
        }

        // --- Context-Aware: Fetch Existing Active Strategies ---
        // Fetch active strategies (Today/Future or No Date) to provide context
        const todayStr = new Date().toISOString().split('T')[0];
        let existingContext = "";

        try {
            // Re-using the memory strategies array which is already loaded
            // Filtering similar to AI Chat logic
            const activeStrategiesList = strategies.filter(s => {
                // Skip self (if editing)
                if (editingId && s.id === editingId) return false;

                // Only same category or 'all'
                if (s.category && s.category !== 'all' && s.category !== category) return false;

                // Time filter
                if (!s.relevant_date) return true; // Timeless
                return s.relevant_date >= todayStr; // Future
            });

            if (activeStrategiesList.length > 0) {
                existingContext = "【現在の有効な社内状況(参考にしてください)】\n";
                activeStrategiesList.slice(0, 10).forEach(s => { // Limit to top 10 relevant
                    existingContext += `- ${s.title}: ${s.ai_summary || '詳細なし'}\n`;
                });
                existingContext += "\n";
            }
        } catch (ctxErr) {
            console.warn("Failed to build existing context:", ctxErr);
        }

        // Prepend existing context to fullText
        fullText = existingContext + "【今回の新しい資料】\n" + fullText;

        const payload = {
            prompt: data.title,
            contextData: fullText,
            contextImages: aiImages,
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
                // Parse JSON from AI
                // Sanitize potential markdown code blocks if AI ignores instructions
                let cleanJson = resData.reply.replace(/```json/g, '').replace(/```/g, '').trim();
                const analysis = JSON.parse(cleanJson);

                if (analysis) {
                    data.ai_summary = analysis.ai_summary || "";
                    data.ai_details = analysis.ai_details || "";
                    data.relevant_date = analysis.relevant_date || null;
                }
            } catch (jsonErr) {
                console.error("AI JSON Parse Error:", jsonErr);
                console.log("Raw Reply:", resData.reply);
                // Continue saving without AI data if parsing fails
            }
        }

        const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
        await setDoc(docRef, data, { merge: true });
        showToast("保存しました！(AI分析完了)");
        closeStrategyEditor();
        loadStrategies();
    } catch (e) {
        console.error(e);
        alert("保存エラー: " + e.message);
    }
}

export async function deleteStrategy(id) {
    showConfirmModal("削除確認", "この記事を削除しますか？", async () => {
        await deleteDoc(doc(db, "strategies", id));
        showToast("削除しました");
        loadStrategies();
    });
}

// --- UI Rendering (Viewer) ---
export function setStrategyCategory(category) {
    // Reset knowledge mode when switching categories usually
    // But if we want to stay in knowledge mode, we should check.
    // For now, assume category click exits knowledge mode.
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

    // Create Button Visibility
    // Visible if Admin OR (Knowledge Mode ?? Usually admin only creates knowledge too)
    // Assuming isStrategyAdmin logic applies to Knowledge Mode too
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
        // Step 2: Enforce category scoping even in Knowledge Mode
        // Original: return s.isKnowledge === true;
        // New: Check isKnowledge AND category (unless category is 'all')

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

        // Always use Article Card format
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-8 transition hover:shadow-xl animate-fade-in";

        // Show delete button if Admin OR KnowledgeMode (as requested: "知識リスト表示中も...削除できるようにする")
        const showControls = isStrategyAdmin || isKnowledgeMode;

        // AI Generated Indicator
        const hasAI = item.ai_summary ? '<span class="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🤖 AI済</span>' : '';

        let html = `
            <div class="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <span class="text-xs font-bold text-slate-400 block mb-1">
                        ${date} 更新 ${item.isKnowledge ? '<span class="text-indigo-500">🧠 知識</span>' : ''}
                        ${hasAI}
                    </span>
                    <h2 class="text-2xl font-black text-slate-800 leading-tight">${item.title}</h2>
                </div>
                ${showControls ? `
                <div class="flex gap-2 items-center">
                     ${!item.ai_summary ? `<button class="text-xs bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold hover:bg-green-100 shadow-sm border border-green-100 transition" onclick="window.regenerateAI('${item.id}')">🤖 AI生成</button>` : ''}
                     <button class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-100 shadow-sm border border-indigo-100 transition" onclick="window.openStrategyEditor('${item.id}')">✏️ 編集</button>
                     <button class="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-100 shadow-sm border border-rose-100 transition" onclick="window.deleteStrategy('${item.id}')">🗑️ 削除</button>
                </div>
                ` : ''}
            </div>
            <div class="p-0">
        `;

        if (item.blocks) {
            item.blocks.forEach(block => {
                let bgClass = "bg-white";
                let borderClass = "border-transparent";
                let textClass = "text-slate-600";
                if (block.importance === 'important') {
                    bgClass = "bg-rose-50"; textClass = "text-rose-800"; borderClass = "border-rose-100";
                } else if (block.importance === 'info') {
                    bgClass = "bg-sky-50"; textClass = "text-sky-800"; borderClass = "border-sky-100";
                } else if (block.importance === 'gold') {
                    bgClass = "bg-amber-50"; textClass = "text-amber-800"; borderClass = "border-amber-100";
                }

                const imgTag = block.image ? `<img src="${block.image}" class="w-full h-auto object-contain max-h-[400px] rounded-lg shadow-sm border border-black/5 my-3">` : '';
                const textTag = block.text ? `<p class="whitespace-pre-wrap leading-relaxed font-medium ${textClass}">${block.text}</p>` : '';

                html += `<div class="p-5 border-b border-slate-100 last:border-0 ${bgClass} ${borderClass} border-l-4">`;
                if (block.type === 'img_top') html += `${imgTag}${textTag}`;
                else if (block.type === 'img_bottom') html += `${textTag}${imgTag}`;
                else html += `${textTag}`;
                html += `</div>`;
            });
        }
        html += `</div>`;
        card.innerHTML = html;
        container.appendChild(card);
    });
}

// --- UI Rendering (Editor) ---
export function openStrategyEditor(id = null) {
    editingId = id;
    const modal = document.getElementById('strategy-editor-modal');
    modal.classList.remove('hidden');

    // Reset Forms
    document.getElementById('strategy-blocks-container').innerHTML = '';
    tempPdfImages = []; // Reset PDF images

    // Category Select Injection
    let titleInputContainer = document.getElementById('strategy-editor-title').parentNode;
    if (!document.getElementById('strategy-editor-category')) {
        const catDiv = document.createElement('div');
        catDiv.className = "mb-4";
        catDiv.innerHTML = `
            <label class="block text-xs font-bold text-slate-400 mb-1">カテゴリー</label>
            <select id="strategy-editor-category" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="pachinko">🅿️ パチンコ共有</option>
                <option value="slot">🎰 スロット共有</option>
                <option value="cs">🤝 CSチーム共有</option>
                <option value="strategy">📈 月間戦略</option>
            </select>
        `;
        titleInputContainer.parentNode.insertBefore(catDiv, titleInputContainer);
    }

    // Knowledge Checkbox Removal (Always ON now)
    const existingCheckbox = document.getElementById('strategy-is-knowledge-container');
    if (existingCheckbox) {
        existingCheckbox.remove();
    }

    const titleInput = document.getElementById('strategy-editor-title');
    const categorySelect = document.getElementById('strategy-editor-category');

    // Handle Category Locking & Initial Value
    if (currentCategory && currentCategory !== 'all' && !id) {
        categorySelect.value = currentCategory;
        categorySelect.disabled = true;
        categorySelect.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        categorySelect.disabled = false;
        categorySelect.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    // Always show editor
    document.getElementById('strategy-article-editor').classList.remove('hidden');

    // AI Context Section Injection
    if (!document.getElementById('strategy-ai-section')) {
        const aiDiv = document.createElement('div');
        aiDiv.id = 'strategy-ai-section';
        aiDiv.className = "mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-fade-in";
        aiDiv.innerHTML = `
            <label class="block text-xs font-bold text-indigo-600 mb-2">🤖 AI用知識データ (PDF / Excel)</label>
            <div class="mb-2 flex gap-2 items-center">
                <label class="cursor-pointer bg-white text-indigo-600 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-50 transition shadow-sm flex items-center gap-2">
                    <span>📂 資料を読み込む (PDF / Excel)</span>
                    <input type="file" accept=".pdf, .xlsx, .xls" class="hidden" onchange="window.handleContextFileUpload(this)">
                </label>
                <span id="file-status" class="text-[10px] text-slate-400 font-bold flex items-center"></span>
            </div>
            <textarea id="strategy-ai-context" class="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none placeholder-indigo-200" placeholder="ここにAIが参照するテキストを入力（資料を読み込むと自動で抽出されます）"></textarea>
            <p class="text-[10px] text-indigo-400 font-bold mt-1 text-right">※このテキストは記事には表示されず、AIの回答のみに使用されます</p>
        `;
        // Insert before the blocks container
        const blocksContainer = document.getElementById('strategy-article-editor');
        blocksContainer.parentNode.insertBefore(aiDiv, blocksContainer);
    }

    // Reset AI Context
    const aiContextInput = document.getElementById('strategy-ai-context');
    const fileStatus = document.getElementById('file-status');
    if (aiContextInput) aiContextInput.value = '';
    if (fileStatus) fileStatus.textContent = '';

    if (id) {
        // Edit Mode
        const item = strategies.find(s => s.id === id);
        if (item) {
            titleInput.value = item.title;
            categorySelect.value = item.category || 'strategy';
            categorySelect.disabled = false;
            categorySelect.classList.remove('opacity-50');

            if(item.blocks) {
                item.blocks.forEach(block => addEditorBlock(block.type, block));
            }
            if(item.ai_context && aiContextInput) {
                aiContextInput.value = item.ai_context;
            }

            if (item.ai_images) {
                tempPdfImages = item.ai_images;
                if (fileStatus) fileStatus.textContent = `既存画像: ${item.ai_images.length}枚`;
            }
        }
    } else {
        titleInput.value = '';
    }
}

export function closeStrategyEditor() {
    document.getElementById('strategy-editor-modal').classList.add('hidden');
}

export function addEditorBlock(type = 'text', initialData = null) {
    const container = document.getElementById('strategy-blocks-container');
    const div = document.createElement('div');
    div.className = "strategy-block-item bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-fade-in relative group";
    div.dataset.type = type;

    // タイプごとのラベル
    const typeLabels = { 'img_top': '📷 画像上＋文字', 'text': '📝 文字のみ', 'img_bottom': '📝 文字＋画像下 📷' };
    const importance = initialData ? initialData.importance : 'normal';
    const textContent = initialData ? initialData.text : '';

    let inner = `
        <div class="flex justify-between items-center mb-3">
            <span class="text-xs font-black text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">${typeLabels[type]}</span>
            <div class="flex gap-2">
                <select class="importance-select text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none">
                    <option value="normal" ${importance === 'normal' ? 'selected' : ''}>⚪ 普通(白)</option>
                    <option value="important" ${importance === 'important' ? 'selected' : ''}>🔴 重要(赤)</option>
                    <option value="info" ${importance === 'info' ? 'selected' : ''}>🔵 情報(青)</option>
                    <option value="gold" ${importance === 'gold' ? 'selected' : ''}>🟡 達成(金)</option>
                </select>
                <button class="text-slate-300 hover:text-rose-500 font-bold" onclick="this.closest('.strategy-block-item').remove()">×</button>
            </div>
        </div>
    `;

    const imgInput = `
        <div class="mb-3">
            <label class="block w-full cursor-pointer bg-white border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-500 text-slate-400 rounded-lg p-4 text-center transition">
                <span class="text-xs font-bold block">＋ 画像を選択 (自動圧縮)</span>
                <input type="file" accept="image/*" class="hidden block-img-input" onchange="window.handleBlockImage(this)">
            </label>
            <img class="block-img-preview hidden w-full h-32 object-cover rounded-lg mt-2 border border-slate-200" src="${initialData && initialData.image ? initialData.image : ''}">
        </div>
    `;

    const textInput = `<textarea class="block-text w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="本文を入力..."></textarea>`;

    if (type === 'img_top') inner += imgInput + textInput;
    else if (type === 'img_bottom') inner += textInput + imgInput;
    else inner += textInput;

    div.innerHTML = inner;
    container.appendChild(div);

    if (textContent) div.querySelector('.block-text').value = textContent;
    if (initialData && initialData.image) div.querySelector('.block-img-preview').classList.remove('hidden');
    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Global Handlers ---
window.handleBlockImage = async (input) => {
    if (input.files && input.files[0]) {
        try {
            const base64 = await compressImage(input.files[0]);
            const preview = input.closest('div').querySelector('.block-img-preview');
            preview.src = base64;
            preview.classList.remove('hidden');
            const label = input.closest('label');
            label.classList.add('border-indigo-500', 'text-indigo-500', 'bg-indigo-50');
            label.querySelector('span').textContent = "画像変更";
        } catch (e) {
            alert("画像処理に失敗しました");
        }
    }
};

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
                const currentVal = textarea.value;
                textarea.value = (currentVal ? currentVal + "\n\n" : "") + text;
            }

            tempPdfImages = images || [];

            let statusText = '完了';
            if (file.name.toLowerCase().endsWith('.pdf')) {
                statusText += ` (${pageCount}ページ, 画像${tempPdfImages.length}枚)`;
            } else {
                 statusText += ` (Excel)`;
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
window.addEditorBlock = addEditorBlock;
window.saveStrategy = saveStrategy;
window.deleteStrategy = deleteStrategy;
window.toggleKnowledgeList = toggleKnowledgeList;

window.regenerateAI = async (id) => {
    const item = strategies.find(s => s.id === id);
    if (!item) return;

    if (!confirm(`「${item.title}」のAI要約・詳細データを再生成しますか？`)) return;

    showToast("AI分析を開始します...", 2000);

    try {
        let fullText = "";
        if (item.ai_context) {
            fullText += item.ai_context + "\n\n";
        }
        if (item.blocks) {
            fullText += item.blocks.map(b => b.text || "").join("\n");
        }

        const payload = {
            prompt: item.title,
            contextData: fullText,
            contextImages: item.ai_images || [],
            mode: 'analyze_strategy'
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (resData.reply) {
             let cleanJson = resData.reply.replace(/```json/g, '').replace(/```/g, '').trim();
             const analysis = JSON.parse(cleanJson);

             if (analysis) {
                 await setDoc(doc(db, "strategies", id), {
                     ai_summary: analysis.ai_summary || "",
                     ai_details: analysis.ai_details || "",
                     relevant_date: analysis.relevant_date || null
                 }, { merge: true });

                 showToast("AI生成が完了しました！");
                 loadStrategies(); // Reload UI
             } else {
                 alert("AI分析に失敗しました（データ解析エラー）");
             }
        } else {
            alert("AIからの応答がありませんでした");
        }

    } catch (e) {
        console.error(e);
        alert("エラーが発生しました: " + e.message);
    }
};

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
