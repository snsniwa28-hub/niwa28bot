import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

// State
let isChatOpen = false;
let currentContext = "";
let currentImages = []; // AIに送る画像リスト
let contextTitle = "";

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

export async function toggleAIChat(category = null) {
    const modal = document.getElementById('ai-chat-modal');

    // 「引数なし」で呼ばれた場合（トグル動作）
    if (category === null && typeof category !== 'string') {
        isChatOpen = !isChatOpen;
    } else {
        // カテゴリ指定ありで呼ばれた場合は、強制的に開くモードにする
        isChatOpen = true;
    }

    if (isChatOpen) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // カテゴリが変わった場合、またはコンテキストが未ロードの場合にロードする
        if (category) {
            await loadContext(category);
        } else if (!currentContext) {
            await loadContext('all');
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

async function loadContext(category = null) {
    const statusEl = document.getElementById('ai-status-text');
    if (statusEl) statusEl.textContent = "社内資料を読み込み中...";

    try {
        const q = query(collection(db, "strategies"), orderBy("updatedAt", "desc"), limit(20));
        const snapshot = await getDocs(q);

        let combinedText = "";
        let titles = [];
        let images = []; // AIに送る画像リスト

        snapshot.docs.forEach(doc => {
            const data = doc.data();

            // カテゴリフィルタリング (クライアントサイド)
            if (category && category !== 'all' && data.category !== category) {
                return;
            }

            let text = "";
            let docImages = [];

            if (data.ai_context) {
                text = data.ai_context;
            } else if (data.blocks) {
                text = data.blocks.map(b => b.text || "").join("\n");

                // 画像ブロックから画像を収集
                data.blocks.forEach(b => {
                    if ((b.type === 'img_top' || b.type === 'img_bottom') && b.image) {
                        docImages.push(b.image);
                    }
                });
            }

            if (text || docImages.length > 0) {
                combinedText += `\n--- [${data.title}] ---\n${text}\n`;
                titles.push(data.title);
                images = images.concat(docImages);
            }
        });

        currentContext = combinedText;
        currentImages = images;

        const catName = category ? category.toUpperCase() : "ALL";
        contextTitle = titles.length > 0 ? `${catName}: ${titles.join(", ")}` : "なし";

        if (statusEl) {
            let statusText = titles.length > 0
                ? `[${catName}] 資料:${titles.length}件`
                : `[${catName}] 資料なし`;

            if (currentImages.length > 0) {
                statusText += ` 画像:${currentImages.length}枚`;
            }
            statusEl.textContent = statusText;
        }

    } catch (e) {
        console.error("Failed to load context:", e);
        if (statusEl) statusEl.textContent = "資料の読み込みに失敗しました";
    }
}

// Convert image URL to Base64
async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Failed to convert image to base64:", url, e);
        return null;
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
    const loadingId = addMessageToUI("ai", "考え中... (画像を解析中)", true);

    try {
        // Prepare Images
        let imagesToSend = [];
        if (currentImages && currentImages.length > 0) {
            // Limit to top 5 images to avoid payload limits/timeouts
            const targetImages = currentImages.slice(0, 5);
            const promises = targetImages.map(url => urlToBase64(url));
            const results = await Promise.all(promises);
            imagesToSend = results.filter(img => img !== null);
        }

        const response = await fetch('/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: message,
                contextData: currentContext,
                images: imagesToSend
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
        <div class="max-w-[80%] p-3 rounded-2xl text-sm font-bold leading-relaxed shadow-sm ${isUser
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
    if (el) el.remove();
}

function scrollToBottom() {
    const container = document.getElementById('ai-messages');
    container.scrollTop = container.scrollHeight;
}

// Global Expose
window.toggleAIChat = toggleAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
