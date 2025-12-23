import { $ } from './utils.js';
import { EDIT_PASSWORD } from './config.js';

export function openPopupWindow(title, contentHtml, width = 600, height = 600) {
    // Determine screen position
    const left = window.screen.width ? (window.screen.width - width) / 2 : 0;
    const top = window.screen.height ? (window.screen.height - height) / 2 : 0;

    // Open the window
    const win = window.open('', '_blank', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);

    if (!win) {
        console.error('Popup blocked');
        return null;
    }

    // Collect styles from the parent window
    const headContent = Array.from(document.head.children).map(el => {
        if (el.tagName === 'LINK' && el.rel === 'stylesheet') return el.outerHTML;
        if (el.tagName === 'STYLE') return el.outerHTML;
        if (el.tagName === 'SCRIPT' && el.src.includes('tailwindcss')) return el.outerHTML;
        return '';
    }).join('\n');

    // Write content
    const html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            ${headContent}
            <style>
                body { background-color: #f8fafc; font-family: 'Inter', 'Noto Sans JP', sans-serif; }
                /* Custom scrollbar to look like main app */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #f1f5f9; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            </style>
        </head>
        <body class="antialiased p-4">
            ${contentHtml}
        </body>
        </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();

    return win;
}

export function showToast(msg) {
    const width = 320;
    const height = 120;

    const html = `
        <div class="flex flex-col items-center justify-center h-full">
             <div class="text-3xl mb-2">🔔</div>
            <div class="text-center font-bold text-slate-800 text-lg">${msg}</div>
        </div>
    `;

    const win = openPopupWindow('Notification', html, width, height);

    setTimeout(() => {
        if(win && !win.closed) win.close();
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

export function showPasswordModal(ctx) {
    authContext = ctx;

    const html = `
        <div class="flex flex-col items-center justify-center h-full p-4">
             <h3 class="text-xl font-bold text-slate-800 mb-2">管理者認証</h3>
            <p class="text-sm text-slate-500 mb-6">パスワードを入力してください。</p>

            <input id="popup-password-input" type="password"
                class="w-full p-3 border border-slate-200 rounded-lg mb-4 bg-slate-50 text-center font-bold focus:border-indigo-500 focus:outline-none text-lg"
                placeholder="Password" autofocus>

            <p id="popup-password-error" class="text-rose-500 text-xs font-bold mb-4 hidden">パスワードが違います</p>

            <div class="flex gap-3 justify-center w-full">
                <button onclick="window.close()" class="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 border border-slate-100">キャンセル</button>
                <button id="btn-verify" class="flex-1 px-4 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200">認証</button>
            </div>

            <script>
                const input = document.getElementById('popup-password-input');
                const err = document.getElementById('popup-password-error');
                const btn = document.getElementById('btn-verify');

                input.focus();

                function attempt() {
                    const val = input.value;
                    const result = window.opener.UI.verifyPasswordLogic(val, '${ctx}');
                    if (result) {
                        window.close();
                    } else {
                        err.classList.remove('hidden');
                        input.value = '';
                        input.focus();
                    }
                }

                btn.onclick = attempt;
                input.onkeydown = (e) => {
                    if(e.key === 'Enter') attempt();
                };
            </script>
        </div>
    `;

    openPopupWindow('管理者認証', html, 400, 400);
}

// Logic exposed to popup via window.opener.UI.verifyPasswordLogic
export function verifyPasswordLogic(password, ctx) {
    if (password.trim().toLowerCase() === EDIT_PASSWORD) {
        // Trigger the success handler in the main window
        if (window.handlePasswordSuccess) {
            window.handlePasswordSuccess(ctx);
        } else {
            // Fallback to legacy checkPassword logic if handlePasswordSuccess isn't defined yet
            // This allows us to bridge the transition
             if (window.checkPassword) {
                 // But wait, checkPassword relied on global state.
                 // We should ideally define handlePasswordSuccess in main.js
                 console.warn("handlePasswordSuccess is not defined. Using legacy fallback which might fail.");
             }
        }
        return true;
    }
    return false;
}


export function closePasswordModal(modalId = 'password-modal') {
    // With popups, usually the popup closes itself.
    // This function might be called by legacy code to hide the DOM modal.
    // We can keep it to hide the DOM element if it still exists, just in case.
    const el = $(`#${modalId}`);
    if(el) el.classList.add('hidden');
}

export function getAuthContext() {
    return authContext;
}

// Generic Modal Helpers -> Converted to Popup
export function initModal(title, modalId = 'select-modal', titleId = 'select-modal-title', bodyId = 'select-modal-body', confirmBtnId = 'select-confirm-btn') {
    // This function was used to PREPARE a DOM modal.
    // In the popup paradigm, we might need to rethink how `select-modal` works.
    // The existing code calls initModal -> populates body -> shows modal.
    // We can't easily replicate "populate body" if the window isn't open yet.
    // Or we open the window here, and return the document object?

    // For now, let's keep the DOM manipulation for `select-modal` if it's too complex to refactor
    // all selection logic in one go, OR we refactor `openSelectModal` entirely in tasks.js.

    // The user instruction said "Change ALL to new browser window".
    // `select-modal` is used for "Select Time", "Select Task", "Select Staff".
    // These are heavily interactive.

    // Let's create a global `currentSelectPopup` reference.
    // But `initModal` usually takes IDs.
    // Strategy: We will not use `initModal` for the popup. The caller (Tasks.js) needs to use `openPopupWindow`.
    // I will leave this here for now but deprecate it or make it log a warning.
    // Actually, `Tasks.js` uses this. I should refactor `Tasks.js` logic later if I have time,
    // or provide a bridge here.

    // Bridge: If `select-modal` is requested, we might need to handle it.
    // But for this plan step, I am focusing on what was explicitly requested (Password, QSC, Target).
    // I will modify `js/tasks.js` usage later if needed.
    // For now, I'll leave the DOM based `initModal` as a fallback or if I haven't reached that refactor yet,
    // BUT I must hide the DOM elements in index.html.

    // Since the user asked to change *everything*, `select-modal` should also be a popup.
    // I will address `select-modal` in a subsequent step (maybe when refactoring Tasks or Components).
    // For `ui.js`, I'll leave `initModal` alone but maybe redirect if I can.

    const el = $(`#${modalId}`);
    if(el) el.classList.remove('hidden'); // Legacy support until Tasks.js is updated
}

export function selectOptionUI(element, selectorClass = '.select-modal-option', confirmBtnId = 'select-confirm-btn') {
    // This logic relies on DOM classes.
    // If we move to popup, the popup's DOM is distinct.
    // We need to run this `selectOptionUI` INSIDE the popup context.

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

// Export UI to window for popups to access helper functions if needed
window.UI = {
    verifyPasswordLogic,
    showToast,
    closeModal
};
