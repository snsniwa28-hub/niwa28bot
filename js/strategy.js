import { db, app } from './firebase.js';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal } from './ui.js';

// --- State ---
let strategies = [];
let editingId = null; // nullなら新規作成
let currentCategory = 'all'; // 'all', 'pachinko', 'slot', 'cs', 'strategy'
let isStrategyAdmin = false;

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
        author: "Admin"
    };

    // Block Data Collection
    const blocksData = [];
    const blockElements = document.querySelectorAll('.strategy-block-item');
    blockElements.forEach(el => {
        const type = el.dataset.type;
        const importance = el.querySelector('.importance-select').value;
        const text = el.querySelector('.block-text').value;
        const imgPreview = el.querySelector('.block-img-preview');
        const image = (imgPreview && !imgPreview.classList.contains('hidden')) ? imgPreview.src : null;
        blocksData.push({ type, importance, text, image });
    });

    if (blocksData.length === 0) return alert("少なくとも1つのブロックを追加してください");
    data.blocks = blocksData;

    try {
        const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
        await setDoc(docRef, data, { merge: true });
        showToast("保存しました！");
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
    currentCategory = category;
    renderStrategyList();

    const header = document.querySelector('#internalSharedModal .modal-content > div:first-child');
    const titleEl = document.querySelector('#internalSharedModal h3');
    const iconEl = document.querySelector('#internalSharedModal span.text-2xl');
    const createBtn = document.getElementById('btn-create-strategy');
    const createBtnMobile = document.getElementById('btn-create-strategy-mobile');

    if (header) header.className = "p-4 border-b border-slate-200 flex justify-between items-center shrink-0 z-10 shadow-sm bg-white";

    const config = {
        'pachinko': { title: 'パチンコ共有', icon: '🅿️', color: 'text-pink-600', bg: 'bg-pink-50' },
        'slot': { title: 'スロット共有', icon: '🎰', color: 'text-purple-600', bg: 'bg-purple-50' },
        'cs': { title: 'CSチーム共有', icon: '🤝', color: 'text-orange-600', bg: 'bg-orange-50' },
        'strategy': { title: '月間戦略', icon: '📈', color: 'text-red-600', bg: 'bg-red-50' },
        'all': { title: '社内共有・戦略', icon: '📋', color: 'text-slate-800', bg: 'bg-slate-50' }
    };

    const c = config[category] || config['all'];

    if(titleEl) {
        titleEl.textContent = c.title;
        titleEl.className = `font-black text-lg ${c.color}`;
    }
    if(iconEl) iconEl.textContent = c.icon;

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
        if (!currentCategory || currentCategory === 'all') return true;
        const cat = s.category || 'strategy';
        return cat === currentCategory;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50">
            <span class="text-4xl mb-2">📭</span>
            <p class="text-sm font-bold text-slate-400">まだ記事がありません</p>
        </div>`;
        return;
    }

    filtered.forEach(item => {
        const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';

        // Always use Article Card format
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-8 transition hover:shadow-xl animate-fade-in";

        let html = `
            <div class="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <span class="text-xs font-bold text-slate-400 block mb-1">${date} 更新</span>
                    <h2 class="text-2xl font-black text-slate-800 leading-tight">${item.title}</h2>
                </div>
                ${isStrategyAdmin ? `
                <div class="flex gap-2">
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
    // Removed Knowledge/PDF resets as elements are gone

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
        }
    } else {
        titleInput.value = '';
    }

    // Always show editor (no toggle logic anymore)
    document.getElementById('strategy-article-editor').classList.remove('hidden');
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

window.openStrategyEditor = openStrategyEditor;
window.closeStrategyEditor = closeStrategyEditor;
window.addEditorBlock = addEditorBlock;
window.saveStrategy = saveStrategy;
window.deleteStrategy = deleteStrategy;

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
