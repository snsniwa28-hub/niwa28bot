import { db } from './firebase.js';
import { collection, addDoc, updateDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal } from './ui.js';

let isChatOpen = false;
let currentContext = "";
let contextImages = []; // Array of base64 strings
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

        // Reset UI every time it opens
        const messagesContainer = document.getElementById('ai-messages');
        messagesContainer.innerHTML = '';

        // Add Default Greeting
        addMessageToUI("ai", "資料に基づいて回答します。ご質問をどうぞ。");

        if (category !== currentCategory) {
            currentCategory = category;
        }

        // Load Context (Knowledge Base only)
        await loadContext(category, categoryName);

        // Update Status Text with Category Name
        const statusEl = document.getElementById('ai-status-text');
        if(statusEl) statusEl.textContent = `${categoryName}の資料を読み込み中...`;

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

export async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = "";

    // Add User Message to UI (Ephemeral)
    addMessageToUI("user", message);

    const loadingId = addMessageToUI("ai", "考え中...", true);

    try {
        const payload = {
            prompt: message,
            contextData: currentContext,
            contextImages: contextImages
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
            // Add AI Message to UI (Ephemeral)
            addMessageToUI("ai", aiReply);
        }

    } catch (e) {
        removeMessageUI(loadingId);
        addMessageToUI("ai", "通信エラーが発生しました。");
        console.error(e);
    }
}

function addMessageToUI(role, text, isLoading = false, id = null) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    const divId = id ? id : "msg-" + Date.now();
    div.id = divId;

    const isUser = role === 'user';

    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in group`;

    let contentHtml = `
        <div class="max-w-[80%] p-3 rounded-2xl text-sm font-bold leading-relaxed shadow-sm ${
            isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
        }">
            ${escapeHtml(text).replace(/\n/g, '<br>')}
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
