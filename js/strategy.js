
import { db } from './firebase.js'; import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; import { showToast, showConfirmModal } from './ui.js';

// --- State --- let strategies = []; let editingId = null;

// --- Image Compression Logic --- const compressImage = (file) => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; const MAX_WIDTH = 800; // 800pxあればスマホ・PCともに十分きれい

            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // JPEG品質0.6 (かなり軽量化される)
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
    };
    reader.onerror = (error) => reject(error);
});
};

// --- Firestore Operations --- export async function loadStrategies() { const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(20)); const snapshot = await getDocs(q); strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderStrategyList(); }

export async function saveStrategy() { const titleInput = document.getElementById('strategy-editor-title'); if (!titleInput.value.trim()) return alert("タイトルを入力してください");

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

const data = {
    title: titleInput.value,
    blocks: blocksData,
    updatedAt: serverTimestamp(),
    author: "Admin"
};

// ★容量チェック機能
const jsonSize = new Blob([JSON.stringify(data)]).size;
const sizeInMB = jsonSize / (1024 * 1024);
console.log(`Data Size: ${sizeInMB.toFixed(2)} MB`);

if (sizeInMB > 0.95) { // 1MB制限に対し安全マージンをとる
    return alert(`容量オーバーです（現在: ${sizeInMB.toFixed(2)}MB）\n画像を減らすか、ブロックを分けて投稿してください。`);
}

try {
    const docRef = editingId ? doc(db, "strategies", editingId) : doc(collection(db, "strategies"));
    await setDoc(docRef, data, { merge: true });
    showToast("保存しました！");
    closeStrategyEditor();
    loadStrategies();
} catch (e) {
    console.error(e);
    alert("保存エラーが発生しました。通信環境を確認してください。");
}
}

export async function deleteStrategy(id) { showConfirmModal("削除確認", "この記事を削除しますか？", async () => { await deleteDoc(doc(db, "strategies", id)); showToast("削除しました"); loadStrategies(); }); }

// --- Text Formatting Helper (簡易タグ変換) --- function formatText(text) { if (!text) return ''; // XSS対策（簡易） let safeText = text.replace(/</g, "<").replace(/>/g, ">");

// タグ置換
// [赤]...[/赤] -> 赤太文字
safeText = safeText.replace(/\[赤\](.*?)\[\/赤\]/g, '<span class="text-rose-600 font-black">$1</span>');
// [青]...[/青] -> 青太文字
safeText = safeText.replace(/\[青\](.*?)\[\/青\]/g, '<span class="text-indigo-600 font-black">$1</span>');
// [大]...[/大] -> デカ文字
safeText = safeText.replace(/\[大\](.*?)\[\/大\]/g, '<span class="text-xl sm:text-2xl font-black bg-yellow-100 px-1">$1</span>');
// [マ]...[/マ] -> 黄色マーカー
safeText = safeText.replace(/\[マ\](.*?)\[\/マ\]/g, '<span class="bg-yellow-200 font-bold px-1">$1</span>');
// [筆]...[/筆] -> 筆文字（明朝体）
safeText = safeText.replace(/\[筆\](.*?)\[\/筆\]/g, '<span class="font-serif font-black text-xl" style="font-family: \'Kaisei Opti\', serif;">$1</span>');
// [太]...[/太] -> 極太ポップ体
safeText = safeText.replace(/\[太\](.*?)\[\/太\]/g, '<span class="text-xl" style="font-family: \'Rampart One\', sans-serif;">$1</span>');

return safeText;
}

// --- UI Rendering (Viewer) --- function renderStrategyList() { const container = document.getElementById('strategy-list-container'); if (!container) return; container.innerHTML = '';

if (strategies.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-400 py-10">共有事項はありません</p>`;
    return;
}

strategies.forEach(item => {
    const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';
    const card = document.createElement('div');
    card.className = "bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-8 transition hover:shadow-xl";

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

    item.blocks.forEach(block => {
        let bgClass = "bg-white";
        let borderClass = "border-transparent";
        let textClass = "text-slate-600";

        if (block.importance === 'important') {
            bgClass = "bg-rose-50"; textClass = "text-rose-900"; borderClass = "border-rose-200";
        } else if (block.importance === 'info') {
            bgClass = "bg-sky-50"; textClass = "text-sky-900"; borderClass = "border-sky-200";
        } else if (block.importance === 'gold') {
            bgClass = "bg-amber-50"; textClass = "text-amber-900"; borderClass = "border-amber-200";
        }

        const imgTag = block.image ? `<img src="${block.image}" class="w-full h-auto object-contain max-h-[400px] rounded-lg shadow-sm border border-black/5 my-3">` : '';
        // ★ここで formatText を通す
        const formattedText = formatText(block.text);
        const textTag = block.text ? `<p class="whitespace-pre-wrap leading-relaxed font-medium ${textClass}">${formattedText}</p>` : '';

        html += `<div class="p-5 border-b border-slate-100 last:border-0 ${bgClass} ${borderClass} border-l-4">`;
        if (block.type === 'img_top') html += `${imgTag}${textTag}`;
        else if (block.type === 'img_bottom') html += `${textTag}${imgTag}`;
        else html += `${textTag}`;
        html += `</div>`;
    });

    html += `</div>`;
    card.innerHTML = html;
    container.appendChild(card);
});
}

