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
