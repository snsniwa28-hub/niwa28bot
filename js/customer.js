import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { latestKeywords } from './config.js';
import { $, compressMapImage } from './utils.js';

let allMachines = [];
let newOpeningData = [];
let eventMap = new Map();
let currentEditingImages = [];

export async function fetchCustomerData() {
    try {
        const [mSnap, nSnap, cSnap] = await Promise.all([
            getDocs(collection(db, "machines")),
            getDocs(collection(db, "newOpening")),
            getDocs(collection(db, "calendar"))
        ]);
        allMachines = mSnap.docs.map(d => d.data()).sort((a, b) => a.name.localeCompare(b.name));
        newOpeningData = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        eventMap = new Map(cSnap.docs.map(d => d.data()).sort((a, b) => a.date - b.date).map(e => [e.date, e]));
        renderToday();
        updateNewOpeningCard();
        fetchMapData(); // Load Map
    } catch (e) {
        console.error(e);
        const container = $('#todayEventContainer');
        if(container) container.innerHTML = `<p class="text-rose-500 text-center font-bold">データ読込失敗</p>`;
    }
}

export function renderToday() {
    const today = new Date(); const d = today.getDate(); const m = today.getMonth();
    const ev = eventMap.get(d);
    const html = ev ? `<div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 w-full"><div class="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60"><div class="flex items-center gap-3"><div class="bg-indigo-600 text-white rounded-xl px-4 py-2 text-center shadow-md shadow-indigo-200"><div class="text-[10px] font-bold opacity-80 tracking-wider">TOPIC</div><div class="text-2xl font-black leading-none">${d}</div></div><div class="font-bold text-indigo-900 text-lg">本日のイベント</div></div><span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">TODAY</span></div><ul class="space-y-3">${ev.p_event?`<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.p_event}</span></li>`:''}${ev.s_event?`<li class="flex items-start p-2 rounded-lg hover:bg-white transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 mr-3 shrink-0"></span><span class="text-slate-700 font-bold text-sm leading-relaxed">${ev.s_event}</span></li>`:''}${ev.recommend?`<li class="flex items-start p-2 rounded-lg hover:bg-rose-50 transition-colors"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 mr-3 shrink-0"></span><span class="text-rose-600 font-bold text-sm leading-relaxed">${ev.recommend}</span></li>`:''}</ul></div>` : `<div class="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 w-full"><div class="text-5xl font-black text-slate-200 mb-3">${d}</div><p class="text-sm font-bold">イベント情報なし</p></div>`;

    const container = $('#todayEventContainer');
    if(container) container.innerHTML = html;

    const dateEl = $('#currentDate');
    if(dateEl) dateEl.textContent = `${today.getFullYear()}.${m + 1}.${d}`;
}

function updateNewOpeningCard() {
    // 2. New Machine Info Card in Dashboard
    const cardLink = document.getElementById('newOpeningCard');
    if (!cardLink) return;

    const iconContainer = cardLink.querySelector('.bg-indigo-50'); // Icon background wrapper
    const title = cardLink.querySelector('h2');
    const sub = cardLink.querySelector('p');

    // Always enable interaction
    cardLink.classList.remove('opacity-50', 'pointer-events-none', 'bg-slate-50');
    cardLink.classList.add('bg-white', 'hover:-translate-y-1', 'hover:shadow-xl', 'cursor-pointer');

    // Icon styles restore (or ensure it's indigo)
    if (iconContainer) {
        iconContainer.classList.add('bg-indigo-50', 'text-indigo-600', 'group-hover:bg-indigo-600');
        iconContainer.classList.remove('bg-slate-100', 'text-slate-400');
    }

    if (!newOpeningData || newOpeningData.length === 0) {
        if (title) {
            title.textContent = "新台データ準備中";
            title.classList.remove('group-hover:text-indigo-600');
            title.classList.add('text-slate-400');
        }
        if (sub) sub.textContent = "Coming Soon...";
    } else {
        if (title) {
            title.textContent = "新装開店";
            title.classList.add('group-hover:text-indigo-600');
            title.classList.remove('text-slate-400');
        }
        if (sub) sub.textContent = "最新機種情報";
    }
}