// --- UI Rendering (Editor) --- export function openStrategyEditor(id = null) { editingId = id; document.getElementById('strategy-editor-modal').classList.remove('hidden'); document.getElementById('strategy-blocks-container').innerHTML = ''; document.getElementById('strategy-editor-title').value = ''; // 初期ブロックを1つ追加しておくと親切 if(!id) addEditorBlock('text'); }

export function closeStrategyEditor() { document.getElementById('strategy-editor-modal').classList.add('hidden'); }

// ★装飾タグ挿入ヘルパー window.insertTag = (btn, tagStart, tagEnd) => { const textarea = btn.closest('.strategy-block-item').querySelector('.block-text'); const start = textarea.selectionStart; const end = textarea.selectionEnd; const text = textarea.value;

const before = text.substring(0, start);
const selected = text.substring(start, end);
const after = text.substring(end);

textarea.value = before + tagStart + selected + tagEnd + after;
textarea.focus();
textarea.selectionStart = start + tagStart.length;
textarea.selectionEnd = end + tagStart.length;
};

export function addEditorBlock(type = 'text') { const container = document.getElementById('strategy-blocks-container'); const div = document.createElement('div'); div.className = "strategy-block-item bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-fade-in relative group shadow-sm"; div.dataset.type = type;

const typeLabels = { 'img_top': '📷 画像上＋文字', 'text': '📝 文字のみ', 'img_bottom': '📝 文字＋画像下 📷' };

// 装飾ツールバー
const toolbar = `
    <div class="flex gap-1 mb-2 overflow-x-auto pb-1 no-scrollbar">
        <button onclick="insertTag(this, '[赤]', '[/赤]')" class="px-2 py-1 bg-rose-100 text-rose-600 text-[10px] font-bold rounded hover:bg-rose-200">赤字</button>
        <button onclick="insertTag(this, '[青]', '[/青]')" class="px-2 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded hover:bg-indigo-200">青字</button>
        <button onclick="insertTag(this, '[マ]', '[/マ]')" class="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded hover:bg-yellow-200">マーカー</button>
        <div class="w-px h-4 bg-slate-300 mx-1"></div>
        <button onclick="insertTag(this, '[大]', '[/大]')" class="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-black rounded hover:bg-slate-300">デカ文字</button>
        <button onclick="insertTag(this, '[筆]', '[/筆]')" class="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-serif font-bold rounded hover:bg-slate-200">筆文字</button>
        <button onclick="insertTag(this, '[太]', '[/太]')" class="px-2 py-1 bg-slate-800 text-white text-[10px] font-black rounded hover:bg-slate-600">極太</button>
    </div>
`;

let inner = `
    <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-black text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">${typeLabels[type]}</span>
        <div class="flex gap-2">
            <select class="importance-select text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none cursor-pointer hover:bg-slate-50">
                <option value="normal">⚪ 普通(白)</option>
                <option value="important">🔴 重要(赤)</option>
                <option value="info">🔵 情報(青)</option>
                <option value="gold">🟡 達成(金)</option>
            </select>
            <button class="text-slate-300 hover:text-rose-500 font-bold px-2" onclick="this.closest('.strategy-block-item').remove()">×</button>
        </div>
    </div>
`;

const imgInput = `
    <div class="mb-3">
        <label class="block w-full cursor-pointer bg-white border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-500 text-slate-400 rounded-lg p-3 text-center transition group-hover:border-indigo-300">
            <span class="text-xs font-bold block">＋ 画像を選択 (自動圧縮)</span>
            <input type="file" accept="image/*" class="hidden block-img-input" onchange="window.handleBlockImage(this)">
        </label>
        <img class="block-img-preview hidden w-full h-32 object-cover rounded-lg mt-2 border border-slate-200">
    </div>
`;

const textInput = `${toolbar}<textarea class="block-text w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 h-28 resize-none shadow-inner leading-relaxed" placeholder="本文を入力..."></textarea>`;

if (type === 'img_top') {
    inner += imgInput + textInput;
} else if (type === 'img_bottom') {
    inner += textInput + imgInput;
} else {
    inner += textInput;
}

div.innerHTML = inner;
container.appendChild(div);
div.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Global Handlers --- window.handleBlockImage = async (input) => { if (input.files && input.files[0]) { try { const base64 = await compressImage(input.files[0]); const preview = input.closest('div').querySelector('.block-img-preview'); preview.src = base64; preview.classList.remove('hidden'); const label = input.closest('label'); label.classList.add('border-indigo-500', 'text-indigo-500', 'bg-indigo-50'); label.querySelector('span').textContent = "画像変更済み"; } catch (e) { alert("画像処理に失敗しました"); } } };

window.openStrategyEditor = openStrategyEditor; window.closeStrategyEditor = closeStrategyEditor; window.addEditorBlock = addEditorBlock; window.saveStrategy = saveStrategy; window.deleteStrategy = deleteStrategy;

export function initStrategy() { loadStrategies(); const createBtn = document.getElementById('btn-create-strategy'); if(createBtn) createBtn.onclick = () => openStrategyEditor(); }