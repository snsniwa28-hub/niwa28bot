import { db, app } from './firebase.js';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal, showLoadingOverlay, hideLoadingOverlay, showImageViewer } from './ui.js';
import { parseFile } from './file_parser.js';

// --- State ---
let strategies = [];
let editingId = null;
let currentCategory = 'all'; // Legacy support
let isStrategyAdmin = false;
let isKnowledgeMode = false;
let tempPdfImages = [];
let knowledgeFilter = 'all';

export function setKnowledgeFilter(filter) {
    knowledgeFilter = filter;
    renderStrategyList();
}

// --- Firestore Operations ---
export async function loadStrategies() {
    const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStrategyList();
}

async function updateCategorySummary(category_ignored) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        const validDocs = snapshot.docs.map(d => d.data()).filter(d => d.title);

        if (validDocs.length === 0) {
             await setDoc(doc(db, "category_summaries", "unified"), {
                short: "現在、共有されている情報はありません。",
                full: "現在、共有されている情報はありません。",
                updatedAt: serverTimestamp()
            });
            return;
        }

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

            await setDoc(doc(db, "category_summaries", "unified"), {
                short: summaryData.short || "",
                full: summaryData.full || "",
                ai_images: aggregatedImages,
                updatedAt: serverTimestamp()
            });
        }

    } catch (e) {
        console.error("Summary Update Failed:", e);
        showToast("サマリー更新に失敗しました");
        throw e; // Propagate error for caller handling
    }
}

export async function manualUpdateSummary() {
    showConfirmModal("AIサマリー更新", "現在の知識データに基づいて、AIサマリーを再生成しますか？\n(少し時間がかかります)", async () => {
        try {
            showLoadingOverlay("AIがサマリーを生成中...");
            await updateCategorySummary('unified');
            showToast("サマリーを更新しました");
        } catch(e) {
            console.error(e);
            // Error toast handled in updateCategorySummary or here
        } finally {
            hideLoadingOverlay();
        }
    });
}

export async function saveKnowledge() {
    const categorySelect = document.getElementById('ka-category');
    const titleInput = document.getElementById('ka-title');
    const textInput = document.getElementById('ka-text');

    const category = categorySelect.value;
    const title = titleInput.value.trim();
    const text = textInput.value.trim();

    if (!category) {
        alert("カテゴリを選択してください");
        categorySelect.focus();
        return;
    }
    if (!text && tempPdfImages.length === 0) {
        alert("知識・メモを入力するか、ファイルを添付してください");
        textInput.focus();
        return;
    }

    showLoadingOverlay("AIが学習中...");

    let data = {
        title: title || `【${category}】共有事項`,
        category: category,
        text_content: text,
        ai_images: tempPdfImages.slice(0, 10), // Store up to 10 images
        isKnowledge: true,
        updatedAt: serverTimestamp(),
        author: "Admin"
    };

    try {
        // AI Analysis for Summary/Tags
        const payload = {
            prompt: data.title,
            contextData: text,
            contextImages: data.ai_images,
            mode: 'analyze_strategy'
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resData = await response.json();

        let aiSummary = "AI解析応答なし";
        if (resData.reply) {
             try {
                let cleanJson = resData.reply.trim().replace(/^```(json)?/, '').replace(/```$/, '').trim();
                const jsonStart = cleanJson.indexOf('{');
                const jsonEnd = cleanJson.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);

                const analysis = JSON.parse(cleanJson);
                if (analysis) {
                    data.relevant_date = analysis.relevant_date || null;
                    aiSummary = analysis.ai_summary || "要約なし";
                }
             } catch(e) {
                 console.warn("JSON Parse Failed", e);
                 aiSummary = resData.reply.substring(0, 100) + "...";
             }
        }
        data.ai_summary = aiSummary;

        const docRef = collection(db, "strategies");
        await addDoc(docRef, data); // Always new doc

        await updateCategorySummary('unified');

        showToast("✅ 保存完了");
        closeKnowledgeAddModal();
        loadStrategies();

    } catch (e) {
        console.error(e);
        alert("保存エラー: " + e.message);
    } finally {
        hideLoadingOverlay();
    }
}

async function addDoc(collectionRef, data) {
    const docRef = doc(collectionRef);
    await setDoc(docRef, data);
}

export async function deleteStrategy(id) {
    showConfirmModal("削除確認", "この知識データを削除しますか？", async () => {
        try {
            showLoadingOverlay("削除処理中...");
            await deleteDoc(doc(db, "strategies", id));
            await updateCategorySummary('unified');
            showToast("削除しました");
            loadStrategies();
        } catch(e) {
            console.error(e);
            showToast("削除エラー");
        } finally {
            hideLoadingOverlay();
        }
    });
}

