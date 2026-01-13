import { db } from './firebase.js';
import { collection, addDoc, updateDoc, getDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal } from './ui.js';

let isChatOpen = false;
let currentContext = ""; // Not fully used in new mode but kept for chat compatibility
let contextImages = []; // Array of base64 strings
let currentCategory = "";
let chatHistory = []; // Conversation history for the current session

// Cache for swapping view
let currentSummaryShort = "";
let currentSummaryFull = "";

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

        // Reset UI every time it opens
        const messagesContainer = document.getElementById('ai-messages');
        messagesContainer.innerHTML = '';
        chatHistory = [];
        currentSummaryShort = "";
        currentSummaryFull = "";

        // Initial Status
        addMessageToUI("ai", "資料を確認しています...", true, "init-loading");

        if (category !== currentCategory) {
            currentCategory = category;
        }

        // NEW: Load Pre-computed Category Summary
        await loadCategorySummary(category, categoryName);

        // Remove initial loading message
        removeMessageUI("init-loading");

        // Update Status Text with Category Name
        const statusEl = document.getElementById('ai-status-text');
        if(statusEl) statusEl.textContent = `${categoryName}の資料を表示中`;

        // Add Admin Management Button dynamically if not exists
        let header = modal.querySelector('.border-b');
        if (!header.querySelector('.admin-knowledge-btn')) {
            const btn = document.createElement('button');
            btn.className = 'admin-knowledge-btn ml-auto mr-2 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400 transition';
            btn.innerHTML = '⚙️';
            btn.onclick = () => showPasswordModal(() => {
                window.openStrategyAdmin(category);
                closeAIChat();
            });
            // Insert before close button
            const closeBtn = header.querySelector('button:last-child');
            header.insertBefore(btn, closeBtn);
        }

    } else {
        // Clear UI when closing
        document.getElementById('ai-messages').innerHTML = '';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function closeAIChat() {
    isChatOpen = false;
    document.getElementById('ai-messages').innerHTML = '';
    document.getElementById('ai-chat-modal').classList.add('hidden');
    document.getElementById('ai-chat-modal').classList.remove('flex');
}

// --- Context & AI Logic ---

async function loadCategorySummary(category, categoryName) {
    const statusEl = document.getElementById('ai-status-text');
    if(statusEl) statusEl.textContent = "データを取得中...";

    try {
        // Fetch the summary doc
        const summaryDocRef = doc(db, "category_summaries", category);
        const summarySnap = await getDoc(summaryDocRef);

        let shortText = "現在、共有されている情報はありません。";
        let fullText = "現在、共有されている情報はありません。";

        if (summarySnap.exists()) {
            const data = summarySnap.data();
            shortText = data.short || shortText;
            fullText = data.full || fullText;
        }

        // Cache
        currentSummaryShort = shortText;
        currentSummaryFull = fullText;
        // Also set as context for Chat
        currentContext = fullText;

        // Initial Greeting
        addMessageToUI("ai", `🤖 **${categoryName}** の最新情報（直近のまとめ）です。`);

        // Display Short Summary
        addCustomHtmlMessage("ai", `
            <div id="ai-summary-content" class="text-sm text-slate-700 leading-relaxed">
                ${formatAIMessage(shortText)}
            </div>
            <div class="mt-4 pt-4 border-t border-slate-100">
                <button onclick="window.showFullSummary()" class="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition flex items-center justify-center gap-2">
                    <span>📅</span> 今後の予定・詳細をすべて見る
                </button>
            </div>
        `);

        if(statusEl) statusEl.textContent = `[${categoryName}] 最新サマリーを表示`;

    } catch (e) {
        console.error("Failed to load category summary:", e);
        if(statusEl) statusEl.textContent = "データ読み込みエラー";
        addMessageToUI("ai", "情報の取得に失敗しました。");
    }
}

// Function to swap to full summary
window.showFullSummary = () => {
    const container = document.getElementById('ai-summary-content');
    const button = document.querySelector('button[onclick="window.showFullSummary()"]');

    if (container) {
        // Apply transition effect
        container.style.opacity = '0';
        setTimeout(() => {
            container.innerHTML = formatAIMessage(currentSummaryFull);
            container.style.opacity = '1';
        }, 200);
    }

    if (button) {
        button.remove(); // Remove button after showing full
    }
};


// Helper for custom HTML messages (bypassing formatAIMessage for buttons)
function addCustomHtmlMessage(role, rawHtml) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `flex justify-start mb-4 animate-fade-in group`;

    div.innerHTML = `
        <div class="max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm bg-white text-slate-700 border border-slate-100 rounded-bl-none w-full">
            ${rawHtml}
        </div>
    `;

    container.appendChild(div);
    scrollToBottom();
}

