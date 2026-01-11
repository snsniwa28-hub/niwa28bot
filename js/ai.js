import { db } from './firebase.js';
import { collection, addDoc, updateDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal, showPasswordModal } from './ui.js';

let isChatOpen = false;
let currentContext = "";
let contextImages = []; // Array of base64 strings
let currentCategory = "";
let chatHistory = []; // Conversation history for the current session

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

        // Initial Status
        addMessageToUI("ai", "資料を確認しています...", true, "init-loading");

        if (category !== currentCategory) {
            currentCategory = category;
        }

        // Load Context (Knowledge Base only)
        await loadContext(category, categoryName);

        // Remove initial loading message
        removeMessageUI("init-loading");

        // Trigger Auto Summary
        await generateAutoSummary();

        // Update Status Text with Category Name
        const statusEl = document.getElementById('ai-status-text');
        if(statusEl) statusEl.textContent = `${categoryName}の資料を読み込み中...`;

        // Add Admin Management Button dynamically if not exists
        let header = modal.querySelector('.border-b');
        if (!header.querySelector('.admin-knowledge-btn')) {
            const btn = document.createElement('button');
            btn.className = 'admin-knowledge-btn ml-auto mr-2 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400 transition';
            btn.innerHTML = '⚙️';
            btn.onclick = () => showPasswordModal(() => {
                // Open Strategy Admin in Knowledge Mode
                window.openStrategyAdmin(category);
                // We might want to close chat or keep it open?
                // Let's close chat to avoid overlay issues, or just open modal above.
                // The strategy modal has z-index 90, chat has 100.
                // We need to close chat to see strategy modal properly OR strategy modal needs higher Z.
                // Strategy modal uses z-90. Chat uses z-100.
                // If we open strategy modal, it will be behind chat.
                // So we should close chat.
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

async function loadContext(category, categoryName) {
    const statusEl = document.getElementById('ai-status-text');
    if(statusEl) statusEl.textContent = "記憶データを構築中...";

    try {
        let knowledgeText = "";
        let collectedImages = [];
        let titles = [];

        // 1. Load Knowledge Base (Scoped by Category)
        const qKnowledge = query(
            collection(db, "strategies"),
            where("isKnowledge", "==", true)
        );

        const snapshotKnowledge = await getDocs(qKnowledge);
        let knowledgeDocs = snapshotKnowledge.docs.map(doc => doc.data());

        if (category && category !== 'all') {
            knowledgeDocs = knowledgeDocs.filter(d => d.category === category);
        }

        // Construct Knowledge Text
        knowledgeDocs.forEach(data => {
            let text = "";
            if (data.ai_context) {
                text = data.ai_context;
            } else if (data.blocks) {
                text = data.blocks.map(b => b.text || "").join("\n");
            }

            if (text) {
                knowledgeText += `\n--- [${data.title}] ---\n${text}\n`;
                titles.push(data.title);
            }
            if (data.ai_images && Array.isArray(data.ai_images)) {
                collectedImages.push(...data.ai_images);
            }
        });

        // 2. No History Loading (Ephemeral)

        // 3. Combine
        let combinedText = "";
        if (knowledgeText) {
            combinedText += `=== 社内資料 (Knowledge) ===\n${knowledgeText}\n\n`;
        }

        currentContext = combinedText;
        contextImages = collectedImages.slice(0, 10); // Max 10 images

        if(statusEl) {
             statusEl.textContent = `[${categoryName}] 知識:${titles.length}件 参照中`;
        }

    } catch (e) {
        console.error("Failed to load context:", e);
        if(statusEl) statusEl.textContent = "データ読み込みエラー";
    }
}

async function generateAutoSummary() {
    const loadingId = addMessageToUI("ai", "資料を分析して要約を作成中...", true);

    try {
        const payload = {
            prompt: "要約をお願いします",
            contextData: currentContext,
            contextImages: contextImages,
            mode: 'summary',
            currentDate: new Date().toISOString().split('T')[0]
        };

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        removeMessageUI(loadingId);

        if (data.error) {
            addMessageToUI("ai", "要約の作成に失敗しました: " + data.error);
        } else {
            const reply = data.reply;
            // Save to history so AI knows what it already told the user
            chatHistory.push({ role: 'model', parts: [{ text: reply }] });
            addMessageToUI("ai", reply);
        }
    } catch (e) {
        removeMessageUI(loadingId);
        console.error("Summary error:", e);
        addMessageToUI("ai", "要約の生成に失敗しました。");
    }
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
            contextData: currentContext,
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

    // Headers (## Title) - Larger, colored, with spacing
    safeText = safeText.replace(/^##\s+(.+)$/gm, '<div class="text-lg font-bold text-indigo-600 mt-3 mb-1 border-b border-indigo-100 pb-1">$1</div>');

    // Bold (**Text**) - Darker and heavier
    safeText = safeText.replace(/\*\*(.+?)\*\*/g, '<span class="font-extrabold text-slate-900 bg-slate-50 px-1 rounded">$1</span>');

    // Newlines
    safeText = safeText.replace(/\n/g, '<br>');

    return safeText;
}

function addMessageToUI(role, text, isLoading = false, id = null) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    const divId = id ? id : "msg-" + Date.now();
    div.id = divId;

    const isUser = role === 'user';

    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in group`;

    // Use formatAIMessage for AI, simple escape for User
    // Changed base font to font-medium for better contrast with bold elements
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

// Utility to delete all logs (Available via console for admin maintenance)
window.emergencyDeleteAllLogs = async () => {
    if (!confirm("【警告】過去のすべての会話ログを削除しますか？\nこの操作は取り消せません。")) return;

    console.log("Starting log deletion...");
    try {
        // Since we can't delete collection directly from client SDK efficiently without cloud functions,
        // we have to batch delete.
        const q = query(collection(db, "ai_chat_logs"), limit(500));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No logs found.");
            alert("削除対象のログはありませんでした。");
            return;
        }

        const batchSize = snapshot.size;
        let count = 0;
        const deletePromises = [];

        snapshot.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
            count++;
        });

        await Promise.all(deletePromises);
        console.log(`Deleted ${count} logs.`);

        if (batchSize === 500) {
             alert(`500件削除しました。まだ残っている可能性があるため、再度実行してください。`);
        } else {
             alert(`完了: ${count}件のログを削除しました。`);
        }

    } catch (e) {
        console.error(e);
        alert("削除中にエラーが発生しました: " + e.message);
    }
};

// Global Expose
window.toggleAIChat = toggleAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
window.openCategoryChat = (category, name) => toggleAIChat(category, name);
