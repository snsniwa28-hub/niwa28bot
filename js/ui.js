import { $ } from './utils.js';
import * as Auth from './auth.js';

export function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = "toast-notification";
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('show'); });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { document.body.removeChild(toast); }, 300);
    }, 2000);
}

export function switchView(viewName, callbacks = {}) {
    window.scrollTo(0,0);
    try {
        if (viewName === 'staff') {
            $('#app-customer').classList.add('hidden');
            $('#app-staff').classList.remove('hidden');

            // Execute callback for staff view initialization
            if (callbacks.onStaffView) {
                callbacks.onStaffView();
            }
        } else {
            $('#app-staff').classList.add('hidden');
            $('#app-customer').classList.remove('hidden');
        }

        // Handle hash update if needed, or leave it to the caller
        if(viewName === 'staff') {
             // window.location.hash = '#staff'; // Optional, behavior from main.js
        }
    } catch(e) {
        console.error("Switch View Error:", e);
    }
}

// Password Modal UI Helpers
export function showPasswordModal(callback, inputId = 'password-input', errorId = 'password-error', modalId = 'password-modal') {
    if (typeof callback === 'function') {
        Auth.setCallback(callback);
    }
    $(`#${modalId}`).classList.remove('hidden');
    $(`#${inputId}`).value = "";
    $(`#${errorId}`).classList.add('hidden');
    $(`#${inputId}`).focus();

    const input = $(`#${inputId}`);
    // Remove old listeners to avoid stacking (though usually it's better to add once)
    // Here we assume the main controller sets up the specific Enter key logic or we do it here.
    // In the original code, onkeydown was set every time.
    input.onkeydown = (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            if (window.checkPassword) window.checkPassword(); // Call the global handler
        }
    };
}

export function closePasswordModal(modalId = 'password-modal') {
    $(`#${modalId}`).classList.add('hidden');
}

// Generic Modal Helpers
export function initModal(title, modalId = 'select-modal', titleId = 'select-modal-title', bodyId = 'select-modal-body', confirmBtnId = 'select-confirm-btn') {
    $(`#${titleId}`).textContent = title;
    $(`#${bodyId}`).innerHTML = '';
    const btn = $(`#${confirmBtnId}`);
    if(btn) btn.disabled = true;
    $(`#${modalId}`).classList.remove('hidden');
}

export function selectOptionUI(element, selectorClass = '.select-modal-option', confirmBtnId = 'select-confirm-btn') {
    const all = document.querySelectorAll(selectorClass);
    all.forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    const btn = $(`#${confirmBtnId}`);
    if(btn) btn.disabled = false;
}

export function closeModal(modalId) {
    const el = $(`#${modalId}`);
    if(el) el.classList.add('hidden');
}

// --- Global Confirm Modal ---
let confirmCallback = null;

export function showConfirmModal(title, message, onConfirm, color = 'bg-indigo-600') {
    // Inject HTML if not exists
    if (!document.getElementById('global-confirm-modal')) {
        const html = `
        <div id="global-confirm-modal" class="modal-overlay hidden" style="z-index: 100;">
            <div class="modal-content p-6 w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col">
                <h3 id="global-confirm-title" class="font-bold text-slate-800 text-lg mb-2"></h3>
                <p id="global-confirm-msg" class="text-sm font-bold text-slate-500 mb-6 leading-relaxed"></p>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.closeConfirmModal()" class="py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition">キャンセル</button>
                    <button id="global-confirm-ok" class="py-3 text-white font-bold rounded-xl shadow-lg transition">OK</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    const modal = document.getElementById('global-confirm-modal');
    const titleEl = document.getElementById('global-confirm-title');
    const msgEl = document.getElementById('global-confirm-msg');
    const okBtn = document.getElementById('global-confirm-ok');

    titleEl.textContent = title;
    msgEl.innerHTML = message.replace(/\n/g, '<br>'); // Support newlines

    // Reset Color
    okBtn.className = `py-3 text-white font-bold rounded-xl shadow-lg transition ${color} hover:opacity-90`;

    confirmCallback = onConfirm;

    // Assign One-time Event
    okBtn.onclick = () => {
        if (confirmCallback) confirmCallback();
        closeConfirmModal();
    };

    modal.classList.remove('hidden');
}

export function closeConfirmModal() {
    const modal = document.getElementById('global-confirm-modal');
    if(modal) modal.classList.add('hidden');
    confirmCallback = null;
}

// --- Game Loading Overlay ---
let loadingInterval = null;

export function showLoadingOverlay(message = "Now Loading...") {
    if (!document.getElementById('game-loading-overlay')) {
        const html = `
        <div id="game-loading-overlay" class="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center transition-opacity duration-300 opacity-0 pointer-events-none">
            <div class="w-64 relative mb-8">
                <!-- Glitchy Text Effect Base -->
                <h2 id="loading-text" class="text-2xl font-black text-white tracking-widest text-center mb-2 animate-pulse">Now Loading...</h2>
                <div class="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div id="loading-bar" class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-0 transition-all duration-300 ease-out"></div>
                </div>
            </div>
            <div class="flex gap-2">
                <span class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0s"></span>
                <span class="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
            <p id="loading-subtext" class="text-xs font-bold text-slate-500 mt-4 tracking-wide">SYSTEM INITIALIZING</p>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    const overlay = document.getElementById('game-loading-overlay');
    const bar = document.getElementById('loading-bar');
    const textEl = document.getElementById('loading-text');
    const subtextEl = document.getElementById('loading-subtext');

    overlay.classList.remove('pointer-events-none', 'opacity-0');
    overlay.classList.add('pointer-events-auto', 'opacity-100');

    textEl.textContent = message;
    subtextEl.textContent = "AI PROCESSING...";
    bar.style.width = "0%";

    // Simulated Progress Logic
    let width = 0;
    if (loadingInterval) clearInterval(loadingInterval);

    loadingInterval = setInterval(() => {
        // Fast at first, slow at end
        if (width < 30) width += Math.random() * 5;
        else if (width < 60) width += Math.random() * 2;
        else if (width < 85) width += Math.random() * 0.5;

        if (width > 90) width = 90; // Cap at 90 until explicit hide

        bar.style.width = width + "%";
    }, 100);
}

export function updateLoadingMessage(message) {
    const textEl = document.getElementById('loading-text');
    if (textEl) textEl.textContent = message;
}

export function hideLoadingOverlay() {
    const overlay = document.getElementById('game-loading-overlay');
    const bar = document.getElementById('loading-bar');
    const subtextEl = document.getElementById('loading-subtext');

    if (!overlay) return;

    if (loadingInterval) clearInterval(loadingInterval);

    // Finish bar
    if (bar) bar.style.width = "100%";
    if (subtextEl) subtextEl.textContent = "COMPLETE";

    // Wait a bit then fade
    setTimeout(() => {
        overlay.classList.remove('opacity-100', 'pointer-events-auto');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        // Reset width for next time
        setTimeout(() => { if(bar) bar.style.width = "0%"; }, 300);
    }, 500);
}

window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
window.closeConfirmModal = closeConfirmModal;
