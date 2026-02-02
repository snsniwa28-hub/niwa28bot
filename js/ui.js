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

window.closeConfirmModal = closeConfirmModal;

// --- Image Viewer (Lightbox) ---
let currentViewerImages = [];
let currentViewerIndex = 0;

export function showImageViewer(images, startIndex = 0) {
    if (!images || images.length === 0) return;
    currentViewerImages = images;
    currentViewerIndex = startIndex;

    if (!document.getElementById('image-viewer-overlay')) {
        const html = `
        <div id="image-viewer-overlay" class="fixed inset-0 z-[150] bg-black/95 hidden flex flex-col items-center justify-center transition-opacity duration-300 opacity-0">
            <button id="iv-close" class="absolute top-4 right-4 text-white p-4 rounded-full bg-white/10 hover:bg-white/20 transition z-50">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <button id="iv-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white p-4 rounded-full bg-white/10 hover:bg-white/20 transition z-50 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <button id="iv-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white p-4 rounded-full bg-white/10 hover:bg-white/20 transition z-50 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>

            <div class="relative w-full h-full flex items-center justify-center p-4 sm:p-10 pointer-events-none">
                <img id="iv-image" src="" class="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300 pointer-events-auto">
                <p id="iv-counter" class="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 font-bold text-sm bg-black/50 px-4 py-2 rounded-full hidden">1 / 1</p>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('iv-close').onclick = hideImageViewer;
        document.getElementById('iv-prev').onclick = (e) => { e.stopPropagation(); navigateImageViewer(-1); };
        document.getElementById('iv-next').onclick = (e) => { e.stopPropagation(); navigateImageViewer(1); };
        // Close on background click
        document.getElementById('image-viewer-overlay').onclick = (e) => {
            if(e.target.id === 'image-viewer-overlay') hideImageViewer();
        };
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if(document.getElementById('image-viewer-overlay').classList.contains('hidden')) return;
            if(e.key === 'Escape') hideImageViewer();
            if(e.key === 'ArrowLeft') navigateImageViewer(-1);
            if(e.key === 'ArrowRight') navigateImageViewer(1);
        });
    }

    const overlay = document.getElementById('image-viewer-overlay');
    overlay.classList.remove('hidden');
    // Force reflow for transition
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
    });

    updateImageViewer();
}

function updateImageViewer() {
    const img = document.getElementById('iv-image');
    const prevBtn = document.getElementById('iv-prev');
    const nextBtn = document.getElementById('iv-next');
    const counter = document.getElementById('iv-counter');

    img.src = currentViewerImages[currentViewerIndex];

    if (currentViewerImages.length > 1) {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        counter.classList.remove('hidden');
        counter.textContent = `${currentViewerIndex + 1} / ${currentViewerImages.length}`;
    } else {
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        counter.classList.add('hidden');
    }
}

function navigateImageViewer(direction) {
    if (currentViewerImages.length <= 1) return;
    currentViewerIndex = (currentViewerIndex + direction + currentViewerImages.length) % currentViewerImages.length;
    updateImageViewer();
}

export function hideImageViewer() {
    const overlay = document.getElementById('image-viewer-overlay');
    if(overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            const img = document.getElementById('iv-image');
            if(img) img.src = "";
        }, 300);
    }
}

window.showImageViewer = showImageViewer;
window.hideImageViewer = hideImageViewer;
