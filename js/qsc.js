import { db } from './firebase.js';
import { collection, doc, onSnapshot, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { $ } from './utils.js';
import { showPasswordModal } from './ui.js';

let qscItems = [];
let currentQscTab = '未実施';
let qscEditMode = false;

// --- Image Compression Logic (Same as strategy.js) ---
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

// --- Lightbox Logic ---
function openQscLightbox(src) {
    let lightbox = document.getElementById('qsc-lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'qsc-lightbox';
        lightbox.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 opacity-0 hidden';
        lightbox.innerHTML = `
            <div class="relative max-w-full max-h-full">
                <button id="qsc-lightbox-close" class="absolute -top-12 right-0 text-white text-3xl font-bold p-2 hover:text-rose-500 transition">×</button>
                <img id="qsc-lightbox-img" src="" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10">
            </div>
        `;
        document.body.appendChild(lightbox);

        // Close handlers
        lightbox.onclick = (e) => {
             if (e.target === lightbox || e.target.id === 'qsc-lightbox-close') {
                 closeQscLightbox();
             }
        };
    }

    const img = lightbox.querySelector('#qsc-lightbox-img');
    img.src = src;
    lightbox.classList.remove('hidden');
    // slight delay for fade-in effect
    requestAnimationFrame(() => lightbox.classList.remove('opacity-0'));
}

function closeQscLightbox() {
     const lightbox = document.getElementById('qsc-lightbox');
     if(lightbox) {
         lightbox.classList.add('opacity-0');
         setTimeout(() => {
             lightbox.classList.add('hidden');
             const img = lightbox.querySelector('#qsc-lightbox-img');
             if(img) img.src = '';
         }, 300);
     }
}

export function subscribeQSC() {
    onSnapshot(collection(db, "qsc_items"), (s) => {
        qscItems = s.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.no - b.no);
        const u = qscItems.filter(i => i.status === "未実施").length;
        const countEl = $('#qscUnfinishedCount');
        if(countEl) countEl.textContent = u > 0 ? `残り ${u} 件` : `完了`;

        if($('#qsc-view').classList.contains("active")) renderQSCList();
    });
}

export function renderQSCList() {
    const c = $('#qscListContainer');
    if(!c) return;
    c.innerHTML = "";

    const f = qscItems.filter(item => currentQscTab === '未実施' ? item.status === "未実施" : item.status === "完了");

    if (f.length === 0) {
        c.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold">項目はありません</div>`;
        return;
    }

    const g = {};
    f.forEach(item => { if(!g[item.area]) g[item.area] = []; g[item.area].push(item); });

    for(const [area, items] of Object.entries(g)) {
        const h = document.createElement("div");
        h.className = "text-xs font-bold text-slate-500 bg-slate-200/50 px-3 py-1 rounded mt-4 mb-2 first:mt-0";
        h.textContent = area;
        c.appendChild(h);

        items.forEach(item => {
            const d = document.createElement("div");
            d.className = `bg-white p-4 rounded-xl border ${item.status === '完了' ? 'border-slate-100 opacity-60' : 'border-slate-200'} shadow-sm flex items-center gap-4`;

            // Image Thumbnail
            let imgHtml = '';
            if (item.image) {
                // Ensure proper escaping for item.image in onclick
                // Ideally, we attach event listener instead of inline onclick for large base64 strings
                // But for simplicity with base64 strings, we can just make an element and attach listener
                imgHtml = `<img src="${item.image}" class="w-12 h-12 object-cover rounded-lg border border-slate-100 cursor-pointer hover:opacity-80 transition shrink-0 qsc-thumb">`;
            }

            if (qscEditMode) {
                d.innerHTML = `
                    <div class="flex items-center gap-3 flex-1 overflow-hidden">
                        ${imgHtml}
                        <p class="text-sm font-bold text-slate-700 truncate">${item.no}. ${item.content}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button class="p-2 bg-slate-100 text-slate-500 rounded-full btn-edit-qsc hover:bg-slate-200 transition">✎</button>
                        <button class="p-2 bg-rose-50 text-rose-500 rounded-full btn-delete-qsc hover:bg-rose-100 transition">×</button>
                    </div>
                `;
                d.querySelector('.btn-edit-qsc').onclick = () => editQscItem(item);
                d.querySelector('.btn-delete-qsc').onclick = () => deleteQscItem(item.id);
            } else {
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "qsc-checkbox shrink-0 mt-0.5";
                cb.checked = item.status === "完了";
                cb.onchange = async () => {
                    try {
                        await updateDoc(doc(db, "qsc_items", item.id), { status: cb.checked ? "完了" : "未実施" });
                    } catch(e) {
                        cb.checked = !cb.checked;
                    }
                };

                d.innerHTML = `
                    <div class="flex items-center gap-3 flex-1 overflow-hidden">
                        ${imgHtml}
                        <p class="text-sm font-bold text-slate-700 ${item.status === '完了' ? 'line-through text-slate-400' : ''}">${item.no}. ${item.content}</p>
                    </div>
                `;
                d.insertBefore(cb, d.firstChild);
            }

            // Attach image click listener if exists
            const thumb = d.querySelector('.qsc-thumb');
            if (thumb) {
                thumb.onclick = () => {
                    openQscLightbox(item.image);
                };
            }

            c.appendChild(d);
        });
    }
}