// --- Detail & Edit Logic ---

export function openStrategyDetail(id) {
    const item = strategies.find(s => s.id === id);
    if (!item) return;

    editingId = id;

    // Populate Modal
    document.getElementById('kd-id').value = id;
    document.getElementById('kd-category').value = item.category || 'strategy';
    document.getElementById('kd-date').value = item.relevant_date || '';
    document.getElementById('kd-title').value = item.title || '';
    document.getElementById('kd-summary').value = item.ai_summary || '';
    document.getElementById('kd-text').value = item.text_content || '';

    // Images
    const imgContainer = document.getElementById('kd-images-list');
    imgContainer.innerHTML = '';
    if (item.ai_images && item.ai_images.length > 0) {
        item.ai_images.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = "h-14 w-14 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition";
            img.onclick = () => showImageViewer([url]);
            imgContainer.appendChild(img);
        });
    } else {
        imgContainer.innerHTML = '<span class="text-xs text-slate-400 font-bold">画像なし</span>';
    }

    document.getElementById('knowledge-detail-modal').classList.remove('hidden');
}

export function closeStrategyDetailModal() {
    document.getElementById('knowledge-detail-modal').classList.add('hidden');
    editingId = null;
}

export async function updateStrategyDetail() {
    if (!editingId) return;

    const category = document.getElementById('kd-category').value;
    const date = document.getElementById('kd-date').value;
    const title = document.getElementById('kd-title').value;
    const summary = document.getElementById('kd-summary').value;
    const text = document.getElementById('kd-text').value;

    try {
        showLoadingOverlay("更新中...");

        await updateDoc(doc(db, "strategies", editingId), {
            category: category,
            relevant_date: date,
            title: title,
            ai_summary: summary,
            text_content: text,
            updatedAt: serverTimestamp() // Update timestamp to bring to top? Or keep original? Usually update brings to top.
        });

        // Trigger AI Summary update
        await updateCategorySummary('unified');

        showToast("✅ 更新完了");
        closeStrategyDetailModal();
        loadStrategies();

    } catch(e) {
        console.error(e);
        showToast("更新失敗: " + e.message);
    } finally {
        hideLoadingOverlay();
    }
}


// --- UI Rendering ---

export function openInternalSharedModal(category = 'unified') {
    // This is now the "Knowledge Station" view
    isKnowledgeMode = true; // Always in management/list mode
    const view = document.getElementById('internal-shared-view');
    view.classList.add('active');
    loadStrategies();
}

export function openKnowledgeAddModal() {
    const modal = document.getElementById('knowledge-add-modal');
    modal.classList.remove('hidden');

    // Reset Form
    document.getElementById('ka-category').value = "";
    document.getElementById('ka-title').value = "";
    document.getElementById('ka-text').value = "";
    document.getElementById('ka-file').value = "";
    document.getElementById('ka-file-status').textContent = "";
    tempPdfImages = [];
}

export function closeKnowledgeAddModal() {
    document.getElementById('knowledge-add-modal').classList.add('hidden');
}

