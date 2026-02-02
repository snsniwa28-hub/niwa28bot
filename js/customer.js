import { db } from './firebase.js';
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { latestKeywords } from './config.js';
import { $, compressMapImage } from './utils.js';

let allMachines = [];
let newOpeningData = [];
let eventMap = new Map();

export async function fetchCustomerData() {
    try {
        const [mSnap, nSnap, cSnap] = await Promise.all([
            getDocs(collection(db, "machines")),
            getDocs(collection(db, "newOpening")),
            getDocs(collection(db, "calendar"))
        ]);
        allMachines = mSnap.docs.map(d => d.data()).sort((a, b) => a.name.localeCompare(b.name));
        newOpeningData = nSnap.docs.map(d => d.data());
        eventMap = new Map(cSnap.docs.map(d => d.data()).sort((a, b) => a.date - b.date).map(e => [e.date, e]));
        renderToday();
        updateNewOpeningCard();
        fetchMapData(); // Load Map
    } catch (e) {
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

    if (!newOpeningData || newOpeningData.length === 0) {
        // Disable
        cardLink.classList.add('opacity-50', 'pointer-events-none', 'bg-slate-50');
        cardLink.classList.remove('bg-white', 'hover:-translate-y-1', 'hover:shadow-xl', 'cursor-pointer');
        cardLink.removeAttribute('href');

        if (title) {
            title.textContent = "情報は現在ありません";
            title.classList.remove('group-hover:text-indigo-600');
            title.classList.add('text-slate-400');
        }

        if (sub) sub.textContent = "Coming Soon...";

        // Icon styles (Indigo -> Gray)
        if (iconContainer) {
            iconContainer.classList.remove('bg-indigo-50', 'text-indigo-600', 'group-hover:bg-indigo-600');
            iconContainer.classList.add('bg-slate-100', 'text-slate-400');
        }

    } else {
        // Enable (Reset to original state)
        cardLink.classList.remove('opacity-50', 'pointer-events-none', 'bg-slate-50');
        cardLink.classList.add('bg-white', 'hover:-translate-y-1', 'hover:shadow-xl', 'cursor-pointer');
        cardLink.setAttribute('href', '#new-opening-section');

        if (title) {
            title.textContent = "新装開店";
            title.classList.add('group-hover:text-indigo-600');
            title.classList.remove('text-slate-400');
        }

        if (sub) sub.textContent = "最新機種情報";

        // Icon styles restore
        if (iconContainer) {
            iconContainer.classList.add('bg-indigo-50', 'text-indigo-600', 'group-hover:bg-indigo-600');
            iconContainer.classList.remove('bg-slate-100', 'text-slate-400');
        }
    }
}

export function openNewOpening() {
    const c = $('#newOpeningInfo');
    c.innerHTML = "";
    if (!newOpeningData || !newOpeningData.length) {
        // Though the card is disabled, keep this check for direct calls
        c.innerHTML = "<p class='text-center text-slate-400 py-10'>データなし</p>";
        $('#new-opening-view').classList.add("active");
        return;
    }

    const lat=[], oth=[];
    const validData = newOpeningData.filter(d => d && d.name);
    validData.forEach(m => (latestKeywords.some(k=>m.name.includes(k))?lat:oth).push(m));

    const createList = (list, title) => {
        if(!list.length) return;
        const section = document.createElement("div");
        section.innerHTML = `<h3 class="font-bold text-lg mb-2 border-b pb-1">${title}</h3>`;
        const ul = document.createElement("ul");
        ul.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8";

        list.sort((a,b)=>b.count-a.count).forEach(item => {
            const li = document.createElement("li");
            li.className = "bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm cursor-pointer hover:bg-slate-50 transition";

            const norm = (s) => (s||"").replace(/\s+/g, '').toLowerCase();
            const targetName = norm(item.name);
            const matched = allMachines.find(m => m && m.name && (norm(m.name).includes(targetName) || targetName.includes(norm(m.name))));
            const hasDetail = matched && matched.salesPitch;

            li.innerHTML = `<div class="flex flex-col overflow-hidden mr-2 pointer-events-none"><span class="font-bold text-slate-700 truncate text-sm sm:text-base">${item.name}</span>${hasDetail?`<span class="text-xs text-indigo-500 font-bold mt-1">✨ 詳細あり</span>`:`<span class="text-xs text-slate-400 font-medium mt-1">情報なし</span>`}</div><span class="text-xs font-black bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shrink-0 pointer-events-none">${item.count}台</span>`;

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                if(hasDetail) {
                    try {
                        $('#detailName').textContent = matched.name;
                        $('#detailPitch').textContent = matched.salesPitch || "情報なし";
                        const f=(i,l)=>{
                            $(i).innerHTML="";
                            const list = Array.isArray(l) ? l : [l || "情報なし"];
                            list.forEach(t=>$(i).innerHTML+=`<li class="flex items-start"><span class="mr-2 mt-1.5 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span><span>${t}</span></li>`);
                        };
                        f("#detailPros", matched.pros);
                        f("#detailCons", matched.cons);
                        $('#machineDetailModal').classList.remove("hidden");
                    } catch(err) {
                        alert("データ表示中にエラーが発生しました。");
                    }
                } else {
                    alert(`「${item.name}」の詳細データは見つかりませんでした。\n管理者に機種データの登録を確認してください。`);
                }
            });
            ul.appendChild(li);
        });
        section.appendChild(ul);
        c.appendChild(section);
    };
    createList(lat, "✨ 最新導入"); createList(oth, "🔄 その他");
    $('#new-opening-view').classList.add('active');
}

export function closeNewOpeningModal() {
    $('#new-opening-view').classList.remove('active');
}

export function closeDetailModal() {
    $('#machineDetailModal').classList.add('hidden');
}

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
