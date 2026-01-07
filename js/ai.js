import { db } from './firebase.js';
import { collection, addDoc, updateDoc, getDocs, query, orderBy, limit, where, serverTimestamp, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showConfirmModal } from './ui.js';

let isChatOpen = false;
let currentContext = ""; // This will now contain structured context (or JSON string, or keep as plain text?)
// To minimize changes in gemini.js payload structure if possible, I'll keep currentContext as a string
// but structured: "=== Knowledge ===\n...\n=== History ===\n..."
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

        if (category !== currentCategory) {
            currentCategory = category;
            document.getElementById('ai-messages').innerHTML = ''; // Clear previous messages
            await fetchChatHistory(category);
            await loadContext(category, categoryName);
        } else {
            // Re-fetch context even if same category to include latest history if any new messages were added elsewhere?
            // Or just check if context needs update. For now, fetch to ensure "History" in context is up to date.
            // However, fetching history for UI vs fetching history for Context are slightly different (UI needs structure, Context needs text).
            // Let's reload context to be safe.
             await loadContext(category, categoryName);

             // Check if UI is empty (first load of this category in this session)
             const container = document.getElementById('ai-messages');
             if (container.children.length === 0) {
                 await fetchChatHistory(category);
             }
        }

        // Update Status Text with Category Name
        const statusEl = document.getElementById('ai-status-text');
        if(statusEl) statusEl.textContent = `${categoryName}の資料を読み込み中...`;

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

// --- Chat History Management ---

async function fetchChatHistory(category) {
    try {
        const q = query(
            collection(db, "ai_chat_logs"),
            where("category", "==", category),
            where("isDeleted", "==", false),
            orderBy("timestamp", "asc"),
            limit(100) // Reasonable limit for display
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            addMessageToUI(data.role, data.message, false, doc.id);
        });
    } catch (e) {
        console.error("Failed to fetch chat history:", e);
    }
}

async function saveChatLog(role, message) {
    try {
        await addDoc(collection(db, "ai_chat_logs"), {
            category: currentCategory,
            role: role,
            message: message,
            timestamp: serverTimestamp(),
            isDeleted: false
        });
    } catch (e) {
        console.error("Failed to save chat log:", e);
    }
}

export async function deleteChatMessage(id) {
    showConfirmModal("削除確認", "このメッセージを削除しますか？\n（AIの記憶からも消去されます）", async () => {
        try {
            await updateDoc(doc(db, "ai_chat_logs", id), {
                isDeleted: true
            });
            const el = document.getElementById(id); // ID matching logic needs to be consistent
            if (el) el.remove();
            showToast("メッセージを削除しました");
            // Reload context to remove deleted message from memory
            // But we don't have categoryName here easily.
            // Using currentCategory and a default name or just update context silently?
            // Re-running loadContext might be heavy.
            // Ideally, just let it be updated next time user sends message (if we reload context on send).
            // But currently `sendAIMessage` uses `currentContext`.
            // We should reload context before sending message or update it here.
            // Let's assume user accepts next message might use old context unless we refresh.
            // Triggering refresh:
            await loadContext(currentCategory, "現在のカテゴリ");
        } catch (e) {
            console.error("Failed to delete chat log:", e);
            showToast("削除に失敗しました");
        }
    });
}

// --- Context & AI Logic ---