export function openNewOpening() {
    const c = $('#newOpeningInfo');
    c.innerHTML = "";
    $('#new-opening-view').classList.add('active');

    if (!newOpeningData || !newOpeningData.length) {
        c.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                <span class="text-4xl mb-2">🚧</span>
                <p class="font-bold text-lg">現在、新台情報はありません</p>
                <p class="text-xs mt-2 opacity-70">（右上の「⚙️ 管理」ボタンから登録できます）</p>
            </div>`;
        return;
    }

    const listContainer = document.createElement("div");
    listContainer.className = "max-w-4xl mx-auto";

    newOpeningData.forEach(item => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6";

        // Slideshow or Image
        let imageSection = "";
        const images = item.images || [];
        if (images.length > 0) {
            imageSection = `
                <div class="relative w-full aspect-video bg-slate-900 group/slide">
                    <img src="${images[0]}" class="w-full h-full object-contain" id="slide-img-${item.id}" data-idx="0">
                    ${images.length > 1 ? `
                        <button class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition opacity-0 group-hover/slide:opacity-100" onclick="changeSlide('${item.id}', -1)">◀</button>
                        <button class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition opacity-0 group-hover/slide:opacity-100" onclick="changeSlide('${item.id}', 1)">▶</button>
                        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            ${images.map((_, i) => `<div class="w-1.5 h-1.5 rounded-full ${i===0?'bg-white':'bg-white/50'}" id="dot-${item.id}-${i}"></div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Specs and Details
        const specText = (item.spec || "詳細情報なし").replace(/\n/g, '<br>');

        card.innerHTML = `
            ${imageSection}
            <div class="p-5">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-xl font-black text-slate-800 leading-tight">${item.name || "名称未設定"}</h3>
                    <div class="flex flex-col items-end gap-1">
                        <span class="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm shadow-indigo-200">導入 ${item.count || 0}台</span>
                        ${item.totalCount ? `<span class="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded">総台数 ${item.totalCount}台</span>` : ''}
                    </div>
                </div>

                <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 class="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">SPEC & INFO</h4>
                    <p class="text-sm font-medium text-slate-700 leading-relaxed">${specText}</p>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });

    c.appendChild(listContainer);
}

// Global function for slideshow (since onclick is used in HTML string)
window.changeSlide = (itemId, dir) => {
    const item = newOpeningData.find(d => d.id === itemId);
    if (!item || !item.images || item.images.length < 2) return;

    const imgEl = document.getElementById(`slide-img-${itemId}`);
    if (!imgEl) return;

    let idx = parseInt(imgEl.getAttribute('data-idx'));
    idx = (idx + dir + item.images.length) % item.images.length;

    imgEl.src = item.images[idx];
    imgEl.setAttribute('data-idx', idx);

    // Update dots
    item.images.forEach((_, i) => {
        const dot = document.getElementById(`dot-${itemId}-${i}`);
        if(dot) dot.className = `w-1.5 h-1.5 rounded-full ${i===idx?'bg-white':'bg-white/50'}`;
    });
};

export function closeNewOpeningModal() {
    $('#new-opening-view').classList.remove('active');
}

export function closeDetailModal() {
    $('#machineDetailModal').classList.add('hidden');
}

// --- Admin Logic ---

export function openNewOpeningEditAuth() {
    window.showPasswordModal(openNewOpeningEdit);
}

export function openNewOpeningEdit() {
    $('#new-opening-edit-view').classList.add('active');
    renderNewOpeningEditList();
    clearNewOpeningForm();
}

export function closeNewOpeningEditView() {
    $('#new-opening-edit-view').classList.remove('active');
    openNewOpening(); // Refresh view
}
// Keep for compatibility if needed, but we should switch to new function name in index_events
export const closeNewOpeningEditModal = closeNewOpeningEditView;

function renderNewOpeningEditList() {
    const list = $('#new-opening-edit-list');
    list.innerHTML = "";
    if (!newOpeningData || newOpeningData.length === 0) {
        list.innerHTML = `<p class="text-center text-slate-400 text-xs py-2">登録データはありません</p>`;
        return;
    }

    newOpeningData.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200";
        div.innerHTML = `
            <div class="truncate flex-1 mr-2">
                <span class="font-bold text-slate-700 text-sm">${item.name}</span>
                <span class="text-xs text-slate-400 ml-2">(${item.count}台)</span>
            </div>
            <div class="flex gap-1 shrink-0">
                <button class="bg-white border border-slate-200 text-indigo-600 px-2 py-1 rounded text-xs font-bold hover:bg-indigo-50 transition btn-edit-no" data-id="${item.id}">編集</button>
                <button class="bg-white border border-slate-200 text-rose-500 px-2 py-1 rounded text-xs font-bold hover:bg-rose-50 transition btn-del-no" data-id="${item.id}">削除</button>
            </div>
        `;
        list.appendChild(div);
    });

    list.querySelectorAll('.btn-edit-no').forEach(b => {
        b.addEventListener('click', (e) => editNewOpeningItem(e.target.dataset.id));
    });
    list.querySelectorAll('.btn-del-no').forEach(b => {
        b.addEventListener('click', (e) => deleteNewOpeningItem(e.target.dataset.id));
    });
}

function clearNewOpeningForm() {
    $('#no-edit-id').value = "";
    $('#no-edit-name').value = "";
    $('#no-edit-count').value = "";
    $('#no-edit-total').value = "";
    $('#no-edit-spec').value = "";
    $('#no-edit-image-url').value = "";
    currentEditingImages = [];
    renderEditingImages();
}

function editNewOpeningItem(id) {
    const item = newOpeningData.find(d => d.id === id);
    if (!item) return;

    $('#no-edit-id').value = item.id;
    $('#no-edit-name').value = item.name || "";
    $('#no-edit-count').value = item.count || "";
    $('#no-edit-total').value = item.totalCount || "";
    $('#no-edit-spec').value = item.spec || "";

    currentEditingImages = item.images ? [...item.images] : [];
    renderEditingImages();
}

export async function deleteNewOpeningItem(id) {
    if (!confirm("本当に削除しますか？")) return;
    try {
        await deleteDoc(doc(db, "newOpening", id));
        // Refresh data is handled by fetchCustomerData if we call it, or we should reload
        // Ideally we should use onSnapshot for realtime updates, but customer.js uses one-time fetch.
        // So we manually re-fetch.
        await fetchCustomerData();
        renderNewOpeningEditList();
        alert("削除しました");
    } catch(e) {
        alert("削除に失敗しました: " + e.message);
    }
}

export async function saveNewOpeningItem() {
    const id = $('#no-edit-id').value;
    const name = $('#no-edit-name').value.trim();
    if (!name) {
        alert("機種名は必須です");
        return;
    }

    const data = {
        name: name,
        count: parseInt($('#no-edit-count').value) || 0,
        totalCount: parseInt($('#no-edit-total').value) || 0,
        spec: $('#no-edit-spec').value || "",
        images: currentEditingImages,
        createdAt: new Date()
    };

    const btn = $('#no-edit-save-btn');
    btn.textContent = "保存中...";
    btn.disabled = true;

    try {
        if (id) {
            await setDoc(doc(db, "newOpening", id), data, { merge: true });
        } else {
            await addDoc(collection(db, "newOpening"), data);
        }
        await fetchCustomerData();
        renderNewOpeningEditList();
        clearNewOpeningForm();
        alert("保存しました");
    } catch(e) {
        console.error(e);
        alert("保存に失敗しました: " + e.message);
    } finally {
        btn.textContent = "保存する";
        btn.disabled = false;
    }
}

export async function handleNewOpeningImageSelect(input) {
    if (input.files && input.files[0]) {
        try {
            const base64 = await compressMapImage(input.files[0]);
            currentEditingImages.push(base64);
            renderEditingImages();
            input.value = ""; // Reset
        } catch(e) {
            alert(e.message);
        }
    }
}

export function handleAddNewUrl() {
    const url = $('#no-edit-image-url').value.trim();
    if (url) {
        currentEditingImages.push(url);
        renderEditingImages();
        $('#no-edit-image-url').value = "";
    }
}

function renderEditingImages() {
    const c = $('#no-edit-images-preview');
    c.innerHTML = "";
    currentEditingImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = "relative shrink-0 w-20 h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden group";
        div.innerHTML = `
            <img src="${img}" class="w-full h-full object-cover">
            <button class="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] rounded-bl opacity-0 group-hover:opacity-100 transition" onclick="removeNewOpeningImage(${idx})">✕</button>
        `;
        c.appendChild(div);
    });
}

// Global for inline onclick
window.removeNewOpeningImage = (idx) => {
    currentEditingImages.splice(idx, 1);
    renderEditingImages();
};

// --- Map Update Logic ---

export function fetchMapData() {
    try {
        const docRef = doc(db, "settings", "map_config");
        // Real-time listener for map updates (addresses caching/reload issues)
        onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.image_data) {
                    const img = $('#map-section img');
                    if(img) {
                        img.onload = () => {
                            img.classList.remove('hidden'); // Ensure visible on success
                            // Remove any existing error message sibling
                            const err = img.parentNode.querySelector('.map-error-msg');
                            if(err) err.remove();
                        };
                        img.onerror = () => {
                            img.classList.add('hidden'); // Hide broken image
                            // Check if error message already exists
                            if(!img.parentNode.querySelector('.map-error-msg')) {
                                const errDiv = document.createElement('div');
                                errDiv.className = 'map-error-msg h-full flex items-center justify-center text-slate-400 font-bold';
                                errDiv.textContent = 'マップ画像を読み込めませんでした';
                                img.parentNode.appendChild(errDiv);
                            }
                        };
                        img.src = data.image_data;
                        if(data.updated_at) {
                            // Timestamp for debugging/verification
                            img.setAttribute('data-last-updated', data.updated_at.seconds || Date.now());
                        }
                    }
                }
            }
        }, (error) => {
            console.warn("Map load failed (snapshot error), using default.", error);
        });
    } catch(e) {
        console.warn("Map listener setup failed.", e);
    }
}

let mapFileToSave = null;

export function openMapUpdateModal() {
    $('#map-update-view').classList.add('active');
    mapFileToSave = null;
    $('#map-file-input').value = "";
    $('#map-preview').src = "";
    $('#map-preview-container').classList.add('hidden');
    $('#map-current-preview').classList.remove('hidden');
    // Load current map into current preview
    const currentSrc = $('#map-section img').src;
    $('#map-current-preview-img').src = currentSrc;
}

export function closeMapUpdateModal() {
    $('#map-update-view').classList.remove('active');
}

export async function handleMapFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        mapFileToSave = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            $('#map-preview').src = e.target.result;
            $('#map-preview-container').classList.remove('hidden');
            $('#map-current-preview').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

export async function saveMapUpdate() {
    if (!mapFileToSave) {
        alert("画像が選択されていません。");
        return;
    }

    const btn = $('#btn-save-map');
    const originalText = btn.textContent;
    btn.textContent = "処理中...";
    btn.disabled = true;

    try {
        // Compress
        const base64 = await compressMapImage(mapFileToSave);

        // Validation: Ensure it's a valid image data URI
        if (!base64 || !base64.startsWith('data:image')) {
            throw new Error("画像の処理に失敗しました。有効な画像データではありません。");
        }

        // Save to Firestore
        await setDoc(doc(db, "settings", "map_config"), {
            image_data: base64,
            updated_at: new Date()
        });

        // Note: The onSnapshot listener in fetchMapData will automatically update the DOM.
        // We do NOT update locally to prevent race conditions with the listener.

        alert("マップを更新しました！");
        closeMapUpdateModal();

    } catch(e) {
        console.error(e);
        alert("更新に失敗しました: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