function renderStrategyList() {
    const container = document.getElementById('strategy-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (strategies.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50">
            <span class="text-4xl mb-2">📭</span>
            <p class="text-sm font-bold text-slate-400">まだ知識データがありません</p>
        </div>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

    // Filtering logic
    const filtered = strategies.filter(s => {
        if (knowledgeFilter === 'all') return true;
        return s.category === knowledgeFilter;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-50">
            <span class="text-4xl mb-2">🔍</span>
            <p class="text-sm font-bold text-slate-400">該当する知識データがありません</p>
        </div>`;
        return;
    }

    filtered.forEach(item => {
        const date = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleDateString() : '---';

        const card = document.createElement('div');
        // Mobile UI Optimization: Increased padding, adjusted shadows
        card.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition active:scale-[0.98] cursor-pointer group";

        // Interaction: Card click opens detail
        card.addEventListener('click', (e) => {
            // Prevent if clicking specific buttons (handled inside)
            openStrategyDetail(item.id);
        });

        const teamMap = { 'pachinko': 'パチンコ', 'slot': 'スロット', 'strategy': '戦略' };
        const teamName = teamMap[item.category] || item.category || '未分類';
        let badgeColor = "bg-slate-100 text-slate-600";
        if (item.category === 'pachinko') badgeColor = "bg-pink-50 text-pink-600";
        if (item.category === 'slot') badgeColor = "bg-purple-50 text-purple-600";
        if (item.category === 'strategy') badgeColor = "bg-red-50 text-red-600";

        let thumbnailHtml = '';
        if (item.ai_images && item.ai_images.length > 0) {
            // Mobile Optimization: Fixed aspect ratio
            const imgContainer = document.createElement('div');
            imgContainer.className = "h-40 sm:h-32 bg-slate-100 relative overflow-hidden shrink-0";

            const img = document.createElement('img');
            img.src = item.ai_images[0];
            img.className = "w-full h-full object-cover transition duration-500";

            // Interaction: Image click opens viewer
            imgContainer.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop card click
                showImageViewer(item.ai_images);
            });

            const badge = document.createElement('div');
            badge.className = "absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm";
            badge.textContent = `📷 ${item.ai_images.length}`;

            imgContainer.appendChild(img);
            imgContainer.appendChild(badge);

            card.appendChild(imgContainer);
        } else {
             // Placeholder for layout stability (Optional, but requested "consideration")
             // Actually, cleaner design might just skip image area to show more text
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = "p-4 sm:p-5 flex-1 flex flex-col gap-3";

        // Header line
        const headerDiv = document.createElement('div');
        headerDiv.className = "flex items-center gap-2";
        headerDiv.innerHTML = `<span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded-lg font-bold shrink-0">${teamName}</span><span class="text-[10px] text-slate-400 font-bold ml-auto">${date}</span>`;

        // Title: text-pretty, break-words
        const titleEl = document.createElement('h3');
        titleEl.className = "font-black text-slate-800 text-sm sm:text-base leading-relaxed text-pretty break-words";
        titleEl.textContent = item.title;

        // Summary/Content: text-pretty, leading-relaxed
        const descEl = document.createElement('p');
        descEl.className = "text-xs sm:text-sm text-slate-500 line-clamp-3 leading-loose text-pretty break-words flex-1";
        descEl.textContent = item.ai_summary || item.text_content || '(内容なし)';

        // Footer Actions
        const footerDiv = document.createElement('div');
        footerDiv.className = "flex justify-end pt-3 border-t border-slate-50 mt-auto";

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "text-xs font-bold text-slate-300 hover:text-rose-500 p-2 -mr-2 rounded-lg transition z-10";
        deleteBtn.textContent = "削除";
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteStrategy(item.id);
        });

        footerDiv.appendChild(deleteBtn);

        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(titleEl);
        contentDiv.appendChild(descEl);
        contentDiv.appendChild(footerDiv);

        card.appendChild(contentDiv);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// --- Global Handlers ---
export const handleContextFileUpload = async (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const statusEl = document.getElementById('ka-file-status');

        if(statusEl) statusEl.textContent = '読み込み中...';
        tempPdfImages = [];

        try {
            const { text, images, pageCount } = await parseFile(file);

            // Append parsed text to textarea if empty or append
            const textarea = document.getElementById('ka-text');
            if(text && textarea) {
                textarea.value = (textarea.value ? textarea.value + "\n\n" : "") + text;
            }

            tempPdfImages = images || [];

            let statusText = '✅ ' + file.name;
            if (file.name.toLowerCase().endsWith('.pdf')) {
                statusText += ` (${pageCount}P / 画像${tempPdfImages.length}枚)`;
            } else {
                 statusText += ` (画像${tempPdfImages.length}枚)`;
            }
            if(statusEl) statusEl.textContent = statusText;

        } catch (e) {
            console.error(e);
            alert("読み込み失敗: " + e.message);
            if(statusEl) statusEl.textContent = 'エラー';
        }
    }
};

export async function checkAndTriggerDailyUpdate() {
    try {
        const docRef = doc(db, "category_summaries", "unified");
        const docSnap = await getDoc(docRef);
        let needsUpdate = false;

        if (!docSnap.exists()) {
            needsUpdate = true;
        } else {
            const data = docSnap.data();
            if (!data.updatedAt) needsUpdate = true;
            else {
                const updatedTime = data.updatedAt.toDate().getTime();
                const todayStart = new Date().setHours(0,0,0,0);
                if (updatedTime < todayStart) needsUpdate = true;
            }
            if (data.short === "現在、共有されている情報はありません。") needsUpdate = true;
        }

        if (needsUpdate) {
            // Only update if triggered by morning logic, mostly handled by manual push now
            // But preserving "おはよう" feature
            const overlay = document.createElement('div');
            overlay.className = "fixed inset-0 z-[9999] bg-slate-100 flex flex-col items-center justify-center transition-opacity duration-500";
            overlay.innerHTML = `<h2 class="text-xl font-bold text-slate-700 animate-pulse">おはようございます<br>本日の情報を準備中...</h2>`;
            document.body.appendChild(overlay);
            await updateCategorySummary('unified');
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        }
    } catch (e) {
        console.error("Daily Check Error:", e);
    }
}

export function initStrategy() {
    loadStrategies();
    // Event listeners are set in index_events.js usually, but we ensure global functions are ready.
}