export async function addQscItem() {
    const n = $('#newQscNo').value;
    const a = $('#newQscArea').value;
    const c = $('#newQscContent').value;
    const fileInput = $('#newQscImage');

    if(!n||!a||!c) {
        alert("必須項目を入力してください");
        return;
    }

    let imageData = null;
    if (fileInput && fileInput.files[0]) {
        try {
            imageData = await compressImage(fileInput.files[0]);
        } catch (e) {
            alert("画像処理に失敗しました: " + e.message);
            return;
        }
    }

    try {
        await addDoc(collection(db, "qsc_items"), {
            no: Number(n),
            area: a,
            content: c,
            status: "未実施",
            image: imageData
        });

        // Reset Form
        $('#newQscNo').value='';
        $('#newQscContent').value='';
        if(fileInput) fileInput.value = '';

    } catch(e) {
        alert("追加エラー: " + e.message);
    }
}

let currentEditingQscId = null;
let currentEditingQscImage = null; // Store current image data for logic

export function editQscItem(item) {
    currentEditingQscId = item.id;
    currentEditingQscImage = item.image || null;

    const modal = document.getElementById('qscEditModal');
    if (!modal) return;

    document.getElementById('qscEditNo').value = item.no;
    document.getElementById('qscEditArea').value = item.area;
    document.getElementById('qscEditContent').value = item.content;

    // Image Handling
    const preview = document.getElementById('qscEditImagePreview');
    const deleteBtn = document.getElementById('qscEditDeleteImageBtn');
    const fileInput = document.getElementById('qscEditImageInput');

    if (fileInput) fileInput.value = ''; // Reset input

    if (item.image) {
        if (preview) {
            preview.src = item.image;
            preview.classList.remove('hidden');
        }
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => {
                // Mark for deletion visually
                preview.classList.add('hidden');
                deleteBtn.classList.add('hidden');
                currentEditingQscImage = null; // Mark as null
            };
        }
    } else {
        if (preview) preview.classList.add('hidden');
        if (deleteBtn) deleteBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex', 'items-center', 'justify-center');
}

export function closeQscEditModal() {
    const modal = document.getElementById('qscEditModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex', 'items-center', 'justify-center');
    }
    currentEditingQscId = null;
    currentEditingQscImage = null;
}

export async function saveQscEdit() {
    if (!currentEditingQscId) return;

    const no = document.getElementById('qscEditNo').value;
    const area = document.getElementById('qscEditArea').value;
    const content = document.getElementById('qscEditContent').value;
    const fileInput = document.getElementById('qscEditImageInput');

    if (!no || !area || !content) {
        alert("すべての項目を入力してください");
        return;
    }

    let newImage = currentEditingQscImage; // Default to existing (or deleted) state

    // If new file selected, overwrite
    if (fileInput && fileInput.files[0]) {
        try {
            newImage = await compressImage(fileInput.files[0]);
        } catch(e) {
            alert("画像処理失敗: " + e.message);
            return;
        }
    }

    try {
        const updateData = {
            no: Number(no),
            area: area,
            content: content
        };

        // Update image field logic
        // If newImage is null, we should delete the field or set to null.
        // Firestore updateDoc with value null sets it to null.
        // If we want to strictly delete field: deleteField() from firestore imports.
        // But setting to null is usually fine for "no image".
        updateData.image = newImage;

        await updateDoc(doc(db, "qsc_items", currentEditingQscId), updateData);
        closeQscEditModal();
    } catch(e) {
        alert("更新エラー: " + e.message);
    }
}

export async function deleteQscItem(id) {
    if(confirm("削除しますか？")) {
        await deleteDoc(doc(db, "qsc_items", id));
    }
}

export function toggleQscEditMode() {
    if (qscEditMode) {
        qscEditMode = false;
        $('#qscEditButton').textContent = "⚙️ 管理";
        $('#qscAddForm').classList.add('hidden');
        renderQSCList();
    } else {
        showPasswordModal(activateQscEditMode);
    }
}

export function activateQscEditMode() {
    qscEditMode = true;
    $('#qscEditButton').textContent = "✅ 完了";
    $('#qscAddForm').classList.remove('hidden');
    renderQSCList();
}

export function openQSCModal() {
    $('#qsc-view').classList.add('active');
    renderQSCList();
}

export function closeQSCModal() {
    $('#qsc-view').classList.remove('active');
}

export function setQscTab(tab) {
    currentQscTab = tab;
    if (tab === '未実施') {
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    } else {
        $('#qscTabFinished').className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-rose-600 shadow-sm";
        $('#qscTabUnfinished').className = "px-3 py-1 text-xs font-bold rounded-md text-slate-400";
    }
    renderQSCList();
}
