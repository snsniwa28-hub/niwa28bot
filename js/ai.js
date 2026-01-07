import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

let isChatOpen = false;
let currentContext = "";
let contextImages = []; // Array of base64 strings
let contextTitle = "";
let currentCategory = "";

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function initAI() {
    // Init logic if needed
}

export async function toggleAIChat(category = 'all', categoryName = '社内資料') {
    const modal = document.getElementById('ai-chat-modal');
    isChatOpen = !isChatOpen;

    if (isChatOpen) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        if (category !== currentCategory || !currentContext) {
            await loadContext(category, categoryName);
        }
        scrollToBottom();
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function closeAIChat() {
    isChatOpen = false;
    document.getElementById('ai-chat-modal').classList.add('hidden');
    document.getElementById('ai-chat-modal').classList.remove('flex');
}

async function loadContext(category, categoryName) {
    currentCategory = category;
    const statusEl = document.getElementById('ai-status-text');
    if(statusEl) statusEl.textContent = `${categoryName}の資料を読み込み中...`;

    try {
        let docs = [];

        // 1. Load Knowledge Base (Long-term Memory) - Always include these if relevant or global?
        // The prompt implies "Knowledge Base" (isKnowledge: true) should always be referenced?
        // "AI Chat context generation... constructs its context window by merging two data sources: a 'Trend' query ... and a 'Knowledge Base' query" (from Memory)

        // Fetch Knowledge Base
        const qKnowledge = query(collection(db, "strategies"), where("isKnowledge", "==", true));
        const snapshotKnowledge = await getDocs(qKnowledge);
        const knowledgeDocs = snapshotKnowledge.docs.map(doc => doc.data());

        // 2. Load Trend/Category Base (Short-term Memory)
        let qTrend;
        if (category && category !== 'all') {
             qTrend = query(collection(db, "strategies"), where("category", "==", category));
        } else {
             qTrend = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(10));
        }

        const snapshotTrend = await getDocs(qTrend);
        let trendDocs = snapshotTrend.docs.map(doc => doc.data());

        // Sort Trend Docs client-side if needed (category query doesn't guarantee order without composite index)
        if (category && category !== 'all') {
            trendDocs.sort((a, b) => {
                const dateA = a.updatedAt ? a.updatedAt.toDate() : new Date(0);
                const dateB = b.updatedAt ? b.updatedAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            trendDocs = trendDocs.slice(0, 10); // Limit to top 10 trends
        }

        // Merge Unique Docs (by ID if we had ID, but we mapped to data. Let's merge lists)
        // Since we don't have IDs in the mapped object above easily without modifying map, let's just concatenate and dedupe by title/content hash if needed.
        // Or simpler: merge arrays.

        const allDocs = [...knowledgeDocs, ...trendDocs];
        // Deduplicate based on title for now (simple heuristic)
        const uniqueDocs = [];
        const seenTitles = new Set();
        allDocs.forEach(d => {
            if (!seenTitles.has(d.title)) {
                seenTitles.add(d.title);
                uniqueDocs.push(d);
            }
        });

        docs = uniqueDocs;

        let combinedText = "";
        let titles = [];
        let collectedImages = [];

        docs.forEach(data => {
            // Text Context
            let text = "";
            if (data.ai_context) {
                text = data.ai_context;
            } else if (data.blocks) {
                text = data.blocks.map(b => b.text || "").join("\n");
            }

            if (text) {
                combinedText += `\n--- [${data.title}] ${data.isKnowledge ? '(知識データ)' : ''} ---\n${text}\n`;
                titles.push(data.title);
            }

            // Image Context
            if (data.ai_images && Array.isArray(data.ai_images)) {
                collectedImages.push(...data.ai_images);
            }
        });

        // Limit images to max 10 to prevent request overflow
        if (collectedImages.length > 10) {
            collectedImages = collectedImages.slice(0, 10);
        }

        currentContext = combinedText;
        contextImages = collectedImages;
        contextTitle = titles.length > 0 ? titles.join(", ") : "なし";

        if(statusEl) {
            statusEl.textContent = titles.length > 0
                ? `[${categoryName}] 参照中: ${titles.length}件 (画像${contextImages.length}枚)`
                : `[${categoryName}] 参照可能な資料がありません`;
        }

    } catch (e) {
        console.error("Failed to load context:", e);
        if(statusEl) statusEl.textContent = "資料の読み込みに失敗しました";
    }
}

export async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    // Add User Message
    addMessageToUI("user", message);
    input.value = "";

    // Show Loading
    const loadingId = addMessageToUI("ai", "考え中...", true);

    try {
        const payload = {
            prompt: message,
            contextData: currentContext,
            contextImages: contextImages // Send collected images
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Remove loading
        removeMessageUI(loadingId);

        if (data.error) {
            addMessageToUI("ai", "エラーが発生しました: " + data.error);
        } else {
            addMessageToUI("ai", data.reply);
        }

    } catch (e) {
        removeMessageUI(loadingId);
        addMessageToUI("ai", "通信エラーが発生しました。");
        console.error(e);
    }
}

function addMessageToUI(role, text, isLoading = false) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    const id = "msg-" + Date.now();
    div.id = id;

    const isUser = role === 'user';

    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`;

    let contentHtml = `
        <div class="max-w-[80%] p-3 rounded-2xl text-sm font-bold leading-relaxed shadow-sm ${
            isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
        }">
            ${escapeHtml(text).replace(/\n/g, '<br>')}
        </div>
    `;

    div.innerHTML = contentHtml;
    container.appendChild(div);
    scrollToBottom();
    return id;
}

function removeMessageUI(id) {
    const el = document.getElementById(id);
    if(el) el.remove();
}

function scrollToBottom() {
    const container = document.getElementById('ai-messages');
    container.scrollTop = container.scrollHeight;
}

// Global Expose
window.toggleAIChat = toggleAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