async function loadContext(category, categoryName) {
    const statusEl = document.getElementById('ai-status-text');
    if(statusEl) statusEl.textContent = "記憶データを構築中...";

    try {
        let knowledgeText = "";
        let historyText = "";
        let collectedImages = [];
        let titles = [];

        // 1. Load Knowledge Base (Scoped by Category)
        const qKnowledge = query(
            collection(db, "strategies"),
            where("isKnowledge", "==", true)
            // Note: Composite query might require index. If "isKnowledge" + "category" fails,
            // we might need to filter client side or create index.
            // Given "isKnowledge" is a specific flag, filtering by it first is good.
            // Let's try to query by isKnowledge only and filter client-side for safety/speed without index creation wait.
            // Or better: Query by category first (if indexed) then filter isKnowledge?
            // "category" query is common.
            // Let's stick to client-side filtering for robust "AND" logic without new indexes if possible.
            // Actually, querying all `isKnowledge: true` might be small enough?
            // Or querying all `category == current` then filter `isKnowledge`?
            // Let's try: Query all `category` (or top N updated) + `isKnowledge` ones?
            // Merging approach:
        );

        // Approach: Fetch all `isKnowledge: true` and filter.
        // Assuming the number of knowledge items isn't huge (100s).
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

        // 2. Load Chat History (Scoped by Category)
        // Fetch last 50 messages for context (to avoid huge payload)
        // "Without time limit" -> but token limit exists.
        // Let's fetch reasonably large amount, e.g. 50.
        const qHistory = query(
            collection(db, "ai_chat_logs"),
            where("category", "==", category),
            where("isDeleted", "==", false),
            orderBy("timestamp", "desc"), // Get latest
            limit(50)
        );

        const snapshotHistory = await getDocs(qHistory);
        // Reverse to chronological order
        const historyDocs = snapshotHistory.docs.map(doc => doc.data()).reverse();

        historyDocs.forEach(log => {
            historyText += `[${log.role === 'user' ? 'ユーザー' : 'AI'}]: ${log.message}\n`;
        });

        // 3. Combine
        // We will pass structured text blocks to the prompt via `currentContext`
        // Format:
        // === 社内資料 (Knowledge) ===
        // ...
        // === 会話履歴 (History) ===
        // ...

        let combinedText = "";
        if (knowledgeText) {
            combinedText += `=== 社内資料 (Knowledge) ===\n${knowledgeText}\n\n`;
        }
        if (historyText) {
            combinedText += `=== 会話履歴 (History) ===\n${historyText}\n`;
        }

        currentContext = combinedText;
        contextImages = collectedImages.slice(0, 10); // Max 10 images

        if(statusEl) {
             statusEl.textContent = `[${categoryName}] 知識:${titles.length}件 / 履歴:${historyDocs.length}件 参照中`;
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

    // Save User Message
    let userMsgId = null;
    try {
        const docRef = await addDoc(collection(db, "ai_chat_logs"), {
            category: currentCategory,
            role: "user",
            message: message,
            timestamp: serverTimestamp(),
            isDeleted: false
        });
        userMsgId = docRef.id;
        addMessageToUI("user", message, false, userMsgId);
    } catch (e) {
        console.error("Failed to save user message", e);
        addMessageToUI("user", message);
    }

    // Reload Context to include the new user message?
    // Actually, we just added it to UI. The `currentContext` has history up to *before* this message.
    // Ideally, we should append this message to `currentContext` temporarily for the API call.
    // Or simpler: The backend prompt says "User Question: ...".
    // If we include it in history AND prompt, it duplicates.
    // Standard practice: History contains *past* turns. Current turn is "User Question".
    // So we DON'T need to reload context here.
    // BUT, we *do* need to make sure `currentContext` (loaded previously) is fresh enough?
    // If user deleted something *after* opening chat, `deleteChatMessage` calls `loadContext`. So it's fine.

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
            // Save AI Message
             try {
                const docRef = await addDoc(collection(db, "ai_chat_logs"), {
                    category: currentCategory,
                    role: "ai",
                    message: aiReply,
                    timestamp: serverTimestamp(),
                    isDeleted: false
                });
                addMessageToUI("ai", aiReply, false, docRef.id);
            } catch (e) {
                console.error("Failed to save AI message", e);
                addMessageToUI("ai", aiReply);
            }
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

    const deleteBtn = (id && !isLoading) ? `
        <button onclick="window.deleteChatMessage('${id}')" class="opacity-0 group-hover:opacity-100 transition text-slate-300 hover:text-rose-400 p-1 self-center ${isUser ? 'mr-2' : 'ml-2 order-last'}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
    ` : '';

    let contentHtml = `
        <div class="max-w-[80%] p-3 rounded-2xl text-sm font-bold leading-relaxed shadow-sm ${
            isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
        }">
            ${escapeHtml(text).replace(/\n/g, '<br>')}
        </div>
    `;

    if (isUser) {
        div.innerHTML = `${deleteBtn}${contentHtml}`;
    } else {
        div.innerHTML = `${contentHtml}${deleteBtn}`;
    }

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
    container.scrollTop = container.scrollHeight;
}

// Global Expose
window.toggleAIChat = toggleAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
window.deleteChatMessage = deleteChatMessage;
