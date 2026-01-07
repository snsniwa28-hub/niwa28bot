import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

let isChatOpen = false;
let currentContext = "";
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
    // Pre-fetch context? Or fetch on open.
    // Let's fetch on open to be fresh.
}

export async function toggleAIChat(category = 'all', categoryName = '社内資料') {
    const modal = document.getElementById('ai-chat-modal');
    isChatOpen = !isChatOpen;

    if (isChatOpen) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Check if category changed or if it's the first load
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
        let q;
        if (category && category !== 'all') {
            // Filter by category
            // Note: Avoiding composite index error by doing client-side sort if needed.
            // For now, simply querying by category should be safe if we don't strictly require index-heavy sorting immediately
            // or if we have single field indexes.
            // However, to be safe and get latest, we query by category.
            // If index missing for category+updatedAt, we might need to fetch all for category and sort in JS.
            // Given the volume is likely low, client-side sort is acceptable.
            q = query(collection(db, "strategies"), where("category", "==", category));
        } else {
            // Default: Latest articles regardless of category
            q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(5));
        }

        const snapshot = await getDocs(q);

        let docs = snapshot.docs.map(doc => doc.data());

        // Client-side sort if filtered by category (to ensure latest)
        if (category && category !== 'all') {
            docs.sort((a, b) => {
                const dateA = a.updatedAt ? a.updatedAt.toDate() : new Date(0);
                const dateB = b.updatedAt ? b.updatedAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            // Limit to top 5
            docs = docs.slice(0, 5);
        }

        let combinedText = "";
        let titles = [];

        docs.forEach(data => {
            // Use ai_context if available, otherwise try to construct from blocks
            let text = "";
            if (data.ai_context) {
                text = data.ai_context;
            } else if (data.blocks) {
                // Fallback: simple join of text blocks
                text = data.blocks.map(b => b.text || "").join("\n");
            }

            if (text) {
                combinedText += `\n--- [${data.title}] ---\n${text}\n`;
                titles.push(data.title);
            }
        });

        currentContext = combinedText;
        contextTitle = titles.length > 0 ? titles.join(", ") : "なし";

        if(statusEl) {
            statusEl.textContent = titles.length > 0
                ? `[${categoryName}] 参照中: ${titles[0]} 他${titles.length-1}件`
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
        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: message,
                contextData: currentContext
            })
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
