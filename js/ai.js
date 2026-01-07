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
        // Query A: Trend (Latest items)
        let qTrend;
        if (category && category !== 'all') {
            // Client-side sort for specific category to avoid composite index requirement
            qTrend = query(collection(db, "strategies"), where("category", "==", category), limit(50));
        } else {
            // Global trend: use index on updatedAt
            qTrend = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(10));
        }

        // Query B: Knowledge Base (Long-term memory)
        // Fetch all knowledge items (limit 100 for safety)
        const qKnowledge = query(collection(db, "strategies"), where("isKnowledge", "==", true), limit(100));

        // Execute parallel
        const [snapTrend, snapKnowledge] = await Promise.all([
            getDocs(qTrend),
            getDocs(qKnowledge)
        ]);

        let trendDocs = snapTrend.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let knowledgeDocs = snapKnowledge.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Post-process Trend Docs (Sort & Limit)
        if (category && category !== 'all') {
            trendDocs.sort((a, b) => {
                const dateA = a.updatedAt ? a.updatedAt.toDate() : new Date(0);
                const dateB = b.updatedAt ? b.updatedAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            trendDocs = trendDocs.slice(0, 10);
        }

        // === Construct Context ===
        let knowledgeText = "";
        let knowledgeCount = 0;
        const knowledgeIds = new Set();

        knowledgeDocs.forEach(data => {
            const text = getStrategyText(data);
            if (text) {
                knowledgeText += `[タイトル: ${data.title}]\n${text}\n\n`;
                knowledgeCount++;
                knowledgeIds.add(data.id);
            }
        });

        let trendText = "";
        let trendCount = 0;
        let trendTitles = [];

        trendDocs.forEach(data => {
            if (knowledgeIds.has(data.id)) return; // Avoid duplicates

            const text = getStrategyText(data);
            if (text) {
                trendText += `[タイトル: ${data.title}]\n${text}\n\n`;
                trendCount++;
                trendTitles.push(data.title);
            }
        });

        // Merge Texts
        let combinedText = "";
        if (knowledgeText) {
            combinedText += "=== 【重要】知識ベース（マニュアル・規定・基本戦略） ===\n" + knowledgeText + "\n";
        }
        if (trendText) {
            combinedText += "=== 直近の共有事項（トレンド） ===\n" + trendText;
        }

        // Safety Truncate (approx 500k chars)
        if (combinedText.length > 500000) {
            combinedText = combinedText.substring(0, 500000) + "\n...(truncated)...";
        }

        currentContext = combinedText;

        // UI Feedback
        if(statusEl) {
            const totalCount = knowledgeCount + trendCount;
            if (totalCount > 0) {
                statusEl.textContent = `[${categoryName}] 知識:${knowledgeCount}件 / 最新:${trendCount}件 を参照中`;
            } else {
                statusEl.textContent = `[${categoryName}] 参照可能な資料がありません`;
            }
        }

    } catch (e) {
        console.error("Failed to load context:", e);
        if(statusEl) statusEl.textContent = "資料の読み込みに失敗しました";
    }
}

function getStrategyText(data) {
    let text = "";
    if (data.ai_context) {
        text = data.ai_context;
    } else if (data.blocks) {
        text = data.blocks.map(b => b.text || "").join("\n");
    }
    return text;
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
