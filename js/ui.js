import { $ } from './utils.js';

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
let authContext = '';

export function showPasswordModal(ctx, inputId = 'password-input', errorId = 'password-error', modalId = 'password-modal') {
    authContext = ctx;
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

export function getAuthContext() {
    return authContext;
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
