
import { db } from './firebase.js';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal } from './ui.js';

// --- State ---
let strategies = [];
let editingId = null; // nullなら新規作成

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
    const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(20));
    const snapshot = await getDocs(q);
    strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStrategyList();
}

export async function saveStrategy() {
    const titleInput = document.getElementById('strategy-editor-title');
    if (!titleInput.value.trim()) return alert("タイトルを入力してください");

    const blocksData = [];
    const blockElements = document.querySelectorAll('.strategy-block-item');

    // ブロックごとのデータを収集
    blockElements.forEach(el => {
        const type = el.dataset.type; // 'img_top', 'text', 'img_bottom'
        const importance = el.querySelector('.importance-select').value;
        const text = el.querySelector('.block-text').value;
        const imgPreview = el.querySelector('.block-img-preview');
        const image = (imgPreview && !imgPreview.classList.contains('hidden')) ? imgPreview.src : null;

        blocksData.push({ type, importance, text, image });
    });

    if (blocksData.length === 0) return alert("少なくとも1つのブロックを追加してください");

    const data = {
        title: titleInput.value,
        blocks: blocksData,
        updatedAt: serverTimestamp(),
        author: "Admin" // 将来的にログインユーザー名など
    };

    try {
        const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
        await setDoc(docRef, data, { merge: true });
        showToast("保存しました！");
        closeStrategyEditor();
        loadStrategies();
    } catch (e) {
        console.error(e);
        alert("保存エラー: 画像サイズが大きすぎる可能性があります。\nブロックを減らすか画像を小さくしてください。");
    }
}

export async function deleteStrategy(id) {
    showConfirmModal("削除確認", "この記事を削除しますか？", async () => {
        await deleteDoc(doc(db, "strategies", id));
        showToast("削除しました");
        loadStrategies();
        // もし閲覧モードで開いていた場合は閉じる
        document.getElementById('internalSharedModal').classList.add('hidden');
    });
}

// --- UI Rendering (Viewer) ---
function renderStrategyList() {
    // 閲覧モーダルの中身を描画
    const container = document.getElementById('strategy-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (strategies.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-400 py-10">共有事項はありません</p>`;
        return;
    }

    strategies.forEach(item => {
        const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';

        // カード生成
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-8 transition hover:shadow-xl";

        // ヘッダー（タイトル）
        let html = `
            <div class="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <span class="text-xs font-bold text-slate-400 block mb-1">${date} 更新</span>
                    <h2 class="text-2xl font-black text-slate-800 leading-tight">${item.title}</h2>
                </div>
                ${window.isEditing ? `<button class="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-bold ml-2 shrink-0 hover:bg-rose-100" onclick="window.deleteStrategy('${item.id}')">削除</button>` : ''}
            </div>
            <div class="p-0">
        `;

        // ブロック描画
        item.blocks.forEach(block => {
            // 重要度によるスタイル
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

            if (block.type === 'img_top') {
                html += `${imgTag}${textTag}`;
            } else if (block.type === 'img_bottom') {
                html += `${textTag}${imgTag}`;
            } else {
                html += `${textTag}`;
            }
            html += `</div>`;
        });

        html += `</div>`; // end card body
        card.innerHTML = html;
        container.appendChild(card);
    });
}

// --- UI Rendering (Editor) ---
export function openStrategyEditor(id = null) {
    editingId = id;
    document.getElementById('strategy-editor-modal').classList.remove('hidden');
    document.getElementById('strategy-blocks-container').innerHTML = '';
    document.getElementById('strategy-editor-title').value = '';

    // 新規作成時は空っぽからスタート
}

export function closeStrategyEditor() {
    document.getElementById('strategy-editor-modal').classList.add('hidden');
}

export function addEditorBlock(type = 'text') {
    const container = document.getElementById('strategy-blocks-container');
    const div = document.createElement('div');
    div.className = "strategy-block-item bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-fade-in relative group";
    div.dataset.type = type;

    // タイプごとのラベル
    const typeLabels = { 'img_top': '📷 画像上＋文字', 'text': '📝 文字のみ', 'img_bottom': '📝 文字＋画像下 📷' };

    // HTML構築
    let inner = `
        <div class="flex justify-between items-center mb-3">
            <span class="text-xs font-black text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">${typeLabels[type]}</span>
            <div class="flex gap-2">
                <select class="importance-select text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none">
                    <option value="normal">⚪ 普通(白)</option>
                    <option value="important">🔴 重要(赤)</option>
                    <option value="info">🔵 情報(青)</option>
                    <option value="gold">🟡 達成(金)</option>
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
            <img class="block-img-preview hidden w-full h-32 object-cover rounded-lg mt-2 border border-slate-200">
        </div>
    `;

    const textInput = `<textarea class="block-text w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="本文を入力..."></textarea>`;

    if (type === 'img_top') {
        inner += imgInput + textInput;
    } else if (type === 'img_bottom') {
        inner += textInput + imgInput;
    } else {
        inner += textInput;
    }

    div.innerHTML = inner;
    container.appendChild(div);

    // 自動スクロール
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
            // アップロードボタンの見た目を変える
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

// --- Initialize ---
// main.jsから呼ばれる想定
export function initStrategy() {
    loadStrategies();

    // 「管理者作成」ボタンのリスナーなどは、HTML側で onclick="openStrategyEditor()" するか、ここで設定
    const createBtn = document.getElementById('btn-create-strategy');
    if(createBtn) createBtn.onclick = () => openStrategyEditor();
}
