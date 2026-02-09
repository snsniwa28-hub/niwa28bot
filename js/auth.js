import { EDIT_PASSWORD } from './config.js';
import { auth, provider, signInWithPopup, signOut } from './firebase.js';

let _onSuccess = null;

export function check(password) {
    return password && password.trim().toLowerCase() === EDIT_PASSWORD;
}

export function setCallback(fn) {
    _onSuccess = fn;
}

export function executeCallback() {
    if (typeof _onSuccess === 'function') {
        _onSuccess();
    }
    _onSuccess = null;
}

/* =========================================
   SHIFT ADMIN GOOGLE AUTH
   ========================================= */
const ALLOWED_ADMIN_EMAILS = [
    'snsniwa28@gmail.com',
    'mithu.miho.01150219@gmail.com'
];

export async function loginAsShiftAdmin() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        if (user && user.email && ALLOWED_ADMIN_EMAILS.includes(user.email)) {
            return true;
        } else {
            alert("管理者権限がありません。\n許可されたGoogleアカウントでログインしてください。");
            await signOut(auth);
            return false;
        }
    } catch (error) {
        console.error("Login Failed:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
            alert("ログインに失敗しました: " + error.message);
        }
        return false;
    }
}