export async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    // Add User Message to UI
    addMessageToUI("user", message);
    chatHistory.push({ role: 'user', parts: [{ text: message }] });

    const loadingId = addMessageToUI("ai", "考え中...", true);

    try {
        const payload = {
            prompt: message,
            contextData: currentContext, // Use full summary as context
            contextImages: contextImages,
            mode: 'chat',
            history: chatHistory,
            currentDate: new Date().toISOString().split('T')[0]
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        removeMessageUI(loadingId);

        let aiReply = "";
        if (data.error) {
            aiReply = "エラーが発生しました: " + data.error;
            addMessageToUI("ai", aiReply);
        } else {
            aiReply = data.reply;
            // Add AI Message to UI
            addMessageToUI("ai", aiReply);
            chatHistory.push({ role: 'model', parts: [{ text: aiReply }] });
        }

    } catch (e) {
        removeMessageUI(loadingId);
        addMessageToUI("ai", "通信エラーが発生しました。");
        console.error(e);
    }
}

function formatAIMessage(text) {
    if (!text) return "";
    let safeText = escapeHtml(text);

    // If no specific headers found, treat as standard text (but still apply inline formatting)
    if (!safeText.includes('## ')) {
         return safeText
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.+?)\*\*/g, '<span class="font-bold text-slate-900 bg-yellow-100 px-1 rounded shadow-sm border-b-2 border-yellow-200 mx-1">$1</span>');
    }

    const lines = safeText.split('\n');
    let introHtml = '';
    let timelineHtml = '';
    let currentCardContent = '';
    let currentCardTitle = '';
    let isInsideCard = false;

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('## ')) {
            // Close previous card
            if (isInsideCard) {
                timelineHtml += createCardHtml(currentCardTitle, currentCardContent);
            }
            // Start new card
            currentCardTitle = trimmed.replace(/^##\s+/, '');
            currentCardContent = '';
            isInsideCard = true;
        } else {
            if (isInsideCard) {
                currentCardContent += line + '\n';
            } else {
                // Content before the first header is displayed as standard text block
                if (trimmed) {
                    introHtml += `<div class="mb-4 leading-relaxed text-slate-700">${processInlineFormatting(line)}</div>`;
                }
            }
        }
    });

    // Close final card
    if (isInsideCard) {
        timelineHtml += createCardHtml(currentCardTitle, currentCardContent);
    }

    let finalHtml = introHtml;
    if (timelineHtml) {
        finalHtml += `<div class="relative border-l-4 border-indigo-100 ml-3 my-6 pr-2 space-y-8">${timelineHtml}</div>`;
    }

    return finalHtml;
}

function createCardHtml(title, contentRaw) {
    let processedContent = '';
    const lines = contentRaw.split('\n');

    lines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) return;

        // Alert Box (> ...)
        if (trimmed.startsWith('&gt; ')) {
             const alertText = trimmed.replace(/^&gt;\s+/, '');
             processedContent += `
                <div class="my-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r text-sm font-bold shadow-sm flex gap-3 items-start animate-pulse-subtle">
                    <span class="text-xl shrink-0">⚠️</span>
                    <span class="pt-0.5">${processInlineFormatting(alertText)}</span>
                </div>`;
        }
        // Sub-header (### ...)
        else if (trimmed.startsWith('### ')) {
            const subTitle = trimmed.replace(/^###\s+/, '');
            processedContent += `
                <div class="mt-4 mb-2 text-md font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    ${processInlineFormatting(subTitle)}
                </div>`;
        }
        // Standard Text
        else {
            processedContent += `<div class="mb-1.5 leading-relaxed text-slate-600 text-[15px]">${processInlineFormatting(line)}</div>`;
        }
    });

    return `
        <div class="relative pl-6 group">
            <!-- Timeline Dot -->
            <div class="absolute -left-[11px] top-1.5 w-5 h-5 rounded-full bg-white border-4 border-indigo-400 shadow-sm group-hover:border-indigo-600 transition-colors"></div>

            <!-- Header (Date) -->
            <h3 class="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2 group-hover:text-indigo-700 transition-colors">
                ${processInlineFormatting(title)}
            </h3>

            <!-- Content -->
            <div class="text-slate-600 pl-1">
                ${processedContent}
            </div>
        </div>
    `;
}

function processInlineFormatting(text) {
    if (!text) return "";
    return text.replace(/\*\*(.+?)\*\*/g, '<span class="font-bold text-slate-900 bg-yellow-100 px-1 rounded shadow-sm border-b-2 border-yellow-200 mx-1">$1</span>');
}

function addMessageToUI(role, text, isLoading = false, id = null) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    const divId = id ? id : "msg-" + Date.now();
    div.id = divId;

    const isUser = role === 'user';

    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in group`;

    // Use formatAIMessage for AI, simple escape for User
    let contentHtml = `
        <div class="max-w-[85%] p-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
            isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
        }">
            ${isUser ? escapeHtml(text).replace(/\n/g, '<br>') : formatAIMessage(text)}
        </div>
    `;

    div.innerHTML = `${contentHtml}`;

    container.appendChild(div);
    scrollToBottom();
    return divId;
}

function removeMessageUI(id) {
    const el = document.getElementById(id);
    if(el) el.remove();
}

function scrollToBottom() {
    const container = document.getElementById('ai-messages');
    if(container) container.scrollTop = container.scrollHeight;
}

// Global Expose
window.toggleAIChat = toggleAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
window.openCategoryChat = (category, name) => toggleAIChat(category, name);
window.showFullSummary = () => { /* Defined inside module but exposed for onclick */ };
